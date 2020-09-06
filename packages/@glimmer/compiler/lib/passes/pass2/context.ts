import { PresentArray } from '@glimmer/interfaces';
import { assertNever } from '@glimmer/util';
import { SourceOffsets } from '../shared/location';
import { InputOpArgs, OpConstructor, UnlocatedOp } from '../shared/op';
import { OpFactory, Ops } from '../shared/ops';
import {
  EXPRESSIONS,
  INTERNAL,
  isExpr,
  isInternal,
  Pass2Expression,
  Pass2Internal,
} from './expressions';
import * as pass2 from './ops';
import * as out from './out';
import { isStatement, Pass2Statement, STATEMENTS } from './statements';

export class CompilerContext {
  readonly options: CompileOptions | undefined;
  readonly factory: OpFactory<out.Op>;
  readonly valueFactory: OpFactory<out.StackValue>;

  constructor(readonly source: string, options?: CompileOptions) {
    this.options = options;
    this.factory = new OpFactory(source);
    this.valueFactory = new OpFactory(source);
  }

  helpers(offsets: SourceOffsets | null): Context {
    return new Context(this, offsets);
  }
}

export interface Pass2VisitorMap {
  expressions: Pass2Expression;
  internal: Pass2Internal;
  statements: Pass2Statement;
}

type Pass2Visitor = Pass2VisitorMap[keyof Pass2VisitorMap];

export type MapOutput<
  V extends Pass2Visitor,
  In extends pass2.VisitableOp & { name: keyof V }
> = V[In['name']] extends (...args: unknown[]) => unknown ? ReturnType<V[In['name']]> : never;

function visit(visitors: Pass2Statement, node: pass2.Statement, ctx: Context): out.Statement;
function visit(visitors: Pass2Internal, node: pass2.Internal, ctx: Context): out.Internal;
function visit(visitors: Pass2Expression, node: pass2.Expr, ctx: Context): out.Expr;
function visit<V extends Pass2Visitor, N extends pass2.VisitableOp & { name: keyof V }>(
  visitors: V,
  node: N,
  ctx: Context
): out.Op {
  let f = (visitors[node.name] as unknown) as (ctx: Context, args: N['args']) => out.Op;
  return f(ctx, node.args);
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

    return new Context(ctx, template.offsets);
  }

  readonly #ctx: CompilerContext;
  readonly #offsets: SourceOffsets | null;

  constructor(ctx: CompilerContext, offsets: SourceOffsets | null) {
    this.#ctx = ctx;
    this.#offsets = offsets;
  }

  get options(): CompileOptions | undefined {
    return this.#ctx.options;
  }

  visitList<O extends pass2.VisitableOp & { name: keyof Pass2Statement }, L extends O[]>(
    node: O[] & L
  ): MapList<Pass2Statement, O, L>;
  visitList<O extends pass2.VisitableOp & { name: keyof Pass2Expression }, L extends O[]>(
    node: O[] & L
  ): MapList<Pass2Expression, O, L>;
  visitList<O extends pass2.VisitableOp & { name: keyof Pass2Internal }, L extends O[]>(
    node: O[] & L
  ): MapList<Pass2Internal, O, L>;
  visitList(nodes: pass2.VisitableOp[]): out.Op[];
  visitList(nodes: pass2.VisitableOp[]): out.Op[] {
    return nodes.map((item) => this.visit(item));
  }

  visit<O extends pass2.VisitableOp & { name: keyof Pass2Statement }>(
    node: O
  ): MapItem<Pass2Statement, O['name']>;
  visit<O extends pass2.VisitableOp & { name: keyof Pass2Expression }>(
    node: O
  ): MapItem<Pass2Expression, O['name']>;
  visit<O extends pass2.VisitableOp & { name: keyof Pass2Internal }>(
    node: O
  ): MapItem<Pass2Internal, O['name']>;
  visit(node: pass2.VisitableOp): out.Op;
  visit(node: pass2.VisitableOp): out.Op {
    if (isStatement(node)) {
      return visit(STATEMENTS, node, this);
    } else if (isExpr(node)) {
      return visit(EXPRESSIONS, node, this);
    } else if (isInternal(node)) {
      return visit(INTERNAL, node, this);
    } else {
      assertNever(node);
    }
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
    return this.#ctx.factory.flatMap(input, callback);
  }
}

// visitList<N extends pass2.Internal, K extends N['name'] & keyof Pass2Internal, L extends N[]>(
//   node: L & N[]
// ): L extends PresentArray<N>
//   ? PresentArray<ReturnType<Pass2Internal[K]>>
//   : ReturnType<Pass2Internal[K]>[];

type MapList<
  V extends Pass2Visitor,
  O extends pass2.VisitableOp & { name: keyof V },
  L extends unknown[]
> = L extends PresentArray<unknown> ? PresentArray<MapItem<V, O['name']>> : MapItem<V, O['name']>[];

// type Map<N extends pass2.VisitableOp, V extends Pass2Visitor> = N['name'] extends keyof V
//   ? MapItem<V, N['name']>
//   : never;

type MapItem<V extends Pass2Visitor, K extends keyof V> = V[K] extends (...args: any[]) => any
  ? ReturnType<V[K]>
  : never;
