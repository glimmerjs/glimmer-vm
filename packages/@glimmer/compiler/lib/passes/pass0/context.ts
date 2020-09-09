import { ExpressionContext, Optional, PresentArray } from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { AST, GlimmerSyntaxError } from '@glimmer/syntax';
import { assert, isPresent, LOCAL_LOGGER, NonemptyStack } from '@glimmer/util';
import { TemplateIdFn } from '../../compiler';
import { OptionalList } from '../../shared/list';
import { InputOpArgs, OpConstructor, UnlocatedOp } from '../../shared/op';
import { OpFactory } from '../../shared/ops';
import { Err, intoResult, MaybeResult, Ok, Result, ResultArray } from '../../shared/result';
import { BlockSymbolTable, SymbolTable } from '../../shared/symbol-table';
import { SourceOffsets } from '../../source/offsets';
import { Source } from '../../source/source';
import * as pass1 from '../pass1/ops';
import { buildPathWithContext } from './utils/builders';
import { TemporaryNamedBlock } from './visitors/element/temporary-block';
import { Pass0Expressions } from './visitors/expressions';
import { Pass0Statements } from './visitors/statements';

/** VISITOR DEFINITIONS */

type Pass0Visitor = Pass0Expressions | Pass0Statements;

export type VisitorInterface<O extends AST.Node, Out = unknown> = {
  [P in O['type']]: (node: O & { type: P }, ctx: Context) => Out | Result<Out>;
};

type VisitorFunc<V extends Pass0Visitor, N extends keyof V & keyof AST.Nodes> = (
  node: AST.Node & AST.Nodes[N],
  ctx: Context
) => VisitorReturn<V, N>;

type ResultVisitorReturn<
  V extends Pass0Visitor,
  N extends keyof V & keyof AST.Nodes = keyof V & keyof AST.Nodes
> = V[N] extends (...args: any[]) => infer R
  ? R extends Pass1Op
    ? Result<R>
    : R extends Result<Pass1Op>
    ? R
    : never
  : never;

type VisitorReturn<
  V extends Pass0Visitor,
  N extends keyof V & keyof AST.Nodes = keyof V & keyof AST.Nodes
> = V[N] extends (...args: any[]) => infer R
  ? R extends Pass1Op | Result<Pass1Op>
    ? R
    : never
  : never;

export interface ImmutableContext {
  slice(value: string): UnlocatedOp<pass1.SourceSlice>;
}

/**
 * This is the mutable state for this compiler pass.
 */
export class CompilerState {
  readonly symbols: NonemptyStack<SymbolTable> = new NonemptyStack([SymbolTable.top()]);
  private cursorCount = 0;

  cursor(): string {
    return `%cursor:${this.cursorCount++}%`;
  }
}

export interface GlimmerCompileOptions extends PrecompileOptions {
  id?: TemplateIdFn;
  meta?: object;
  customizeComponentName?(input: string): string;
}

type VisitablePass1Op = pass1.Statement | pass1.Expr | pass1.Internal;
export type Pass1Stmt = pass1.Statement | pass1.Ignore;
type Pass1Op = VisitablePass1Op | pass1.Ignore;

/**
 * All state in this object except the CompilerState must be readonly.
 *
 * This object, and not a copy of it, must be passed around to helper functions. The
 * `CompilerHelper`, on the other hand, does not need to share an identity since it
 * has no mutable state at all.
 */
export class Context implements ImmutableContext {
  readonly statements: Pass0Statements;
  readonly expressions: Pass0Expressions;
  readonly state = new CompilerState();
  private factory: OpFactory<Pass1Op>;

  constructor(
    readonly source: Source,
    readonly options: GlimmerCompileOptions,
    visitor: { statements: Pass0Statements; expressions: Pass0Expressions }
  ) {
    this.statements = visitor.statements;
    this.expressions = visitor.expressions;
    this.factory = new OpFactory(source);
  }

  get symbols(): NonemptyStack<SymbolTable> {
    return this.state.symbols;
  }

  componentName(input: string): pass1.SourceSlice {
    if (this.options.customizeComponentName) {
      return this.slice(this.options.customizeComponentName(input)).offsets(null);
    } else {
      return this.slice(input).offsets(null);
    }
  }

  cursor(): string {
    return this.state.cursor();
  }

  op<O extends Pass1Op>(name: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return this.factory.op(name, ...args);
  }

  slice(value: string): UnlocatedOp<pass1.SourceSlice> {
    return new UnlocatedOp(pass1.SourceSlice, { value }, this.source);
  }

