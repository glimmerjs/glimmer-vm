import { PresentArray } from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { ASTv2 } from '@glimmer/syntax';
import { assert, isPresent, LOCAL_LOGGER } from '@glimmer/util';
import { TemplateIdFn } from '../../compiler';
import { OptionalList } from '../../shared/list';
import { InputOpArgs, OpConstructor, toArgs, UnlocatedOp } from '../../shared/op';
import { Result } from '../../shared/result';
import { SourceOffsets } from '../../source/offsets';
import { Source } from '../../source/source';
import * as hir from '../2-symbol-allocation/hir';
import { VISIT_EXPRS } from './visitors/expressions';
import { VISIT_STMTS } from './visitors/statements';

/** VISITOR DEFINITIONS */

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
    return VISIT_STMTS.visitList(node.body, this).mapOk((stmts) =>
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

/**
 * This is the mutable state for this compiler pass.
 */
export class NormalizationState {
  constructor(private cursorCount = 0) {}

  generateUniqueCursor(): string {
    return `%cursor:${this.cursorCount++}%`;
  }
}

type VisitableHirOp = hir.Statement | hir.Expr | hir.Internal;
export type HirStmt = hir.Statement | hir.Ignore;
type HirOp = VisitableHirOp | hir.Ignore;

interface OutOps {
  statement: hir.Statement;
  expression: hir.Expr;
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

  visit<N extends ASTv2.Node, U>(
    desc: keyof OutOps,
    node: N,
    callback: (node: N, ctx: VisitorContext) => Result<U>
  ): Result<U> {
    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.groupCollapsed(`pass0: visiting ${desc}`, node.type);
      LOCAL_LOGGER.log(`node`, node);
    }

    let result = callback(node, this.context);

    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.log(`-> out   `, node);
      LOCAL_LOGGER.groupEnd();
    }

    return result;
  }

  op<O extends HirOp>(op: OpConstructor<O>, ...args: InputOpArgs<O>): UnlocatedOp<O> {
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
      list: OptionalList(list.map((expr) => VISIT_EXPRS.visit(expr, this.context))),
    }).offsets(offsets);
  }

  hash(hash: ASTv2.Hash): hir.NamedArguments {
    let mappedPairs = OptionalList(hash.pairs).map((pair) =>
      this.op(hir.NamedArgument, {
        key: this.slice(pair.key).offsets(offsetsForHashKey(pair, this.ctx.source)),
        value: VISIT_EXPRS.visit(pair.value, this.context),
      }).loc(pair)
    );

    return this.op(hir.NamedArguments, { pairs: mappedPairs }).loc(hash);
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
