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
): { params: pass1.AnyParams; hash: pass1.AnyNamedArguments } {
  return { params: buildParams(ctx, { path, params: exprs }), hash: buildHash(ctx, named) };
}

export function buildParams(
  ctx: Context,
  { path, params: list }: { path: AST.Expression; params: AST.Expression[] }
): pass1.AnyParams {
  let offsets = paramsOffsets({ path, params: list }, ctx.source);

  if (!isPresent(list)) {
    return ctx.op(pass1.EmptyParams).offsets(offsets);
  }

  return ctx
    .op(pass1.Params, {
      list: ctx.mapIntoExprs(list, (expr) => [ctx.visitExpr(expr, ExpressionContext.Expression)]),
    })
    .offsets(offsets);
}

export function buildHash(ctx: Context, hash: AST.Hash): pass1.AnyNamedArguments {
  let pairs = hash.pairs;

  if (!isPresent(pairs)) {
    return ctx.op(pass1.EmptyNamedArguments).loc(hash);
  }

  let mappedPairs = ctx.mapIntoExprs<pass1.NamedArgument, AST.HashPair>(pairs, (pair) => [
    ctx
      .op(pass1.NamedArgument, {
        key: ctx.slice(pair.key).offsets(offsetsForHashKey(pair, ctx.source)),
        value: ctx.visitExpr(pair.value, ExpressionContext.Expression),
      })
      .loc(pair),
  ]);

  return ctx.op(pass1.NamedArguments, { pairs: mappedPairs }).loc(hash);
}

export function buildPathWithContext(
  ctx: Context,
  path: AST.PathExpression,
  context: ExpressionContext
): pass1.Expr {
  let { tail: parts, head } = path;
  if (head.type === 'AtHead') {
    return argPath(ctx, `@${head.name}`, parts, path);
  } else if (head.type === 'ThisHead') {
    return thisPath(ctx, parts, path);
  } else {
    return varPath(ctx, head.name, parts, path, context);
  }
}

function buildPath(ctx: Context, head: pass1.Expr, tail: string[], node: AST.BaseNode): pass1.Expr {
  if (isPresent(tail)) {
    return ctx
      .op(pass1.Path, { head, tail: mapPresent(tail, (e) => ctx.slice(e).offsets(null)) })
      .loc(node);
  } else {
    return head;
  }
}

function argPath(ctx: Context, head: string, tail: string[], node: AST.BaseNode): pass1.Expr {
  return buildPath(
    ctx,
    ctx.op(pass1.GetArg, { name: ctx.slice(head).offsets(null) }).offsets(null),
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
  if (context === ExpressionContext.AppendSingleId) {
    return buildPath(
      ctx,
      ctx.op(pass1.GetSloppy, { name: ctx.slice(head).offsets(null) }).offsets(null),
      tail,
      node
    );
  } else {
    return buildPath(
      ctx,
      ctx.op(pass1.GetVar, { name: ctx.slice(head).offsets(null), context }).offsets(null),
      tail,
      node
    );
  }
}

function thisPath(ctx: Context, tail: string[], node: AST.BaseNode): pass1.Expr {
  return buildPath(ctx, ctx.op(pass1.GetThis).offsets(null), tail, node);
}
