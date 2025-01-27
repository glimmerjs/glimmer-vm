import type {
  BlockMetadata,
  BuilderOpcode,
  BuilderOperand,
  CompileTimeComponent,
  ComponentDefinition,
  Dict,
  Encoder,
  EncoderError,
  EvaluationContext,
  Expressions,
  HandleResult,
  InstructionEncoder,
  Operand,
  Optional,
  ProgramHeap,
  SerializedBlock,
  SerializedInlineBlock,
  STDLib,
} from '@glimmer/interfaces';
import { encodeHandle, isMachineOp, VM_PRIMITIVE_OP, VM_RETURN_OP } from '@glimmer/constants';
import { debugToString, expect, isPresentArray, localAssert, unwrap } from '@glimmer/debug-util';
import { InstructionEncoderImpl } from '@glimmer/encoder';
import { dict, Stack } from '@glimmer/util';
import { ARG_SHIFT, MACHINE_MASK, TYPE_SIZE } from '@glimmer/vm';
import { SexpOpcodes } from '@glimmer/wire-format';

import type { ResolveAppendInvokableOptions, ResolveAppendOptions } from './helpers/resolution';

import { compilableBlock } from '../compilable-template';
import {
  assertResolverInvariants,
  resolveAppend,
  resolveAppendInvokable,
  resolveComponent,
  resolveModifier,
} from './helpers/resolution';

export class Labels {
  labels: Dict<number> = dict();
  targets: Array<{ at: number; target: string }> = [];

  label(name: string, index: number) {
    this.labels[name] = index;
  }

  target(at: number, target: string) {
    this.targets.push({ at, target });
  }

  patch(heap: ProgramHeap): void {
    let { targets, labels } = this;

    for (const { at, target } of targets) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
      let address = labels[target]! - at;

      localAssert(
        heap.getbyaddr(at) === -1,
        `Expected heap to contain a placeholder for ${target}, but it did not`
      );

      heap.setbyaddr(at, address);
    }
  }
}

export class EncodeOp {
  readonly #encoder: Encoder;
  readonly #context: EvaluationContext;
  readonly #meta: BlockMetadata;

  constructor(encoder: Encoder, context: EvaluationContext, meta: BlockMetadata) {
    this.#encoder = encoder;
    this.#context = context;
    this.#meta = meta;
  }