  visitAmbiguousStmts<S extends AST.Statement>(
    statements: S[]
  ): Result<(pass1.Statement | TemporaryNamedBlock)[]> {
    let out = new ResultArray<pass1.Statement | TemporaryNamedBlock>();

    for (let statement of statements) {
      this.visitAmbiguousStmt(statement)
        .ifOk((s) => {
          switch (s.name) {
            case 'Ignore':
              break;
            default:
              out.add(Ok(s));
          }
        })
        .ifErr((err) => out.add(Err(err)));
    }

    return out.toArray();
  }

  visitStmts<S extends AST.Statement>(statements: S[]): Result<pass1.Statement[]> {
    let out = new ResultArray<pass1.Statement>();

    for (let statement of statements) {
      this.visitStmt(statement)
        .ifOk((s) => {
          switch (s.name) {
            case 'Ignore':
              break;
            default:
              out.add(Ok(s));
          }
        })
        .ifErr((err) => out.add(Err(err)));
    }

    return out.toArray();
  }

  append(expr: pass1.Expr, { trusted }: { trusted: boolean }): UnlocatedOp<pass1.Statement> {
    if (trusted) {
      return this.op(pass1.AppendTrustedHTML, {
        value: expr,
      });
    } else {
      return this.op(pass1.AppendTextNode, {
        value: expr,
      });
    }
  }

  mapIntoExprs<E extends pass1.Expr | pass1.Internal, T>(
    input: PresentArray<T>,
    callback: (input: T) => E[]
  ): PresentArray<E>;
  mapIntoExprs<E extends pass1.Expr | pass1.Internal, T>(
    input: Optional<PresentArray<T>>,
    callback: (input: T) => E[]
  ): Optional<PresentArray<E>>;
  mapIntoExprs<E extends pass1.Expr | pass1.Internal, T>(
    input: Optional<PresentArray<T>>,
    callback: (input: T) => E[]
  ): Optional<PresentArray<E>> {
    if (input === null) {
      return null;
    } else {
      return this.factory.flatMap(input, callback) as PresentArray<E>;
    }
  }

  withBlock<T>(
    block: AST.Block | AST.ElementNode | AST.Template,
    callback: (symbols: BlockSymbolTable, parent: SymbolTable) => T
  ): T {
    let parent = this.symbols.current;
    let child = this.symbols.current.child(block.blockParams);
    this.symbols.push(child);

    try {
      return callback(child, parent);
    } finally {
      this.symbols.pop();
    }
  }

  visitExpr<N extends keyof Pass0Expressions & keyof AST.Nodes>(
    node: AST.Node & AST.Nodes[N]
  ): VisitorReturn<Pass0Expressions, N>;
  visitExpr<N extends keyof Pass0Expressions & keyof AST.Nodes>(
    node: AST.Node & AST.Nodes[N],
    context: ExpressionContext
  ): VisitorReturn<Pass0Expressions>;
  visitExpr<N extends keyof Pass0Expressions & keyof AST.Nodes>(
    node: AST.Node & AST.Nodes[N],
    context: ExpressionContext = ExpressionContext.Expression
  ): VisitorReturn<Pass0Expressions> {
    if (node.type === 'PathExpression') {
      return buildPathWithContext(this, node, context);
    } else {
      if (LOCAL_SHOULD_LOG) {
        LOCAL_LOGGER.groupCollapsed(`pass0: visiting expr`, node.type);
        LOCAL_LOGGER.log(`node`, node);
      }

      let f = this.expressions[node.type] as VisitorFunc<Pass0Expressions, N>;
      let result = f(node, this);

      if (LOCAL_SHOULD_LOG) {
        LOCAL_LOGGER.log(`-> out   `, node);
        LOCAL_LOGGER.groupEnd();
      }

      return result;
    }
  }

  visitAmbiguousStmt(node: AST.Statement): Result<Pass1Stmt | TemporaryNamedBlock>;
  visitAmbiguousStmt<N extends keyof Pass0Statements & keyof AST.Nodes>(
    node: AST.Node & AST.Nodes[N]
  ): Exclude<ResultVisitorReturn<Pass0Statements, N>, Result<pass1.NamedBlock>>;
  visitAmbiguousStmt(node: AST.Statement): Result<Pass1Stmt | TemporaryNamedBlock> {
    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.groupCollapsed(`pass0: visiting statement`, node.type);
      LOCAL_LOGGER.log(`node`, node);
    }

