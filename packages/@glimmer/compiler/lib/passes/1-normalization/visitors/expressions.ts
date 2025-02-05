import type { PresentArray } from '@glimmer/interfaces';
import { getLast, isPresentArray } from '@glimmer/debug-util';
import { ASTv2, KEYWORDS_TYPES } from '@glimmer/syntax';

import type { AnyOptionalList, PresentList } from '../../../shared/list';
import type { NormalizationState } from '../context';

import { Ok, Result, ResultArray } from '../../../shared/result';
import * as mir from '../../2-encoding/mir';
import { CALL_KEYWORDS } from '../keywords';

export function visit(node: ASTv2.ExpressionNode, state: NormalizationState): Result<mir.ExpressionNode> {
  switch (node.type) {
    case 'Literal':
      return Ok(visitLiteral(node));
    case 'Keyword':
      return Ok(visitKeyword(node));
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
  }
}

export function visitList(
  nodes: PresentArray<ASTv2.ExpressionNode>,
  state: NormalizationState
): Result<PresentList<mir.ExpressionNode>>;
export function visitList(
  nodes: readonly ASTv2.ExpressionNode[],
  state: NormalizationState
): Result<AnyOptionalList<mir.ExpressionNode>>;
export function visitList(
  nodes: readonly ASTv2.ExpressionNode[],
  state: NormalizationState
): Result<AnyOptionalList<mir.ExpressionNode>> {
  return new ResultArray(nodes.map((e) => visit(e, state))).toOptionalList();
}

/**
 * Normalize paths into `hir.Path` or a `hir.Expr` that corresponds to the ref.
 *
 * TODO since keywords don't support tails anyway, distinguish PathExpression from
 * VariableReference in ASTv2.
 */
export function visitPathExpression(path: ASTv2.PathExpression): Result<mir.ExpressionNode> {
  let ref = visitVariableReference(path.ref);
  let { tail } = path;

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

export function visitVariableReference(ref: ASTv2.VariableReference): ASTv2.VariableReference {
  return ref;
}

export function visitLiteral(literal: ASTv2.LiteralExpression): ASTv2.LiteralExpression {
  return literal;
}

export function visitKeyword(keyword: ASTv2.KeywordExpression): ASTv2.KeywordExpression {
  return keyword;
}

export function visitInterpolate(
  expr: ASTv2.InterpolateExpression,
  state: NormalizationState
): Result<mir.InterpolateExpression> {
  let parts = expr.parts.map(convertPathToCallIfKeyword) as PresentArray<ASTv2.ExpressionNode>;

  return visitList(parts, state).mapOk(
    (parts) => new mir.InterpolateExpression({ loc: expr.loc, parts: parts })
  );
}

export function visitCallExpression(
  expr: ASTv2.CallExpression,
  state: NormalizationState
): Result<mir.ExpressionNode> {
  if (expr.callee.type === 'Call') {
    throw new Error(`unimplemented: subexpression at the head of a subexpression`);
  } else {
    return Result.all(
      visit(expr.callee, state),
      visitArgs(expr.args, state)
    ).mapOk(
      ([callee, args]) =>
        new mir.CallExpression({
          loc: expr.loc,
          callee,
          args,
        })
    );
  }
}

export function visitArgs({ positional, named, loc }: ASTv2.Args, state: NormalizationState): Result<mir.Args> {
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
  return visitList(positional.exprs, state).mapOk(
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

    return visit(value, state).mapOk(
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
    let { ref, tail } = path;

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
