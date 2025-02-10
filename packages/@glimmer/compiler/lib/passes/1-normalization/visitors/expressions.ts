import type { PresentArray } from '@glimmer/interfaces';
import { exhausted, getLast, isPresentArray } from '@glimmer/debug-util';
import { ASTv2, generateSyntaxError, KEYWORDS_TYPES } from '@glimmer/syntax';

import type { AnyOptionalList, PresentList } from '../../../shared/list';
import type { NormalizationState } from '../context';

import { Err, Ok, Result, ResultArray } from '../../../shared/result';
import * as mir from '../../2-encoding/mir';
import { CALL_KEYWORDS } from '../keywords';

export function visitExpr(
  node: ASTv2.CalleeNode,
  state: NormalizationState
): Result<mir.CalleeExpression>;
export function visitExpr(
  node: ASTv2.LiteralExpression,
  state: NormalizationState
): Result<ASTv2.LiteralExpression>;
export function visitExpr(
  node: ASTv2.KeywordExpression,
  state: NormalizationState
): Result<ASTv2.KeywordExpression>;
export function visitExpr(
  node: ASTv2.PathExpression,
  state: NormalizationState
): Result<mir.PathExpression>;
export function visitExpr(
  node: ASTv2.CallExpression,
  state: NormalizationState
): Result<mir.CallExpression>;
export function visitExpr(
  node: ASTv2.ExpressionValueNode,
  state: NormalizationState
): Result<mir.ExpressionValueNode>;
export function visitExpr(
  node: ASTv2.ExpressionNode,
  state: NormalizationState
): Result<mir.ExpressionNode>;
export function visitExpr(
  node: ASTv2.AppendValueNode,
  state: NormalizationState
): Result<ASTv2.LiteralExpression | mir.CalleeExpression>;
export function visitExpr(
  node: ASTv2.ExpressionNode,
  state: NormalizationState
): Result<mir.ExpressionNode> {
  switch (node.type) {
    case 'Literal':
      return Ok(node);
    case 'Keyword':
      return Ok(node);
    case 'Interpolate':
      return visitInterpolate(node, state);
    case 'Path':
      return visitPathExpression(node);
    case 'Call': {
      let translated = CALL_KEYWORDS.translate(node, state);

      if (translated !== null) {
        return translated;
      }

      return visitCallExpression(node, state);
    }
    default:
      exhausted(node);
  }
}

export function visitExprs(
  nodes: PresentArray<ASTv2.ExpressionNode>,
  state: NormalizationState
): Result<PresentList<mir.ExpressionNode>>;
export function visitExprs(
  nodes: readonly ASTv2.ExpressionNode[],
  state: NormalizationState
): Result<AnyOptionalList<mir.ExpressionNode>>;
export function visitExprs(
  nodes: readonly ASTv2.ExpressionNode[],
  state: NormalizationState
): Result<AnyOptionalList<mir.ExpressionNode>> {
  return new ResultArray(nodes.map((e) => visitExpr(e, state))).toOptionalList();
}

/**
 * Normalize paths into `hir.Path` or a `hir.Expr` that corresponds to the ref.
 *
 * TODO since keywords don't support tails anyway, distinguish PathExpression from
 * VariableReference in ASTv2.
 */
function visitPathExpression(path: ASTv2.PathExpression): Result<mir.ExpressionNode> {
  let { tail, ref } = path;

  if (isPresentArray(tail)) {
    let tailLoc = tail[0].loc.extend(getLast(tail).loc);
    return Ok(
      new mir.PathExpression({
        loc: path.loc,
        head: ref,
        tail: new mir.Tail({ loc: tailLoc, members: tail }),
      })
    );
  } else {
    return Ok(ref);
  }
}

function visitInterpolate(
  expr: ASTv2.InterpolateExpression,
  state: NormalizationState
): Result<mir.InterpolateExpression> {
  let parts = expr.parts.map(convertPathToCallIfKeyword) as PresentArray<ASTv2.ExpressionNode>;

  return visitExprs(parts, state).mapOk(
    (parts) => new mir.InterpolateExpression({ loc: expr.loc, parts: parts })
  );
}

function visitCallExpression(
  expr: ASTv2.CallExpression,
  state: NormalizationState
): Result<mir.CallExpression> {
  if (expr.callee.type === 'Call') {
    return Err(
      generateSyntaxError(
        `subexpression are not yet supported at the head of a subexpression`,
        expr.loc
      )
    );
  } else {
    return Result.all(visitExpr(expr.callee, state), visitArgs(expr.args, state)).mapOk(
      ([callee, args]) =>
        new mir.CallExpression({
          loc: expr.loc,
          callee,
          args,
        })
    );
  }
}

export function visitArgs(
  { positional, named, loc }: ASTv2.Args,
  state: NormalizationState
): Result<mir.Args> {
  return Result.all(visitPositional(positional, state), visitNamedArguments(named, state)).mapOk(
    ([positional, named]) =>
      new mir.Args({
        loc,
        positional,
        named,
      })
  );
}

export function visitPositional(
  positional: ASTv2.PositionalArguments,
  state: NormalizationState
): Result<mir.Positional> {
  return visitExprs(positional.exprs, state).mapOk(
    (list) =>
      new mir.Positional({
        loc: positional.loc,
        list,
      })
  );
}

export function visitNamedArguments(
  named: ASTv2.NamedArguments,
  state: NormalizationState
): Result<mir.NamedArguments> {
  let pairs = named.entries.map((arg) => {
    let value = convertPathToCallIfKeyword(arg.value);

    return visitExpr(value, state).mapOk(
      (value) =>
        new mir.NamedArgument({
          loc: arg.loc,
          key: arg.name,
          value,
        })
    );
  });

  return new ResultArray(pairs)
    .toOptionalList()
    .mapOk((pairs) => new mir.NamedArguments({ loc: named.loc, entries: pairs }));
}

export function convertPathToCallIfKeyword(path: ASTv2.ExpressionNode): ASTv2.ExpressionNode {
  if (path.type === 'Path' && path.ref.type === 'Resolved' && path.ref.name in KEYWORDS_TYPES) {
    let { tail } = path;

    if (tail.length === 0) {
      return new ASTv2.CallExpression({
        callee: path,
        args: ASTv2.Args.empty(path.loc),
        loc: path.loc,
      });
    }
  }

  return path;
}
