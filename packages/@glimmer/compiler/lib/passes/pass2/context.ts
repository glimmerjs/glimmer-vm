import { assert, Stack } from '@glimmer/util';
import * as pass1 from '../pass1/ops';
import { SourceOffsets } from '../shared/location';
import { InputOpArgs, OpConstructor, OpsTable, UnlocatedOp } from '../shared/op';
import { OpFactory, Ops } from '../shared/ops';
import { Visitors } from '../shared/visitors';
import { Block, ComponentBlock, NamedBlock, Template } from './blocks';
import { check, Check, COMPONENT_BLOCK } from './checks';
import { EXPRESSIONS, INTERNAL, isExpr, isInternal } from './expressions';
import * as pass2 from './ops';
import * as out from './out';
import { isStatement, STATEMENTS } from './statements';

export class CompilerContext {
  readonly options: CompileOptions | undefined;
  readonly factory: OpFactory<out.Op>;
  readonly valueFactory: OpFactory<out.StackValue>;

  constructor(readonly source: string, options?: CompileOptions) {
    this.options = options;
    this.factory = new OpFactory(source);
    this.valueFactory = new OpFactory(source);
  }

  helpers(state: MutableState, offsets: SourceOffsets | null): Context {
    return new Context(this, state, offsets);
  }
}

type StackValue = out.StackValue | NamedBlock;

export class MutableState {
  readonly template: Template;
  readonly values: StackValue[] = [];
  readonly blocks = new Stack<Block>();

  constructor(template: Template) {
    this.template = template;
  }

  push(...statements: out.Statement[]) {
    this.blocks.current!.push(...statements);
  }
}

type VisitorFunc<N extends pass2.Op> = (
  ctx: Context,
  op: N['args']
) => out.Statement | out.Statement[] | void;

function visit<O extends pass2.Statement | pass2.Internal | pass2.Expr>(
  visitors: Visitors<OpsTable<O>, out.Statement | void>,
  node: O,
  ctx: Context
): out.Statement[] {
  let f = visitors[node.name as O['name']] as VisitorFunc<O>;
  let result = f(ctx, node.args);

  if (result === undefined) {
    return [];
  } else if (Array.isArray(result)) {
    return result;
  } else {
    return [result];
  }
}

export class Context {
  static for({
    source,
    template,
    options,
  }: {
    source: string;
    template: pass2.Template;
    options?: CompileOptions;
  }): Context {
    let ctx = new CompilerContext(source, options);
    let state = new MutableState(new Template(template.args.symbols));

    return new Context(ctx, state, template.offsets);
  }

  readonly #ctx: CompilerContext;
  readonly #state: MutableState;
  readonly #offsets: SourceOffsets | null;

  constructor(ctx: CompilerContext, state: MutableState, offsets: SourceOffsets | null) {
    this.#ctx = ctx;
    this.#state = state;
    this.#offsets = offsets;
  }

  get options(): CompileOptions | undefined {
    return this.#ctx.options;
  }

  get template(): Template {
    return this.#state.template;
  }

  visit<T extends pass2.Op>(node: T | null): out.Statement[] {
    if (node === null) {
      return [];
    } else if (isStatement(node)) {
      return visit(STATEMENTS, node, this);
    } else if (isExpr(node)) {
      return visit(EXPRESSIONS, node, this);
    } else if (isInternal(node)) {
      return visit(INTERNAL, node, this);
    } else {
      throw new Error(`unreachable node ${node.name}`);
    }
  }

  assertStackHas(size: number) {
    assert(
      this.#state.values.length >= size,
      `Expected ${size} values on the stack, found ${this.#state.values.length}`
    );
  }

  slice(slice: pass1.SourceSlice): out.SourceSlice {
    return this.unlocatedOp(out.SourceSlice, slice).offsets(slice.offsets);
  }

  op<O extends out.Op>(name: OpConstructor<O>, ...args: InputOpArgs<O>): O {
    return this.unlocatedOp(name, ...args).offsets(this.#offsets);
  }

  unlocatedOp<O extends out.Op>(name: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return this.#ctx.factory.op(name, ...args);
  }

  ops(...ops: Ops<out.Op>[]): out.Op[] {
    return this.#ctx.factory.ops(...ops);
  }

  map<T>(input: T[], callback: (input: T) => out.Op[]): out.Op[] {
    return this.#ctx.factory.map(input, callback);
  }

  // TODO consider a more semantic approach here
  get blocks(): Stack<Block> {
    return this.#state.blocks;
  }

  get currentBlock(): Block {
    return this.#state.blocks.current || this.template.block;
  }

  get currentComponent(): ComponentBlock {
    let block = this.currentBlock;

    if (block instanceof ComponentBlock) {
      return block;
    } else {
      throw new Error(`Expected ComponentBlock on stack, found ${block.constructor.name}`);
    }
  }

  /// Utilities

  endComponent(): ComponentBlock {
    return check(this.#state.blocks.pop(), COMPONENT_BLOCK);
  }

  startBlock(block: Block): void {
    this.#state.blocks.push(block);
  }

  addBlock(block: NamedBlock): void {
    this.template.block.blocks.push(block);
  }

  popBlock<T extends Block | undefined>(guard: Check<T, Block | undefined>): T {
    return check(this.#state.blocks.pop(), guard);
  }

  unlocatedStackValue<O extends out.StackValue>(
    name: OpConstructor<O>,
    ...args: InputOpArgs<O>
  ): UnlocatedOp<O> {
    return this.#ctx.valueFactory.op(name, ...args);
  }

  stackValue<O extends out.StackValue>(name: OpConstructor<O>, ...args: InputOpArgs<O>): O {
    return this.unlocatedStackValue(name, ...args).offsets(this.#offsets);
  }

  pushValue(block: NamedBlock): NamedBlock;
  pushValue<O extends out.StackValue>(name: OpConstructor<O>, ...args: InputOpArgs<O>): O;
  pushValue<O extends out.StackValue>(
    name: OpConstructor<O> | NamedBlock,
    ...args: InputOpArgs<O> | []
  ): O | NamedBlock {
    if (name instanceof NamedBlock) {
      this.#state.values.push(name);
      return name;
    } else {
      let val = this.stackValue(name, ...(args as InputOpArgs<O>));
      this.#state.values.push(val);
      return val;
    }
  }

  get debugStack(): StackValue[] {
    return this.#state.values;
  }

  // pushValue<S extends out.StackValue>(val: S) {
  //   this.#state.values.push(val);
  // }

  popValue<T extends StackValue | undefined>(check: Check<T, StackValue | undefined>): T {
    let stack = this.#state.values;
    let value = stack.pop();

    if (check.match(value)) {
      return value;
    } else {
      throw new Error(`unexpected ${typeof value}, expected ${check.name}`);
    }
  }
}
