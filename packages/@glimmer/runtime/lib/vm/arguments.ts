import type {
  ArgumentError,
  BlockArguments,
  BlockSymbolTable,
  BlockValue,
  CapturedArguments,
  CapturedBlockArguments,
  CapturedNamedArguments,
  CapturedPositionalArguments,
  CompilableBlock,
  Dict,
  NamedArguments,
  Nullable,
  PositionalArguments,
  Scope,
  ScopeBlock,
  VMArguments,
} from '@glimmer/interfaces';
import type { Reference } from '@glimmer/reference';
import type { Tag } from '@glimmer/validator';
import { check, CheckBlockSymbolTable, CheckHandle, CheckNullable, CheckOr } from '@glimmer/debug';
import { setLocalDebugType, unwrap } from '@glimmer/debug-util';
import { createDebugAliasRef, UNDEFINED_REFERENCE, valueForRef } from '@glimmer/reference';
import { dict, EMPTY_STRING_ARRAY, emptyArray, enumerate } from '@glimmer/util';
import { CONSTANT_TAG } from '@glimmer/validator';
import { $sp } from '@glimmer/vm';

import type { EvaluationStack } from './stack';

import { CheckCompilableBlock, CheckReference, CheckScope } from '../compiled/opcodes/-debug-strip';

/*
  The calling convention is:

  * 0-N block arguments at the bottom
  * 0-N positional arguments next (left-to-right)
  * 0-N named arguments next
*/

export class VMArgumentsImpl implements VMArguments {
  private stack: Nullable<EvaluationStack> = null;
  public positional = new PositionalArgumentsImpl();
  public named = new NamedArgumentsImpl();
  public blocks = new BlockArgumentsImpl();

  constructor() {
    setLocalDebugType('args', this);
  }

  empty(stack: EvaluationStack): this {
    let base = stack.registers[$sp] + 1;

    this.named.empty(stack, base);
    this.positional.empty(stack, base);
    this.blocks.empty(stack, base);

    return this;
  }

  setup(
    stack: EvaluationStack,
    names: readonly string[],
    blockNames: readonly string[],
    positionalCount: number,
    atNames: boolean
  ) {
    this.stack = stack;

    /*
           | ... | blocks      | positional  | named |
           | ... | b0    b1    | p0 p1 p2 p3 | n0 n1 |
     index | ... | 4/5/6 7/8/9 | 10 11 12 13 | 14 15 |
                   ^             ^             ^  ^
                 bbase         pbase       nbase  sp
    */

    let named = this.named;
    let namedCount = names.length;
    let namedBase = stack.registers[$sp] - namedCount + 1;

    named.setup(stack, namedBase, namedCount, names, atNames);

    let positional = this.positional;
    let positionalBase = namedBase - positionalCount;

    positional.setup(stack, positionalBase, positionalCount);

    let blocks = this.blocks;
    let blocksCount = blockNames.length;
    let blocksBase = positionalBase - blocksCount * 3;

    blocks.setup(stack, blocksBase, blocksCount, blockNames);
  }

  get base(): number {
    return this.blocks.base;
  }

  get length(): number {
    return this.positional.length + this.named.length + this.blocks.length * 3;
  }

  at(pos: number): Reference {
    return this.positional.at(pos);
  }

  realloc(offset: number) {
    let { stack } = this;
    if (offset > 0 && stack !== null) {
      let { positional, named } = this;
      let newBase = positional.base + offset;
      let length = positional.length + named.length;

      for (let i = length - 1; i >= 0; i--) {
        stack.copy(i + positional.base, i + newBase);
      }

      positional.base += offset;
      named.base += offset;
      stack.registers[$sp] += offset;
    }
  }

  capture(): CapturedArguments {
    let positional = this.positional.length === 0 ? EMPTY_POSITIONAL : this.positional.capture();
    let named = this.named.length === 0 ? EMPTY_NAMED : this.named.capture();

    return { named, positional } as CapturedArguments;
  }

  clear(): void {
    let { stack, length } = this;
    if (length > 0 && stack !== null) stack.pop(length);
  }
}

const EMPTY_REFERENCES = emptyArray<Reference>();

export class PositionalArgumentsImpl implements PositionalArguments {
  public base = 0;
  public length = 0;

  private stack = null as Nullable<EvaluationStack>;

  private _references: Nullable<readonly Reference[]> = null;

  constructor() {
    setLocalDebugType('args:positional', this);
  }

  empty(stack: EvaluationStack, base: number) {
    this.stack = stack;
    this.base = base;
    this.length = 0;

    this._references = EMPTY_REFERENCES;
  }

  setup(stack: EvaluationStack, base: number, length: number) {
    this.stack = stack;
    this.base = base;
    this.length = length;

    if (length === 0) {
      this._references = EMPTY_REFERENCES;
    } else {
      this._references = null;
    }
  }

