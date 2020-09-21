import { PresentArray } from '@glimmer/interfaces';
import { ASTv2, STRICT_RESOLUTION } from '@glimmer/syntax';
import { isPresent } from '@glimmer/util';
import { AnyOptionalList, PresentList } from '../../../shared/list';
import { Ok, Result, ResultArray } from '../../../shared/result';
import * as hir from '../../2-symbol-allocation/hir';
import { NormalizationUtilities } from '../context';
import { EXPR_KEYWORDS } from '../keywords';
import { assertIsValidHelper, hasPath } from '../utils/is-node';

export type ExpressionOut = hir.Expr;

export class NormalizeExpressions {
  visit(node: ASTv2.Expression, utils: NormalizationUtilities): Result<hir.Expr> {
    let translated = EXPR_KEYWORDS.translate(node, utils);

    if (translated !== null) {
      return translated;
    }

    switch (node.type) {
      case 'Literal':
        return Ok(this.Literal(node, utils));
      case 'Interpolate':
        return this.Interpolate(node, utils);
      case 'Path':
        return this.PathExpression(node, utils);
      case 'Call':
        return this.CallExpression(node, utils);
    }
  }

  visitList(
    nodes: PresentArray<ASTv2.Expression>,
    utils: NormalizationUtilities
  ): Result<PresentList<hir.Expr>>;
  visitList(
    nodes: readonly ASTv2.Expression[],
    utils: NormalizationUtilities
  ): Result<AnyOptionalList<hir.Expr>>;
  visitList(
    nodes: readonly ASTv2.Expression[],
    utils: NormalizationUtilities
  ): Result<AnyOptionalList<hir.Expr>> {
    return new ResultArray(nodes.map((e) => VISIT_EXPRS.visit(e, utils))).toOptionalList();
  }

  /**
   * Normalize paths into `hir.Path` or a `hir.Expr` that corresponds to the ref.
   *
   * TODO since keywords don't support tails anyway, distinguish PathExpression from
   * VariableReference in ASTv2.
   */
  PathExpression(path: ASTv2.PathExpression, utils: NormalizationUtilities): Result<hir.Expr> {
    let { tail } = path;

    let expr = EXPR_KEYWORDS.translate(path, utils);

    if (expr !== null) {
      return expr;
    }

    let ref = this.VariableReference(path.ref, utils);

    if (isPresent(tail)) {
      return Ok(utils.op(hir.Path, { head: ref, tail }).loc(path));
    } else {
      return Ok(ref);
    }
  }

  VariableReference(ref: ASTv2.VariableReference, utils: NormalizationUtilities): hir.Expr {
    switch (ref.type) {
      case 'Arg':
        return utils.op(hir.GetArg, { name: ref.name }).loc(ref);

      case 'This':
        return utils.op(hir.GetThis).loc(ref);

      case 'Free':
        if (ref.resolution === STRICT_RESOLUTION) {
          return utils
            .op(hir.GetFreeVar, {
              name: ref.name,
            })
            .loc(ref);
        } else {
          return utils
            .op(hir.GetFreeVarWithResolution, {
              name: ref.name,
              resolution: ref.resolution,
            })
            .loc(ref);
        }

      case 'Local':
        return utils.op(hir.GetLocalVar, { name: ref.name }).loc(ref);
    }
  }

  Literal(literal: ASTv2.LiteralExpression, utils: NormalizationUtilities): hir.Literal {
    return utils.op(hir.Literal, { value: literal.value }).loc(literal);
  }

  Interpolate(
    expr: ASTv2.InterpolateExpression,
    utils: NormalizationUtilities
  ): Result<hir.Interpolate> {
    return VISIT_EXPRS.visitList(expr.parts, utils).mapOk((parts) =>
      utils
        .op(hir.Interpolate, {
          parts,
        })
        .loc(expr)
    );
  }

  CallExpression(expr: ASTv2.CallExpression, utils: NormalizationUtilities): Result<hir.Expr> {
    if (!hasPath(expr)) {
      throw new Error(`unimplemented subexpression at the head of a subexpression`);
    } else {
      assertIsValidHelper(expr, expr.loc, 'helper');

      return Result.all(
        VISIT_EXPRS.visit(expr.callee, utils),
        VISIT_EXPRS.Args(expr.args, utils)
      ).mapOk(([head, args]) =>
        utils
          .op(hir.SubExpression, {
            head,
            args,
          })
          .loc(expr)
      );
    }
  }

  Args({ positional, named, loc }: ASTv2.Args, utils: NormalizationUtilities): Result<hir.Args> {
    return Result.all(this.Positional(positional, utils), this.Named(named, utils)).mapOk(
      ([positional, named]) =>
        utils
          .op(hir.Args, {
            positional,
            named,
          })
          .loc(loc)
    );
  }

  Positional(positional: ASTv2.Positional, utils: NormalizationUtilities): Result<hir.Positional> {
    return VISIT_EXPRS.visitList(positional.exprs, utils).mapOk((list) =>
      utils
        .op(hir.Positional, {
          list,
        })
        .loc(positional)
    );
  }

  Named(named: ASTv2.Named, utils: NormalizationUtilities): Result<hir.Named> {
    let pairs = named.entries.map((entry) =>
      VISIT_EXPRS.visit(entry.value, utils).mapOk((value) =>
        utils
          .op(hir.NamedEntry, {
            key: entry.name,
            value,
          })
          .loc(entry)
      )
    );

    return new ResultArray(pairs)
      .toOptionalList()
      .mapOk((pairs) => utils.op(hir.Named, { pairs }).loc(named));
  }
}

export const VISIT_EXPRS = new NormalizeExpressions();
