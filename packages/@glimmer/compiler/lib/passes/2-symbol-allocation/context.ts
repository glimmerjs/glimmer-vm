import { PresentArray } from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import {
  GlimmerSyntaxError,
  ProgramSymbolTable,
  Source,
  SourceOffsets,
  SymbolTable,
} from '@glimmer/syntax';
import { LOCAL_LOGGER, mapPresent, NonemptyStack } from '@glimmer/util';
import { AnyOptionalList, MapList, OptionalList } from '../../shared/list';
import { InputOpArgs, OpArgs, OpConstructor, UnlocatedOp } from '../../shared/op';
import { OpFactory, Ops } from '../../shared/ops';
import * as mir from '../3-encoding/mir';
import { Pass1Expression } from './expressions';
import * as hir from './hir';
import { Pass1Internal } from './internal';
import { Pass1Statement } from './statements';

/**
 * This is the mutable state for this compiler pass.
 */
export class CompilerState {
  readonly symbols: NonemptyStack<SymbolTable>;
  private cursorCount = 0;

  constructor(readonly top: ProgramSymbolTable) {
    this.symbols = new NonemptyStack([top]);
  }

  cursor(): string {
    return `%cursor:${this.cursorCount++}%`;
  }
}

type MappingVisitorFunc<V extends Pass1Visitor, In extends hir.AnyOp & { name: keyof V }> = (
  ctx: Context,
  op: OpArgs<In>
) => MapOutput<V, In>;

export type MapVisitorsInterface<In extends hir.AnyOp = hir.AnyOp, Out extends mir.Op = mir.Op> = {
  [P in In['name']]: In extends { name: P } ? (ctx: Context, op: OpArgs<In>) => Out : never;
};

export type InForVisitor<V extends Pass1Visitor> = V extends MapVisitorsInterface<infer In>
  ? In
  : never;

export type MapOutput<
  V extends Pass1Visitor,
  In extends hir.AnyOp & { name: keyof V }
> = V[In['name']] extends (...args: any[]) => unknown ? ReturnType<V[In['name']]> : never;

function visit<In extends hir.AnyOp & { name: keyof V }, V extends Pass1Visitor>(
  visitors: V,
  node: In,
  ctx: Context
): MapOutput<V, In> {
  let f = (visitors[node.name as In['name']] as unknown) as MappingVisitorFunc<V, In>;
  return f(ctx, node.args as OpArgs<In>);
}

export interface Pass1VisitorMap {
  expressions: Pass1Expression;
  internal: Pass1Internal;
  statements: Pass1Statement;
}

type Pass1Visitor = Pass1VisitorMap[keyof Pass1VisitorMap];

export class CompilerContext {
  readonly state: CompilerState;
  readonly factory: OpFactory<mir.Op>;

  constructor(
    readonly source: Source,
    symbols: ProgramSymbolTable,
    readonly visitor: Pass1VisitorMap
  ) {
    this.factory = new OpFactory();
    this.state = new CompilerState(symbols);
  }

  forLoc(loc: SourceOffsets): Context {
    return new Context(this, loc);
  }
}

export interface AllocateTable {
  allocateFree(name: string): number;
  allocateNamed(name: string): number;
  allocateBlock(name: string): number;
  get(name: string): number;
}

/**
 * All state in this object except the CompilerState must be readonly.
 *
 * This object, and not a copy of it, must be passed around to helper functions. The
 * `CompilerHelper`, on the other hand, does not need to share an identity since it
 * has no mutable state at all.
 */
export class Context {
  constructor(readonly ctx: CompilerContext, readonly loc: SourceOffsets) {}

  get source(): Source {
    return this.ctx.source;
  }

  get symbols(): NonemptyStack<SymbolTable> {
    return this.ctx.state.symbols;
  }

  get templateSymbols(): ProgramSymbolTable {
    return this.symbols.nth(0) as ProgramSymbolTable;
  }

  get table(): AllocateTable {
    return this.symbols.current;
  }

  cursor(): string {
    return this.ctx.state.cursor();
  }

  error(message: string, offsets = this.loc): SyntaxError {
    return new GlimmerSyntaxError(message, offsets || null);
  }