    let f = this.statements[node.type] as (
      node: AST.Statement,
      ctx: Context
    ) => MaybeResult<Pass1Stmt | TemporaryNamedBlock>;
    let result = f(node, this);

    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.log(`-> out   `, node);
      LOCAL_LOGGER.groupEnd();
    }

    return intoResult(result);
  }

  visitStmt(node: AST.Node): Result<Pass1Stmt>;
  visitStmt<N extends keyof Pass0Statements & AST.Statement['type']>(
    node: AST.Statement & { type: N }
  ): pass1.Statement & VisitorReturn<Pass0Statements, N>;
  visitStmt(node: AST.Statement): Result<Pass1Stmt> {
    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.groupCollapsed(`pass0: visiting statement`, node.type);
      LOCAL_LOGGER.log(`node`, node);
    }

    let f = this.statements[node.type] as (
      node: AST.Statement,
      ctx: Context
    ) => MaybeResult<Pass1Stmt | TemporaryNamedBlock>;
    let result = f(node, this);

    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.log(`-> out   `, node);
      LOCAL_LOGGER.groupEnd();
    }

    return intoResult(result).andThen((result) => {
      if (result instanceof TemporaryNamedBlock) {
        return Err(
          new GlimmerSyntaxError(
            `Invalid named block whose parent is not a component invocation`,
            node.loc
          )
        );
      }

      return Ok(result);
    });
  }

  block(name: pass1.SourceSlice, node: AST.Block): Result<pass1.NamedBlock> {
    return this.withBlock(node, (symbols) =>
      this.visitStmts(node.body).mapOk((stmts) =>
        this.op(pass1.NamedBlock, {
          name,
          table: symbols,
          body: stmts,
        }).loc(node)
      )
    );
  }

  args({
    path,
    params: exprs,
    hash: named,
  }: {
    path: AST.Expression;
    params: AST.Expression[];
    hash: AST.Hash;
  }): { params: pass1.Params; hash: pass1.NamedArguments } {
    return { params: this.params({ path, params: exprs }), hash: this.hash(named) };
  }

  params({ path, params: list }: { path: AST.Expression; params: AST.Expression[] }): pass1.Params {
    let offsets = paramsOffsets({ path, params: list }, this.source);

    return this.op(pass1.Params, {
      list: OptionalList(list.map((expr) => this.visitExpr(expr))),
    }).offsets(offsets);
  }

  hash(hash: AST.Hash): pass1.NamedArguments {
    let mappedPairs = OptionalList(hash.pairs).map((pair) =>
      this.op(pass1.NamedArgument, {
        key: this.slice(pair.key).offsets(offsetsForHashKey(pair, this.source)),
        value: this.visitExpr(pair.value, ExpressionContext.Expression),
      }).loc(pair)
    );

    // let mappedPairs = this.mapIntoExprs<pass1.NamedArgument, AST.HashPair>(pairs, (pair) => [
    //   this.op(pass1.NamedArgument, {
    //     key: this.slice(pair.key).offsets(offsetsForHashKey(pair, this.source)),
    //     value: this.visitExpr(pair.value, ExpressionContext.Expression),
    //   }).loc(pair),
    // ]);

    return this.op(pass1.NamedArguments, { pairs: mappedPairs }).loc(hash);
  }
}

export function paramsOffsets(
  { path, params }: { path: AST.Expression; params: AST.Expression[] },
  source: Source
): SourceOffsets {
  if (isPresent(params)) {
    return sourceOffsets(params as [AST.Expression, ...AST.Expression[]], source);
  } else {
    // position empty params after the first space after the path expression
    let pos = sourceOffsets(path, source).end + 1;
    return new SourceOffsets(pos, pos);
  }
}

export function offsetsForHashKey(pair: AST.HashPair, source: Source): SourceOffsets {
  let pairLoc = sourceOffsets(pair, source);
  let valueLoc = sourceOffsets(pair.value, source);

  assert(pairLoc !== null && valueLoc !== null, `unexpected missing location in HashPair`);

  return new SourceOffsets(
    pairLoc.start,
    // the grammar requires `key=value` with no whitespace around the `=`
    valueLoc.start - 1
  );
}

export function sourceOffsets(
  node: AST.BaseNode | [AST.BaseNode, ...AST.BaseNode[]],
  source: Source
): SourceOffsets {
  if (Array.isArray(node)) {
    let start = node[0];
    let end = node[node.length - 1];

    let startOffset = sourceOffsets(start, source)?.start;
    let endOffset = sourceOffsets(end, source)?.start;

    assert(
      startOffset !== undefined && endOffset !== undefined,
      `unexpectedly missing source offsets`
    );

    return new SourceOffsets(startOffset, endOffset);
  }

  let loc = node.loc;

  let { start, end } = loc;
  let startOffset = source.offsetFor({
    line: start.line - 1,
    column: start.column,
  });

  let endOffset = source.offsetFor({ line: end.line - 1, column: end.column });

  if (startOffset === null || endOffset === null) {
    return SourceOffsets.NONE;
  }

  return new SourceOffsets(startOffset, endOffset);
}
