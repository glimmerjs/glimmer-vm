import type { PresentArray } from '@glimmer/interfaces';
import { exhausted, getLast, isPresentArray, mapPresentArray } from '@glimmer/debug-util';
import { ASTv2, GlimmerSyntaxError, KEYWORDS_TYPES } from '@glimmer/syntax';

import type { AnyOptionalList } from '../../../shared/list';
import type { NormalizationState } from '../context';

import { OptionalList, PresentList } from '../../../shared/list';
import { Err, Ok, Result, ResultArray } from '../../../shared/result';
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

export function visitAttrValue(
  node: ASTv2.AttrValueNode,
  state: NormalizationState
): Result<mir.AttrStyleValue> {
  if (node.type === 'Interpolate') {
    return visitInterpolate(node, state);
  } else {
    return visitInterpolatePart(node, state);
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
  node: ASTv2.AppendValueNode,
  state: NormalizationState
): Result<ASTv2.LiteralExpression | mir.CalleeExpression>;
export function visitExpr(
  node: ASTv2.DynamicCallee | ASTv2.UnresolvedBinding,
  state: NormalizationState
): Result<mir.ExpressionValueNode | ASTv2.UnresolvedBinding>;

export function visitExpr(
  node: ASTv2.ExpressionValueNode | ASTv2.UnresolvedBinding,
  state: NormalizationState
): Result<mir.ExpressionValueNode | ASTv2.UnresolvedBinding> {
  switch (node.type) {
    case 'Literal':
      return Ok(node);
    case 'Keyword':
      return Ok(node);
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

    case 'UnresolvedBinding':
      return Ok(node);

    case 'Error':
      return Err(GlimmerSyntaxError.forErrorNode(node));

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
  nodes: readonly ASTv2.ExpressionValueNode[],
  state: NormalizationState
): Result<AnyOptionalList<mir.ExpressionValueNode>> {
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
  let parts = mapPresentArray(expr.parts, (p) =>
    visitInterpolatePart(convertPathToCallIfKeyword(p), state)
  );

  return Result.all(...parts).mapOk(
    (parts) => new mir.InterpolateExpression({ loc: expr.loc, parts: new PresentList(parts) })
  );
}

function visitInterpolatePart(
  part: ASTv2.InterpolatePartNode,
  state: NormalizationState
): Result<mir.AttrStyleInterpolatePart> {
  switch (part.type) {
    case 'Literal':
      return Ok(part);
    case 'CurlyResolvedAttrValue': {
      let translated = CALL_KEYWORDS.translate(part, state);

      if (translated !== null) {
        return translated.mapOk(
          (value) => new mir.CustomInterpolationPart({ loc: part.loc, value })
        );
      }

      return Ok(part);
    }
    case 'CurlyAttrValue':
      return visitExpr(part.value, state).mapOk(
        (value) => new mir.CurlyAttrValue({ loc: part.loc, value })
      );
    case 'CurlyInvokeAttr':
      return Result.all(visitExpr(part.callee, state), visitCurlyArgs(part.args, state)).mapOk(
        ([callee, args]) =>
          new mir.CurlyInvokeAttr({
            loc: part.loc,
            callee,
            args,
          })
      );
    case 'CurlyInvokeResolvedAttr': {
      let translated = CALL_KEYWORDS.translate(part, state);

      if (translated !== null) {
        return translated.mapOk(
          (value) => new mir.CustomInterpolationPart({ loc: part.loc, value })
        );
      }

      return visitCurlyArgs(part.args, state).mapOk(
        (args) =>
          new mir.CurlyInvokeResolvedAttr({
            loc: part.loc,
            resolved: part.resolved,
            args,
          })
      );
    }
    default:
      exhausted(part);
  }
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

export function visitCurlyArgs(
  { positional, named, loc }: ASTv2.CurlyArgs,
  state: NormalizationState
): Result<mir.Args> {
  return Result.all(
    visitPositional(positional, state),
    visitCurlyNamedArguments(named, state)
  ).mapOk(
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
): Result<mir.PresentComponentArguments>;
export function visitComponentArguments(
  named: ASTv2.ComponentNamedArguments,
  state: NormalizationState
): Result<mir.ComponentArguments>;
export function visitComponentArguments(
  named: ASTv2.ComponentNamedArguments,
  state: NormalizationState
): Result<mir.ComponentArguments> {
  let pairs = named.entries.map((arg) => {
    return visitAttrValue(arg.value, state).mapOk(
      (value) =>
        new mir.ComponentArgument({
          loc: arg.loc,
          name: arg.name,
          value,
        })
    );
  });

  return Result.all(...pairs).mapOk(
    (pairs) => new mir.ComponentArguments({ loc: named.loc, entries: OptionalList(pairs) })
  );
}

export function visitCurlyNamedArguments(
  named: ASTv2.PresentCurlyNamedArguments,
  state: NormalizationState
): Result<mir.PresentCurlyNamedArguments>;
export function visitCurlyNamedArguments(
  named: ASTv2.CurlyNamedArguments,
  state: NormalizationState
): Result<mir.CurlyNamedArguments>;
export function visitCurlyNamedArguments(
  named: ASTv2.CurlyNamedArguments,
  state: NormalizationState
): Result<mir.CurlyNamedArguments> {
  let pairs = named.entries.map((arg) => {
    let value = convertPathToCallIfKeyword(arg.value);

    return visitExpr(value, state).mapOk(
      (value) =>
        new mir.CurlyNamedArgument({
          loc: arg.loc,
          name: arg.name,
          value,
        })
    );
  });

  return new ResultArray(pairs)
    .toOptionalList()
    .mapOk((pairs) => new mir.CurlyNamedArguments({ loc: named.loc, entries: pairs }));
}

export function convertPathToCallIfKeyword(
  path: ASTv2.ExpressionValueNode
): ASTv2.ExpressionValueNode;
export function convertPathToCallIfKeyword(
  path: ASTv2.InterpolatePartNode
): ASTv2.InterpolatePartNode;
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