  template(...args: InputOpArgs<mir.Template>): UnlocatedOp<mir.Template> {
    let factory = new OpFactory<mir.Template>();
    return factory.op(mir.Template, ...args);
  }

  setHasEval(): void {
    this.templateSymbols.setHasEval();
  }

  op<O extends mir.Op>(name: OpConstructor<O>, ...args: InputOpArgs<O>): O {
    return this.unlocatedOp(name, ...args).loc(this);
  }

  unlocatedOp<O extends mir.Op>(name: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return this.ctx.factory.op(name, ...args);
  }

  ops<O extends mir.Op>(...ops: Ops<O>[]): O[] {
    return this.ctx.factory.ops(...ops);
  }

  mapStmts<T>(input: T[], callback: (input: T) => mir.Statement[]): mir.Statement[] {
    return this.ctx.factory.flatMap(input, callback);
  }

  visitExprs<T extends hir.Expr, L extends AnyOptionalList<T>>(input: L): MapList<T, mir.Expr, L> {
    return input.map((e) => this.visitExpr(e)) as MapList<T, mir.Expr, L>;
  }

  visitInternals<T extends Exclude<hir.Internal, hir.Ignore>>(
    input: PresentArray<T>
  ): PresentArray<MapOutput<Pass1Internal, T>> {
    return mapPresent(input, (e) => this.visitInternal(e));
  }

  map<T, Out extends mir.Op>(
    input: PresentArray<T>,
    callback: (input: T) => Out
  ): PresentArray<Out>;
  map<T, Out extends mir.Op>(input: T[], callback: (input: T) => Out): Out[];
  map<T, Out extends mir.Op>(input: T[], callback: (input: T) => Out): Out[] {
    return this.ctx.factory.map(input, callback);
  }

  withBlock<T>(symbols: SymbolTable, callback: () => T): T {
    this.symbols.push(symbols);

    try {
      return callback();
    } finally {
      this.symbols.pop();
    }
  }

  /**
   * This method visits a possibly missing expression, ensuring that a stack value
   * will be on the stack for pass2 to pop off.
   */
  visitOptionalExpr(node: hir.Expr | undefined): mir.Expr {
    if (node === undefined) {
      return this.op(mir.Missing);
    } else {
      return this.visitExpr(node);
    }
  }

  visitParams(list: OptionalList<hir.Expr>): mir.Positional {
    let params = list.map((expr) => this.visitExpr(expr));
    return this.op(mir.Positional, { list: params });
  }

  visitExpr(node: hir.Expr): mir.Expr {
    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.groupCollapsed(`pass1: visiting expr`, node.name);
      LOCAL_LOGGER.log(`expr`, node);
    }

    let result = visit(this.ctx.visitor.expressions, node, this);

    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.log(`-> pass1: out`, result);
      LOCAL_LOGGER.groupEnd();
    }
    return result;
  }

  visitInternal<N extends Exclude<hir.Internal, hir.Ignore>>(node: N): MapOutput<Pass1Internal, N> {
    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.groupCollapsed(`pass1: visiting internal`, node.name);
      LOCAL_LOGGER.log(`internal`, node);
    }

    let result = visit(this.ctx.visitor.internal, node, this);

    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.log(`-> pass1: out`, result);
      LOCAL_LOGGER.groupEnd();
    }
    return result;
  }

  visitStmt<N extends hir.Statement>(node: N): MapOutput<Pass1Statement, N>;
  visitStmt(node: hir.Statement): mir.Statement {
    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.groupCollapsed(`pass1: visiting statement`, node.name);
      LOCAL_LOGGER.log(`statement`, node);
    }

    let result = visit(this.ctx.visitor.statements, node, this);

    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.log(`-> pass1: out`, result);
      LOCAL_LOGGER.groupEnd();
    }
    return result;
  }

  visitArgs({ params, hash }: { params: hir.Positional; hash: hir.Named }): mir.Args {
    let mappedParams = this.visitInternal(params);
    let mappedHash = this.visitInternal(hash);

    return this.op(mir.Args, { positional: mappedParams, named: mappedHash });
  }

  params(params: hir.Positional): mir.Internal {
    return this.visitInternal(params);
  }
}