  isStrictMode(): Operand {
    return encodeHandle(this.#constants.value(this.#meta.isStrictMode));
  }

  debugSymbols(symbols: EncodeDebugSymbols): Operand {
    return encodeHandle(this.#constants.value(symbols));
  }

  block(block: SerializedInlineBlock | SerializedBlock): Operand {
    return encodeHandle(this.#constants.value(compilableBlock(block, this.#meta)));
  }

  stdlibFn(fnName: StdlibFn) {
    return expect(
      this.#context.stdlib,
      'attempted to encode a stdlib operand, but the encoder did not have a stdlib. Are you currently building the stdlib?'
    )[fnName];
  }

  constant(value: unknown): number {
    return encodeHandle(this.#constants.value(value));
  }

  array(values: number[] | string[]): number {
    return encodeHandle(this.#constants.array(values));
  }

  op = (opcode: BuilderOpcode, ...operands: BuilderOperand[]): void =>
    this.#encoder.push(opcode, ...operands);

  mark = (name: string): void => this.#encoder.mark(name);

  to = (name: string): { label: string } => ({ label: name });

  startLabels = (): void => this.#encoder.startLabels();
  stopLabels = (): void => this.#encoder.stopLabels();

  /**
   * Called from the current syntaxes that take a component of many different types. This should
   * evolve to calls into the correct kind of component, based on the known resolution when the
   * wire format is compiled.
   */
  resolveComponent = (expr: Expressions.Expression): CompileTimeComponent =>
    resolveComponent(this.#context.resolver, this.#constants, this.#meta, expr);

  getLexicalComponent = (expr: Expressions.Expression): CompileTimeComponent => {
    localAssert(
      Array.isArray(expr),
      'Expected to find an expression when resolving a lexical component'
    );

    localAssert(
      expr[0] === SexpOpcodes.GetLexicalSymbol,
      `Expected GetLexicalSymbol, got: ${expr[0]}`
    );

    let {
      scopeValues,
      owner,
      symbols: { lexical },
    } = this.#meta;
    let definition = expect(scopeValues, 'BUG: scopeValues must exist if template symbol is used')[
      expr[1]
    ];

    return this.#constants.component(
      definition as object,
      expect(owner, 'BUG: expected owner when resolving component definition'),
      false,
      lexical?.at(expr[1])
    );
  };

  /**
   * (helper)
   * (helper arg)
   */
  resolveHelper = (symbol: number): number => {
    let {
      symbols: { upvars },
      owner,
    } = assertResolverInvariants(this.#meta);

    let name = unwrap(upvars[symbol]);
    let helper = this.#resolver?.lookupHelper?.(name, owner) ?? null;

    if (import.meta.env.DEV && helper === null) {
      localAssert(
        !this.#meta.isStrictMode,
        'Strict mode errors should already be handled at compile time'
      );

      throw new Error(
        `Attempted to resolve \`${name}\`, which was expected to be a helper, but nothing was found.`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
    return this.#constants.helper(helper!, name);
  };

  appendAny = (expr: Expressions.GetUnknownAppend, options: ResolveAppendOptions): void =>
    resolveAppend(this.#context.resolver, this.#constants, this.#meta, expr, options);

  appendInvokable = (expr: Expressions.Expression, then: ResolveAppendInvokableOptions): void =>
    resolveAppendInvokable(this.#context.resolver, this.#constants, this.#meta, expr, then);

  modifier = (expr: Expressions.Expression, then: (handle: number) => void): void =>
    resolveModifier(this.#context.resolver, this.#constants, this.#meta, expr, then);

  /** This could be converted to taking the constant itself. */
  lexicalComponent = (symbol: number, then: (component: ComponentDefinition) => void) => {
    let {
      scopeValues,
      owner,
      symbols: { lexical },
    } = this.#meta;
    let definition = expect(scopeValues, 'BUG: scopeValues must exist if template symbol is used')[
      symbol
    ];

    then(
      this.#constants.component(
        definition as object,
        expect(owner, 'BUG: expected owner when resolving component definition'),
        false,
        lexical?.at(symbol)
      )
    );
  };

  resolvedComponent = (upvar: number, then: (component: ComponentDefinition) => void) => {
    let {
      symbols: { upvars },
      owner,
    } = assertResolverInvariants(this.#meta);

    let name = unwrap(upvars[upvar]);
    let definition = this.#context.resolver?.lookupComponent?.(name, owner) ?? null;

    if (import.meta.env.DEV && (typeof definition !== 'object' || definition === null)) {
      localAssert(
        !this.#meta.isStrictMode,
        'Strict mode errors should already be handled at compile time'
      );

      throw new Error(
        `Attempted to resolve \`${name}\`, which was expected to be a component, but nothing was found.`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
    then(this.#constants.resolvedComponent(definition!, name));
  };

  lexicalModifier = (symbol: number, then: (handle: number) => void) => {
    const {
      scopeValues,
      symbols: { lexical },
    } = this.#meta;

    const definition = expect(
      scopeValues,
      'BUG: scopeValues must exist if template symbol is used'
    )[symbol];

    then(this.#constants.modifier(definition as object, lexical?.at(symbol)));
  };

  resolvedModifier = (upvar: number, then: (handle: number) => void) => {
    const {
      symbols: { upvars },
    } = assertResolverInvariants(this.#meta);

    const name = unwrap(upvars[upvar]);
    const modifier = this.#context.resolver?.lookupBuiltInModifier?.(name) ?? null;

    if (import.meta.env.DEV && modifier === null) {
      localAssert(
        !this.#meta.isStrictMode,
        'Strict mode errors should already be handled at compile time'
      );

      throw new Error(
        `Attempted to resolve a modifier in a strict mode template, but it was not in scope: ${name}`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
    then(this.#constants.modifier(modifier!, name));
  };

  keywordHelper = (symbol: number): number => {
    let {
      symbols: { upvars },
    } = assertResolverInvariants(this.#meta);

    let name = unwrap(upvars[symbol]);
    let helper = this.#context.resolver?.lookupBuiltInHelper?.(name) ?? null;

    if (import.meta.env.DEV && helper === null) {
      localAssert(
        !this.#meta.isStrictMode,
        'Strict mode errors should already be handled at compile time'
      );

      // Keyword helper did not exist, which means that we're attempting to use a
      // value of some kind that is not in scope
      throw new Error(
        `Attempted to resolve a keyword in a strict mode template, but that value was not in scope: ${
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
          this.#meta.symbols.upvars![symbol] ?? '{unknown variable}'
        }`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
    return this.#constants.helper(helper!, name);
  };

  resolvedHelper = (upvar: number, then: (handle: number) => void) => {
    let {
      symbols: { upvars },
      owner,
    } = assertResolverInvariants(this.#meta);

    let name = unwrap(upvars[upvar]);
    let helper = this.#context.resolver?.lookupHelper?.(name, owner) ?? null;

    if (import.meta.env.DEV && helper === null) {
      localAssert(
        !this.#meta.isStrictMode,
        'Strict mode errors should already be handled at compile time'
      );

      throw new Error(
        `Attempted to resolve \`${name}\`, which was expected to be a helper, but nothing was found.`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
    then(this.#constants.helper(helper!, name));
  };

  lexicalComponentOrHelper = (
    symbol: number,
    ifComponent: (component: CompileTimeComponent) => void,
    ifHelper: (handle: number) => void
  ) => {
    let {
      scopeValues,
      owner,
      symbols: { lexical },
    } = this.#meta;
    let definition = expect(scopeValues, 'BUG: scopeValues must exist if template symbol is used')[
      symbol
    ];

    let component = this.#constants.component(
      definition as object,
      expect(owner, 'BUG: expected owner when resolving component definition'),
      true,
      lexical?.at(symbol)
    );

    if (component !== null) {
      ifComponent(component);
      return;
    }

    let helper = this.#constants.helper(definition as object, null, true);

    if (import.meta.env.DEV && helper === null) {
      localAssert(
        !this.#meta.isStrictMode,
        'Strict mode errors should already be handled at compile time'
      );

      throw new Error(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
        `Attempted to use a value as either a component or helper, but it did not have a component manager or helper manager associated with it. The value was: ${debugToString!(
          definition
        )}`
      );
    }

    ifHelper(expect(helper, 'BUG: helper must exist'));
  };

  resolvedComponentOrHelper = (
    upvar: number,
    ifComponent: (component: CompileTimeComponent) => void,
    ifHelper: (handle: number) => void
  ) => {
    let {
      symbols: { upvars },
      owner,
    } = assertResolverInvariants(this.#meta);

    let name = unwrap(upvars[upvar]);
    let definition = this.#resolver?.lookupComponent?.(name, owner) ?? null;

    if (definition !== null) {
      ifComponent(this.#constants.resolvedComponent(definition, name));
    } else {
      let helper = this.#resolver?.lookupHelper?.(name, owner) ?? null;

      if (import.meta.env.DEV && helper === null) {
        localAssert(
          !this.#meta.isStrictMode,
          'Strict mode errors should already be handled at compile time'
        );

        throw new Error(
          `Attempted to resolve \`${name}\`, which was expected to be a component or helper, but nothing was found.`
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ifHelper(this.#constants.helper(helper!, name));
    }
  };

  lexicalOptionalComponentOrHelper = (
    symbol: number,
    ifComponent: (component: CompileTimeComponent) => void,
    ifHelper: (handle: number) => void,
    ifValue: (handle: number) => void
  ) => {
    let {
      scopeValues,
      owner,
      symbols: { lexical },
    } = this.#meta;
    let definition = expect(scopeValues, 'BUG: scopeValues must exist if template symbol is used')[
      symbol
    ];

    if (
      typeof definition !== 'function' &&
      (typeof definition !== 'object' || definition === null)
    ) {
      // The value is not an object, so it can't be a component or helper.
      ifValue(this.#constants.value(definition));
      return;
    }

    let component = this.#constants.component(
      definition,
      expect(owner, 'BUG: expected owner when resolving component definition'),
      true,
      lexical?.at(symbol)
    );

    if (component !== null) {
      ifComponent(component);
      return;
    }

    let helper = this.#constants.helper(definition, null, true);

    if (helper !== null) {
      ifHelper(helper);
      return;
    }

    ifValue(this.#constants.value(definition));
  };

  resolvedOptionalComponentOrHelper = (
    upvar: number,
    ifComponent: (component: CompileTimeComponent) => void,
    ifHelper: (handle: number) => void
  ) => {
    let {
      symbols: { upvars },
      owner,
    } = assertResolverInvariants(this.#meta);

    let name = unwrap(upvars[upvar]);
    let definition = this.#resolver?.lookupComponent?.(name, owner) ?? null;

    if (definition !== null) {
      ifComponent(this.#constants.resolvedComponent(definition, name));
      return;
    }

    let helper = this.#resolver?.lookupHelper?.(name, owner) ?? null;

    if (helper !== null) {
      ifHelper(this.#constants.helper(helper, name));
    }
  };

  local = (upvar: number, then: (name: string, moduleName: Optional<string>) => void) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
    let name = expect(
      this.#meta.symbols.upvars,
      'BUG: attempted to resolve value but no upvars found'
    )[upvar]!;

    then(name, this.#meta.moduleName);
  };

  lexical = (symbol: number): number => {
    let value = expect(
      this.#meta.scopeValues,
      'BUG: Attempted to get a template local, but template does not have any'
    )[symbol];

    return this.#constants.value(value);
  };

  get #constants() {
    return this.#context.program.constants;
  }

  get #resolver() {
    return this.#context.resolver;
  }
}

interface EncodeDebugSymbols {
  locals: Record<string, number>;
  upvars: Record<string, number>;
  lexical: Record<string, number>;
}

type StdlibFn =
  | 'main'
  | 'trusting-append'
  | 'cautious-append'
  | 'trusting-non-dynamic-append'
  | 'cautious-non-dynamic-append';

export class EncoderImpl implements Encoder {
  private labelsStack = new Stack<Labels>();
  private encoder: InstructionEncoder = new InstructionEncoderImpl([]);
  private errors: EncoderError[] = [];
  private handle: number;

  constructor(
    private heap: ProgramHeap,
    private meta: BlockMetadata,
    private stdlib?: STDLib
  ) {
    this.handle = heap.malloc();
  }

  error(error: EncoderError): void {
    this.encoder.encode(VM_PRIMITIVE_OP, 0);
    this.errors.push(error);
  }

  commit(size: number): HandleResult {
    let handle = this.handle;

    this.heap.pushMachine(VM_RETURN_OP);
    this.heap.finishMalloc(handle, size);

    if (isPresentArray(this.errors)) {
      return { errors: this.errors, handle };
    } else {
      return handle;
    }
  }

  push(type: BuilderOpcode, ...args: BuilderOperand[]): void {
    let { heap } = this;

    if (import.meta.env.DEV && (type as number) > TYPE_SIZE) {
      throw new Error(`Opcode type over 8-bits. Got ${type}.`);
    }

    let machine = isMachineOp(type) ? MACHINE_MASK : 0;
    let first = type | machine | (args.length << ARG_SHIFT);

    heap.pushRaw(first);

    for (const arg of args) {
      if (typeof arg === 'number') {
        heap.pushRaw(arg);
      } else {
        this.currentLabels.target(heap.offset, arg.label);
        heap.pushRaw(-1);
      }
    }
  }

  mark(name: string): void {
    this.currentLabels.label(name, this.heap.offset + 1);
  }

  toLabel(name: string): number {
    this.currentLabels.target(this.heap.offset, name);
    return -1;
  }

  startLabels() {
    this.labelsStack.push(new Labels());
  }

  stopLabels() {
    let label = expect(this.labelsStack.pop(), 'unbalanced push and pop labels');
    label.patch(this.heap);
  }

  private get currentLabels(): Labels {
    return expect(this.labelsStack.current, 'bug: not in a label stack');
  }
}
