import type { PresentArray } from '@glimmer/interfaces';
import { exhausted, getLast, isPresentArray } from '@glimmer/debug-util';
import { ASTv2, KEYWORDS_TYPES } from '@glimmer/syntax';

import type { AnyOptionalList, PresentList } from '../../../shared/list';
import type { NormalizationState } from '../context';

import { Ok, Result, ResultArray } from '../../../shared/result';
import * as mir from '../../2-encoding/mir';
import { CALL_KEYWORDS } from '../keywords';

export function visitHeadExpr(
  node: ASTv2.DynamicCallee | ASTv2.UnresolvedBinding,
  state: NormalizationState
) {
  if (node.type === 'UnresolvedBinding') {
    return Ok(node);
  } else {
    return visitExpr(node, state);
  }
}

export function visitExpr(
  node: ASTv2.PathExpression,
  state: NormalizationState
): Result<mir.PathExpression>;
export function visitExpr(
  node: ASTv2.LiteralExpression,
  state: NormalizationState
): Result<ASTv2.LiteralExpression>;
export function visitExpr(
  node: ASTv2.KeywordExpression,
  state: NormalizationState
): Result<ASTv2.KeywordExpression>;
export function visitExpr(
  node: ASTv2.CallExpression,
  state: NormalizationState
): Result<mir.CallExpression>;
export function visitExpr(
  node: ASTv2.DynamicCallee,
  state: NormalizationState
): Result<mir.CalleeExpression>;
export function visitExpr(
  node: ASTv2.ExpressionValueNode,
  state: NormalizationState
): Result<mir.ExpressionValueNode>;
export function visitExpr(
  node: ASTv2.AttrValueNode,
  state: NormalizationState
): Result<mir.AttrValueExpressionNode>;
export function visitExpr(
  node: ASTv2.AppendValueNode,
  state: NormalizationState
): Result<ASTv2.LiteralExpression | mir.CalleeExpression>;
export function visitExpr(
  node: ASTv2.AttrValueNode,
  state: NormalizationState
): Result<mir.AttrValueExpressionNode | ASTv2.UnresolvedBinding> {
  switch (node.type) {
    case 'Literal':
      return Ok(node);
    case 'Keyword':
      return Ok(node);
    case 'Interpolate':
      return visitInterpolate(node, state);
    case 'Path':
      return visitPathExpression(node);
    case 'Arg':
    case 'Lexical':
    case 'Local':
    case 'This':
      return Ok(node);
    case 'Call':
      return visitCallExpression(node, state);

    case 'ResolvedCall': {
      let translated = CALL_KEYWORDS.translate(node, state);

      if (translated !== null) {
        return translated;
      }

      return visitResolvedCallExpression(node, state);
    }

    default:
      exhausted(node);
  }
}

export function visitExprs(
  nodes: PresentArray<ASTv2.ExpressionValueNode>,
  state: NormalizationState
): Result<PresentList<mir.ExpressionValueNode>>;
export function visitExprs(
  nodes: readonly ASTv2.ExpressionValueNode[],
  state: NormalizationState
): Result<AnyOptionalList<mir.ExpressionValueNode>>;
export function visitExprs(
  nodes: PresentArray<ASTv2.AttrValueNode>,
  state: NormalizationState
): Result<PresentList<mir.AttrValueExpressionNode>>;
export function visitExprs(
  nodes: readonly ASTv2.AttrValueNode[],
  state: NormalizationState
): Result<AnyOptionalList<mir.AttrValueExpressionNode>>;
export function visitExprs(
  nodes: readonly ASTv2.AttrValueNode[] | readonly ASTv2.ExpressionValueNode[],
  state: NormalizationState
):
  | Result<AnyOptionalList<mir.AttrValueExpressionNode>>
  | Result<AnyOptionalList<mir.ExpressionValueNode>> {
  return new ResultArray(nodes.map((e) => visitExpr(e, state))).toOptionalList();
}

/**
 * Normalize paths into `hir.Path` or a `hir.Expr` that corresponds to the ref.
 *
 * TODO since keywords don't support tails anyway, distinguish PathExpression from
 * VariableReference in ASTv2.
 */
function visitPathExpression(
  path: ASTv2.PathExpression
): Result<mir.ExpressionValueNode | ASTv2.UnresolvedBinding> {
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
  let parts = expr.parts.map(convertPathToCallIfKeyword) as PresentArray<ASTv2.ExpressionValueNode>;

  return visitExprs(parts, state).mapOk(
    (parts) => new mir.InterpolateExpression({ loc: expr.loc, parts: parts })
  );
}

/**
 * This can happen if a resolved call isn't a built-in keyword, but will be ultimately resolved
 * downstream by a resolved keyword in the embedding environment (Ember).
 */
function visitResolvedCallExpression(
  expr: ASTv2.ResolvedCallExpression,
  state: NormalizationState
): Result<mir.ResolvedCallExpression> {
  return visitCurlyArgs(expr.args, state).mapOk(
    (args) =>
      new mir.ResolvedCallExpression({
        loc: expr.loc,
        callee: expr.resolved,
        args,
      })
  );
}

function visitCallExpression(
  expr: ASTv2.CallExpression,
  state: NormalizationState
): Result<mir.CallExpression> {
  return Result.all(visitHeadExpr(expr.callee, state), visitCurlyArgs(expr.args, state)).mapOk(
    ([callee, args]) =>
      new mir.CallExpression({
        loc: expr.loc,
        callee,
        args,
      })
  );
}

export function visitComponentArgs(
  { positional, named, loc }: ASTv2.ComponentArgs,
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

export function visitCurlyArgs(
  { positional, named, loc }: ASTv2.CurlyArgs,
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
  positional: ASTv2.PresentPositional,
  state: NormalizationState
): Result<mir.PresentPositional>;
export function visitPositional(
  positional: ASTv2.PositionalArguments,
  state: NormalizationState
): Result<mir.Positional>;
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

export function visitComponentArguments(
  named: ASTv2.PresentComponentNamedArguments,
  state: NormalizationState
): Result<mir.PresentNamedArguments>;
export function visitComponentArguments(
  named: ASTv2.ComponentNamedArguments,
  state: NormalizationState
): Result<mir.NamedArguments>;
export function visitComponentArguments(
  named: ASTv2.ComponentNamedArguments,
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

export function visitNamedArguments(
  named: ASTv2.PresentNamedArguments,
  state: NormalizationState
): Result<mir.PresentNamedArguments>;
export function visitNamedArguments(
  named: ASTv2.NamedArguments,
  state: NormalizationState
): Result<mir.NamedArguments>;
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

export function convertPathToCallIfKeyword(
  path: ASTv2.ExpressionValueNode
): ASTv2.ExpressionValueNode;
export function convertPathToCallIfKeyword(path: ASTv2.AttrValueNode): ASTv2.AttrValueNode;
export function convertPathToCallIfKeyword(
  path: ASTv2.ExpressionValueNode | ASTv2.AttrValueNode
): ASTv2.ExpressionValueNode | ASTv2.AttrValueNode {
  if (path.type === 'Keyword' && path.name in KEYWORDS_TYPES) {
    return new ASTv2.CallExpression({
      callee: path,
      args: ASTv2.EmptyCurlyArgs(path.loc),
      loc: path.loc,
    });
  }

  return path;
}
