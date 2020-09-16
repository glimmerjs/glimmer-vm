import { PresentArray } from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { assert, isPresent, LOCAL_LOGGER } from '@glimmer/util';
import { TemplateIdFn } from '../../compiler';
import { OptionalList } from '../../shared/list';
import { InputOpArgs, OpConstructor, toArgs, UnlocatedOp } from '../../shared/op';
import { Err, intoResult, MaybeResult, Ok, Result, ResultArray } from '../../shared/result';
import { SourceOffsets } from '../../source/offsets';
import { Source } from '../../source/source';
import * as hir from '../pass1/hir';
import { EXPR_KEYWORDS } from './keywords';
import { APPEND_KEYWORDS } from './keywords/append';
import { BLOCK_KEYWORDS } from './keywords/block';
import { ExpressionOut, EXPRESSIONS, isExpr, Pass0Expressions } from './visitors/expressions';
import { isStatement, Pass0Statements, Pass1Out, STATEMENTS } from './visitors/statements';

/** VISITOR DEFINITIONS */

type Pass0Visitor = Pass0Expressions | Pass0Statements;

/**
 * This class defines the core high-level operations for interacting with the
 * NormalizationState.
 */
export class VisitorContext {
  constructor(readonly ctx: NormalizationContext, private state: NormalizationState) {}

  get utils(): NormalizationUtilities {
    return new NormalizationUtilities(this.ctx, this.state);
  }

  generateUniqueCursor(): string {
    return this.state.generateUniqueCursor();
  }

  block(name: hir.SourceSlice, node: ASTv2.Block): Result<hir.NamedBlock> {
    return this.utils.visitStmts(node.body).mapOk((stmts) =>
      new UnlocatedOp(
        hir.NamedBlock,
        {
          name,
          table: node.table,
          body: stmts,
        },
        this.ctx.source
      ).loc(node)
    );
  }
}

export type VisitorInterface<O extends ASTv2.Node, Out = unknown> = {
  [P in O['type']]: (node: O & { type: P }, ctx: VisitorContext) => MaybeResult<Out>;
};

export type InfallibleVisitorInterface<O extends ASTv2.Node, Out = unknown> = {
  [P in O['type']]: (node: O & { type: P }, ctx: VisitorContext) => Out;
};

type VisitorReturn<
  V extends Pass0Visitor,
  N extends keyof V & keyof ASTv2.Nodes = keyof V & keyof ASTv2.Nodes
> = V[N] extends (...args: any[]) => infer R
  ? R extends Pass1Op | Result<Pass1Op>
    ? R
    : never
  : never;

/**
 * This is the mutable state for this compiler pass.
 */
export class NormalizationState {
  constructor(private cursorCount = 0) {}

  generateUniqueCursor(): string {
    return `%cursor:${this.cursorCount++}%`;
  }
}

type VisitablePass1Op = hir.Statement | hir.Expr | hir.Internal;
export type Pass1Stmt = hir.Statement | hir.Ignore;
type Pass1Op = VisitablePass1Op | hir.Ignore;

interface OutOps {
  statement: Pass1Out;
  expression: ExpressionOut;
}

export interface GlimmerCompileOptions extends PrecompileOptions {
  id?: TemplateIdFn;
  meta?: object;
  customizeComponentName?(input: string): string;
}

/**
 * This object provides the core operations for normalization.
 *
 * It is not stateful: all mutable state used by the compiler is stored in
 * `NormalizationState`.
 *
 * The `NormalizationUtilities` below provide a convenient interface to the
 * node visitors for processing `@glimmer/syntax` AST nodes.
 */
export class NormalizationContext {
  constructor(readonly source: Source, readonly options: GlimmerCompileOptions) {}
}

function visit<K extends keyof OutOps>(
  desc: K,
  node: ASTv2.Node,
  ctx: VisitorContext
): Result<OutOps[K]> {
  if (LOCAL_SHOULD_LOG) {
    LOCAL_LOGGER.groupCollapsed(`pass0: visiting ${desc}`, node.type);
    LOCAL_LOGGER.log(`node`, node);
  }

  let result: MaybeResult<OutOps[keyof OutOps]>;

  if (isStatement(node)) {
    if (BLOCK_KEYWORDS.match(node)) {
      result = BLOCK_KEYWORDS.translate(node, ctx);
    } else if (APPEND_KEYWORDS.match(node)) {
      result = APPEND_KEYWORDS.translate(node, ctx);
    } else {
      result = STATEMENTS.visit(node, ctx);
    }
  } else if (isExpr(node)) {
    if (EXPR_KEYWORDS.match(node)) {
      result = EXPR_KEYWORDS.translate(node, ctx);
    } else {
      result = EXPRESSIONS.visit(node, ctx);
    }
  } else {
    throw new Error(
      `Attempted to visit a ${node.type}, but it wasn't handled by STATEMENTS or EXPRESSIONS`
    );
  }

  if (LOCAL_SHOULD_LOG) {
    LOCAL_LOGGER.log(`-> out   `, node);
    LOCAL_LOGGER.groupEnd();
  }

  return intoResult(result) as Result<OutOps[K]>;
}

/**
 * This class provides useful utilities to the visitors. None of the methods on this
 * class should work directly with the state in the Context.
 */
export class NormalizationUtilities {
  constructor(private ctx: NormalizationContext, private state: NormalizationState) {}

  get context(): VisitorContext {
    return new VisitorContext(this.ctx, this.state);
  }

  get source(): Source {
    return this.ctx.source;
  }

  op<O extends Pass1Op>(op: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
    return new UnlocatedOp(op, toArgs(args), this.ctx.source);
  }