  at(position: number): Reference {
    let { base, length, stack } = this;

    if (position < 0 || position >= length) {
      return UNDEFINED_REFERENCE;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
    return check(stack!.get(position, base), CheckReference);
  }

  capture(): CapturedPositionalArguments {
    return this.references as CapturedPositionalArguments;
  }

  prepend(other: Reference[]) {
    let additions = other.length;

    if (additions > 0) {
      let { base, length, stack } = this;

      this.base = base = base - additions;
      this.length = length + additions;

      for (let i = 0; i < additions; i++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
        stack!.set(other[i], i, base);
      }

      this._references = null;
    }
  }

  private get references(): readonly Reference[] {
    let references = this._references;

    if (!references) {
      let { stack, base, length } = this;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
      references = this._references = stack!.slice<Reference>(base, base + length);
    }

    return references;
  }
}

export class NamedArgumentsImpl implements NamedArguments {
  public base = 0;
  public length = 0;

  declare private stack: EvaluationStack;

  private _references: Nullable<readonly Reference[]> = null;

  private _names: Nullable<readonly string[]> = EMPTY_STRING_ARRAY;
  private _atNames: Nullable<readonly string[]> = EMPTY_STRING_ARRAY;

  constructor() {
    setLocalDebugType('args:named', this);
  }

  empty(stack: EvaluationStack, base: number) {
    this.stack = stack;
    this.base = base;
    this.length = 0;

    this._references = EMPTY_REFERENCES;
    this._names = EMPTY_STRING_ARRAY;
    this._atNames = EMPTY_STRING_ARRAY;
  }

  setup(
    stack: EvaluationStack,
    base: number,
    length: number,
    names: readonly string[],
    atNames: boolean
  ) {
    this.stack = stack;
    this.base = base;
    this.length = length;

    if (length === 0) {
      this._references = EMPTY_REFERENCES;
      this._names = EMPTY_STRING_ARRAY;
      this._atNames = EMPTY_STRING_ARRAY;
    } else {
      this._references = null;

      if (atNames) {
        this._names = null;
        this._atNames = names;
      } else {
        this._names = names;
        this._atNames = null;
      }
    }
  }

  get names(): readonly string[] {
    let names = this._names;

    if (!names) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
      names = this._names = this._atNames!.map(this.toSyntheticName);
    }

    return names;
  }

  get atNames(): readonly string[] {
    let atNames = this._atNames;

    if (!atNames) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
      atNames = this._atNames = this._names!.map(this.toAtName);
    }

    return atNames;
  }

  has(name: string): boolean {
    return this.names.indexOf(name) !== -1;
  }

  get(name: string, atNames = false): Reference {
    let { base, stack } = this;

    let names = atNames ? this.atNames : this.names;

    let idx = names.indexOf(name);

    if (idx === -1) {
      return UNDEFINED_REFERENCE;
    }

    let ref = stack.get<Reference>(idx, base);

    if (import.meta.env.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
      return createDebugAliasRef!(atNames ? name : `@${name}`, ref);
    } else {
      return ref;
    }
  }

  capture(): CapturedNamedArguments {
    let { names, references } = this;
    let map = dict<Reference>();

    for (const [i, name] of enumerate(names)) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- @fixme
        map[name] = createDebugAliasRef!(`@${name}`, unwrap(references[i]));
      } else {
        map[name] = unwrap(references[i]);
      }
    }

    return map as CapturedNamedArguments;
  }

  merge(other: Record<string, Reference>) {
    let keys = Object.keys(other);

    if (keys.length > 0) {
      let { names, length, stack } = this;
      let newNames = names.slice();

      for (const name of keys) {
        let idx = newNames.indexOf(name);

        if (idx === -1) {
          length = newNames.push(name);
          stack.push(other[name]);
        }
      }

      this.length = length;
      this._references = null;
      this._names = newNames;
      this._atNames = null;
    }
  }

  private get references(): readonly Reference[] {
    let references = this._references;

    if (!references) {
      let { base, length, stack } = this;
      references = this._references = stack.slice<Reference>(base, base + length);
    }

    return references;
  }

  private toSyntheticName(this: void, name: string): string {
    return name.slice(1);
  }

  private toAtName(this: void, name: string): string {
    return `@${name}`;
  }
}

function toSymbolName(name: string): string {
  return `&${name}`;
}

const EMPTY_BLOCK_VALUES = emptyArray<BlockValue>();

export class BlockArgumentsImpl implements BlockArguments {
  declare private stack: EvaluationStack;
  private internalValues: Nullable<readonly BlockValue[]> = null;
  private _symbolNames: Nullable<readonly string[]> = null;

  public internalTag: Nullable<Tag> = null;
  public names: readonly string[] = EMPTY_STRING_ARRAY;

  public length = 0;
  public base = 0;

  constructor() {
    setLocalDebugType('args:blocks', this);
  }

