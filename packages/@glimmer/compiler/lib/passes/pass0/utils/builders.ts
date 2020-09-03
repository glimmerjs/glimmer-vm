import { ExpressionContext } from '@glimmer/interfaces';
import { AST } from '@glimmer/syntax';
import { isPresent, mapPresent } from '@glimmer/util';
import * as pass1 from '../../pass1/ops';
import { Context, offsetsForHashKey, paramsOffsets } from '../context';

export function buildArgs(
  ctx: Context,
  {
    path,
    params: exprs,
    hash: named,
  }: {
    path: AST.Expression;
    params: AST.Expression[];
    hash: AST.Hash;
  }
): { params: pass1.Params; hash: pass1.Hash } {
  return { params: buildParams(ctx, { path, params: exprs }), hash: buildHash(ctx, named) };
}

export function buildParams(
  ctx: Context,
  { path, params: list }: { path: AST.Expression; params: AST.Expression[] }
): pass1.Params {
  let offsets = paramsOffsets({ path, params: list }, ctx.source);

  if (!isPresent(list)) {
    return ctx.expr(pass1.Params, { list: null }).offsets(offsets);
  }

  return ctx
    .expr(pass1.Params, {
      list: ctx.mapIntoExprs(list, (expr) => [ctx.visitExpr(expr, ExpressionContext.Expression)]),
    })
    .offsets(offsets);
}

export function buildHash(ctx: Context, hash: AST.Hash): pass1.Hash {
  let pairs = hash.pairs;

  if (!isPresent(pairs)) {
    return ctx.expr(pass1.Hash, { pairs: [] }).loc(hash);
  }

  let mappedPairs = ctx.mapIntoExprs<pass1.HashPair, AST.HashPair>(pairs, (pair) => [
    ctx
      .expr(pass1.HashPair, {
        key: ctx.slice(pair.key).offsets(offsetsForHashKey(pair, ctx.source)),
        value: ctx.visitExpr(pair.value, ExpressionContext.Expression),
      })
      .loc(pair),
  ]);

  return ctx.expr(pass1.Hash, { pairs: mappedPairs }).loc(hash);
}

export function buildPathWithContext(
  ctx: Context,
  path: AST.PathExpression,
  context: ExpressionContext
): pass1.Expr {
  let { parts } = path;
  if (path.data) {
    return argPath(ctx, `@${parts[0]}`, parts.slice(1), path);
  } else if (path.this) {
    return thisPath(ctx, parts, path);
  } else {
    return varPath(ctx, parts[0], parts.slice(1), path, context);
  }
}

function buildPath(ctx: Context, head: pass1.Expr, tail: string[], node: AST.BaseNode): pass1.Expr {
  if (isPresent(tail)) {
    return ctx
      .expr(pass1.Path, { head, tail: mapPresent(tail, (e) => ctx.slice(e).offsets(null)) })
      .loc(node);
  } else {
    return head;
  }
}

function argPath(ctx: Context, head: string, tail: string[], node: AST.BaseNode): pass1.Expr {
  return buildPath(
    ctx,
    ctx.expr(pass1.GetArg, { name: ctx.slice(head).offsets(null) }).offsets(null),
    tail,
    node
  );
}

function varPath(
  ctx: Context,
  head: string,
  tail: string[],
  node: AST.BaseNode,
  context: ExpressionContext
): pass1.Expr {
  return buildPath(
    ctx,
    ctx.expr(pass1.GetVar, { name: ctx.slice(head).offsets(null), context }).offsets(null),
    tail,
    node
  );
}

function thisPath(ctx: Context, tail: string[], node: AST.BaseNode): pass1.Expr {
  return buildPath(ctx, ctx.expr(pass1.GetThis).offsets(null), tail, node);
}
