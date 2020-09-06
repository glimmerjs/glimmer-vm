import { PresentArray } from '@glimmer/interfaces';
import { GlimmerSyntaxError } from '@glimmer/syntax';
import { mapPresent, NonemptyStack } from '@glimmer/util';
import * as pass2 from '../pass2/ops';
import { offsetsToLocation, SourceOffsets } from '../shared/location';
import { InputOpArgs, OpArgs, OpConstructor, UnlocatedOp } from '../shared/op';
import { OpFactory, Ops } from '../shared/ops';
import { ProgramSymbolTable, SymbolTable } from '../shared/symbol-table';
import { Pass1Expression } from './expressions';
import { Pass1Internal } from './internal';
import * as pass1 from './ops';
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

type MappingVisitorFunc<V extends Pass1Visitor, In extends pass1.AnyOp & { name: keyof V }> = (
  ctx: Context,
  op: OpArgs<In>
) => MapOutput<V, In>;

export type MapVisitorsInterface<
  In extends pass1.AnyOp = pass1.AnyOp,
  Out extends pass2.Op = pass2.Op
> = {
  [P in In['name']]: In extends { name: P } ? (ctx: Context, op: OpArgs<In>) => Out : never;
};

export type InForVisitor<V extends Pass1Visitor> = V extends MapVisitorsInterface<infer In>
  ? In
  : never;

export type MapOutput<
  V extends Pass1Visitor,
  In extends pass1.AnyOp & { name: keyof V }
> = V[In['name']] extends (...args: any[]) => any ? ReturnType<V[In['name']]> : never;

function visit<In extends pass1.AnyOp & { name: keyof V }, V extends Pass1Visitor>(
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
  readonly factory: OpFactory<pass2.Op>;

  constructor(
    readonly source: string,
    symbols: ProgramSymbolTable,
    readonly visitor: Pass1VisitorMap
  ) {
    this.factory = new OpFactory(source);
    this.state = new CompilerState(symbols);
  }

  forOffsets(offsets: SourceOffsets | null): Context {
    return new Context(this, offsets);
  }
}

/**
 * All state in this object except the CompilerState must be readonly.
 *
 * This object, and not a copy of it, must be passed around to helper functions. The
 * `CompilerHelper`, on the other hand, does not need to share an identity since it
 * has no mutable state at all.
 */
export class Context {
  constructor(readonly ctx: CompilerContext, readonly offsets: SourceOffsets | null) {}

  get symbols(): NonemptyStack<SymbolTable> {
    return this.ctx.state.symbols;
  }

  get templateSymbols(): ProgramSymbolTable {
    return this.symbols.nth(0) as ProgramSymbolTable;
  }

  get table(): SymbolTable {
    return this.symbols.current;
  }

  cursor(): string {
    return this.ctx.state.cursor();
  }

  error(message: string, offsets = this.offsets): SyntaxError {
    return new GlimmerSyntaxError(
      message,
      offsets ? offsetsToLocation(this.ctx.source, offsets) : null
    );
  }

  template(...args: InputOpArgs<pass2.Template>): UnlocatedOp<pass2.Template> {
    let factory = new OpFactory<pass2.Template>(this.ctx.source);

    return factory.op(pass2.Template, ...args);
  }

  setHasEval(): void {
    this.templateSymbols.setHasEval();
  }

  op<O extends pass2.Op>(name: OpConstructor<O>, ...args: InputOpArgs<O>): O {
    return this.unlocatedOp(name, ...args).offsets(this.offsets);
  }

  unlocatedOp<O extends pass2.Op>(name: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return this.ctx.factory.op(name, ...args);
  }

  ops<O extends pass2.Op>(...ops: Ops<O>[]): O[] {
    return this.ctx.factory.ops(...ops);
  }

  mapStmts<T>(input: T[], callback: (input: T) => pass2.Statement[]): pass2.Statement[] {
    return this.ctx.factory.flatMap(input, callback);
  }

  visitExprs<T extends pass1.Expr>(input: PresentArray<T>): PresentArray<pass2.Expr> {
    return input.map((e) => this.visitExpr(e)) as PresentArray<pass2.Expr>;
  }

  visitInternals<T extends Exclude<pass1.Internal, pass1.Ignore>>(
    input: PresentArray<T>
  ): PresentArray<MapOutput<Pass1Internal, T>> {
    return mapPresent(input, (e) => this.visitInternal(e));
  }

  map<T, Out extends pass2.Op>(
    input: PresentArray<T>,
    callback: (input: T) => Out
  ): PresentArray<Out>;
  map<T, Out extends pass2.Op>(input: T[], callback: (input: T) => Out): Out[];
  map<T, Out extends pass2.Op>(input: T[], callback: (input: T) => Out): Out[] {
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
  visitOptionalExpr(node: pass1.Expr | undefined): pass2.Expr {
    if (node === undefined) {
      return this.op(pass2.Missing);
    } else {
      return this.visitExpr(node);
    }
  }

  visitParams(list: PresentArray<pass1.Expr>): pass2.Positional {
    let params = this.map(list, (expr) => this.visitExpr(expr));
    return this.op(pass2.Positional, { list: params });
  }

  visitExpr(node: pass1.Expr): pass2.Expr {
    return visit(this.ctx.visitor.expressions, node, this);
  }

  visitInternal<N extends Exclude<pass1.Internal, pass1.Ignore>>(
    node: N
  ): MapOutput<Pass1Internal, N> {
    return visit(this.ctx.visitor.internal, node, this);
  }

  visitStmt<N extends pass1.Statement>(node: N): MapOutput<Pass1Statement, N>;
  visitStmt(node: pass1.Statement): pass2.Statement {
    return visit(this.ctx.visitor.statements, node, this);
  }

  visitArgs({
    params,
    hash,
  }: {
    params: pass1.AnyParams;
    hash: pass1.AnyNamedArguments;
  }): pass2.Args {
    let mappedParams = this.visitInternal(params);
    let mappedHash = this.visitInternal(hash);

    return this.op(pass2.Args, { positional: mappedParams, named: mappedHash });
  }

  params(params: pass1.AnyParams): pass2.Internal {
    return this.visitInternal(params);
  }
}