  empty(stack: EvaluationStack, base: number) {
    this.stack = stack;
    this.names = EMPTY_STRING_ARRAY;
    this.base = base;
    this.length = 0;
    this._symbolNames = null;

    this.internalTag = CONSTANT_TAG;
    this.internalValues = EMPTY_BLOCK_VALUES;
  }

  setup(stack: EvaluationStack, base: number, length: number, names: readonly string[]) {
    this.stack = stack;
    this.names = names;
    this.base = base;
    this.length = length;
    this._symbolNames = null;

    if (length === 0) {
      this.internalTag = CONSTANT_TAG;
      this.internalValues = EMPTY_BLOCK_VALUES;
    } else {
      this.internalTag = null;
      this.internalValues = null;
    }
  }

  get values(): readonly BlockValue[] {
    let values = this.internalValues;

    if (!values) {
      let { base, length, stack } = this;
      values = this.internalValues = stack.slice<BlockValue>(base, base + length * 3);
    }

    return values;
  }

  has(name: string): boolean {
    return this.names.indexOf(name) !== -1;
  }

  get(name: string): Nullable<ScopeBlock> {
    let idx = this.names.indexOf(name);

    if (idx === -1) {
      return null;
    }

    let { base, stack } = this;

    let table = check(stack.get(idx * 3, base), CheckNullable(CheckBlockSymbolTable));
    let scope = check(stack.get(idx * 3 + 1, base), CheckNullable(CheckScope));
    let handle = check(
      stack.get(idx * 3 + 2, base),
      CheckNullable(CheckOr(CheckHandle, CheckCompilableBlock))
    );

    return handle === null ? null : ([handle, scope, table] as ScopeBlock);
  }

  capture(): CapturedBlockArguments {
    return new CapturedBlockArgumentsImpl(this.names, this.values);
  }

  get symbolNames(): readonly string[] {
    let symbolNames = this._symbolNames;

    if (symbolNames === null) {
      symbolNames = this._symbolNames = this.names.map(toSymbolName);
    }

    return symbolNames;
  }
}

class CapturedBlockArgumentsImpl implements CapturedBlockArguments {
  public length: number;

  constructor(
    public names: readonly string[],
    public values: readonly Nullable<BlockValue>[]
  ) {
    this.length = names.length;
  }

  has(name: string): boolean {
    return this.names.indexOf(name) !== -1;
  }

  get(name: string): Nullable<ScopeBlock> {
    let idx = this.names.indexOf(name);

    if (idx === -1) return null;

    return [
      this.values[idx * 3 + 2] as CompilableBlock,
      this.values[idx * 3 + 1] as Scope,
      this.values[idx * 3] as BlockSymbolTable,
    ];
  }
}

export function createCapturedArgs(named: Dict<Reference>, positional: Reference[]) {
  return {
    named,
    positional,
  } as CapturedArguments;
}

export function reifyNamed(named: CapturedNamedArguments) {
  let reified = dict();

  for (const [key, value] of Object.entries(named)) {
    reified[key] = valueForRef(value);
  }

  return reified;
}

export function reifyPositional(positional: CapturedPositionalArguments) {
  return positional.map(valueForRef);
}

export function reifyArgs(args: CapturedArguments) {
  return {
    named: reifyNamed(args.named),
    positional: reifyPositional(args.positional),
  };
}

const ARGUMENT_ERROR = Symbol('ARGUMENT_ERROR');

export function isArgumentError(arg: unknown): arg is ArgumentError {
  return (
    arg !== null &&
    typeof arg === 'object' &&
    (arg as { [ARGUMENT_ERROR]: boolean })[ARGUMENT_ERROR]
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ArgumentErrorImpl(error: any) {
  return {
    [ARGUMENT_ERROR]: true,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    error,
  };
}

export function reifyNamedDebug(named: CapturedNamedArguments) {
  let reified = dict();
  for (const [key, value] of Object.entries(named)) {
    try {
      reified[key] = valueForRef(value);
    } catch (e) {
      reified[key] = ArgumentErrorImpl(e);
    }
  }

  return reified;
}

export function reifyPositionalDebug(positional: CapturedPositionalArguments) {
  return positional.map((p) => {
    try {
      return valueForRef(p);
    } catch (e) {
      return ArgumentErrorImpl(e);
    }
  });
}

export function reifyArgsDebug(args: CapturedArguments) {
  let named = reifyNamedDebug(args.named);
  let positional = reifyPositionalDebug(args.positional);
  return {
    named,
    positional,
  };
}

export const EMPTY_NAMED = Object.freeze(Object.create(null)) as CapturedNamedArguments;
export const EMPTY_POSITIONAL = EMPTY_REFERENCES as CapturedPositionalArguments;
export const EMPTY_ARGS = createCapturedArgs(EMPTY_NAMED, EMPTY_POSITIONAL);