  slice(value: string): UnlocatedOp<hir.SourceSlice> {
    return new UnlocatedOp(hir.SourceSlice, { value }, this.ctx.source);
  }

  componentName(input: string): hir.SourceSlice {
    if (this.ctx.options.customizeComponentName) {
      return this.slice(this.ctx.options.customizeComponentName(input)).offsets(null);
    } else {
      return this.slice(input).offsets(null);
    }
  }

  append(expr: hir.Expr, { trusted }: { trusted: boolean }): UnlocatedOp<hir.Statement> {
    if (trusted) {
      return this.op(hir.AppendTrustedHTML, {
        value: expr,
      });
    } else {
      return this.op(hir.AppendTextNode, {
        value: expr,
      });
    }
  }

  args({
    func,
    params: exprs,
    hash: named,
  }: {
    func: ASTv2.Expression;
    params: ASTv2.InternalExpression[];
    hash: ASTv2.Hash;
  }): { params: hir.Params; hash: hir.NamedArguments } {
    return { params: this.params({ func, params: exprs }), hash: this.hash(named) };
  }

  params({
    func,
    params: list,
  }: {
    func: ASTv2.Expression;
    params: ASTv2.InternalExpression[];
  }): hir.Params {
    let offsets = paramsOffsets({ path: func, params: list }, this.ctx.source);

    return this.op(hir.Params, {
      list: OptionalList(list.map((expr) => this.visitExpr(expr))),
    }).offsets(offsets);
  }

  hash(hash: ASTv2.Hash): hir.NamedArguments {
    let mappedPairs = OptionalList(hash.pairs).map((pair) =>
      this.op(hir.NamedArgument, {
        key: this.slice(pair.key).offsets(offsetsForHashKey(pair, this.ctx.source)),
        value: this.visitExpr(pair.value),
      }).loc(pair)
    );

    return this.op(hir.NamedArguments, { pairs: mappedPairs }).loc(hash);
  }

  /**
   * Visit a single statement, returning a hir.Statement or an Ignore.
   *
   * Error conditions:
   *
   * - the visitor for the ASTv2.Statement returns an error
   * - allowNamedBlock is not true and the ASTv2.Statement resolves to a
   *   named block
   */
  visitStmt<N extends keyof Pass0Statements & ASTv2.Statement['type']>(
    node: ASTv2.Statement & { type: N }
  ): Result<Pass1Stmt> & VisitorReturn<Pass0Statements, N>;
  visitStmt<N extends keyof Pass0Statements & ASTv2.Statement['type']>(
    node: ASTv2.Statement & { type: N },
    options: { allowNamedBlock: true }
  ): VisitorReturn<Pass0Statements, N>;
  visitStmt(
    node: ASTv2.Statement,
    options: { allowNamedBlock: true }
  ): Result<Pass1Stmt | hir.NamedBlock>;
  visitStmt(node: ASTv2.Statement): Result<Pass1Stmt>;
  visitStmt(
    node: ASTv2.Statement,
    options?: { allowNamedBlock: true }
  ): Result<Pass1Stmt | hir.NamedBlock>;
  visitStmt(
    node: ASTv2.Statement,
    options?: { allowNamedBlock: true }
  ): Result<Pass1Stmt | hir.NamedBlock> {
    let result = visit('statement', node, this.context);
    let rejectNamedBlock = !options;

    return result.andThen((result) => {
      if (rejectNamedBlock && result instanceof hir.NamedBlock) {
        return Err(
          new GlimmerSyntaxError(
            `Invalid named block whose parent is not a component invocation`,
            node.loc
          )
        );
      }

      return Ok(result as Pass1Stmt);
    });
  }

  visitExpr<N extends keyof Pass0Expressions & keyof ASTv2.Nodes>(
    node: ASTv2.Node & ASTv2.Nodes[N]
  ): ExpressionOut {
    return visit('expression', node, this.context).expect('expressions should not return results');
  }
  /**
   * Visit a list of statements, returning a list of `hir.Statement`.
   */
  visitStmts(
    statements: ASTv2.NamedBlock[],
    options: { allowNamedBlock: true }
  ): Result<hir.NamedBlock[]>;
  visitStmts<S extends ASTv2.Statement>(statements: S[]): Result<hir.Statement[]>;
  visitStmts<S extends ASTv2.Statement>(
    statements: S[],
    options: { allowNamedBlock: true }
  ): Result<(hir.Statement | hir.NamedBlock)[]>;
  visitStmts(
    statements: ASTv2.Statement[],
    options?: { allowNamedBlock: true }
  ): Result<(hir.Statement | hir.NamedBlock)[]> {
    let out = new ResultArray<hir.Statement | hir.NamedBlock>();

    for (let statement of statements) {
      this.visitStmt(statement, options)
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
}

export function paramsOffsets(
  { path, params }: { path: ASTv2.InternalExpression; params: ASTv2.InternalExpression[] },
  source: Source
): SourceOffsets {
  if (isPresent(params)) {
    return source.offsetsFor(params as PresentArray<ASTv2.InternalExpression>);
  } else {
    // position empty params after the first space after the path expression
    let pos = source.offsetsFor(path).end + 1;
    return new SourceOffsets(pos, pos);
  }
}

export function offsetsForHashKey(pair: ASTv2.HashPair, source: Source): SourceOffsets {
  let pairLoc = source.offsetsFor(pair);
  let valueLoc = source.offsetsFor(pair.value);

  assert(pairLoc !== null && valueLoc !== null, `unexpected missing location in HashPair`);

  return new SourceOffsets(
    pairLoc.start,
    // the grammar requires `key=value` with no whitespace around the `=`
    valueLoc.start - 1
  );
}
