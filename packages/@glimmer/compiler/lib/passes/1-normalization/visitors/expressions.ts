import { ASTv2, STRICT_RESOLUTION } from '@glimmer/syntax';
import { isPresent } from '@glimmer/util';
import { OptionalList, PresentList } from '../../../shared/list';
import * as hir from '../../2-symbol-allocation/hir';
import { NormalizationUtilities } from '../context';
import { EXPR_KEYWORDS } from '../keywords';
import { assertIsValidHelper, hasPath } from '../utils/is-node';

export type ExpressionOut = hir.Expr;

export class NormalizeExpressions {
  visit(node: ASTv2.Expression, utils: NormalizationUtilities): hir.Expr {
    let translated = EXPR_KEYWORDS.translate(node, utils);

    if (translated !== null) {
      return translated.expect('TODO');
    }

    switch (node.type) {
      case 'Literal':
        return this.Literal(node, utils);
      case 'Interpolate':
        return this.Interpolate(node, utils);
      case 'Path':
        return this.PathExpression(node, utils);
      case 'Call':
        return this.CallExpression(node, utils);
    }
  }

  /**
   * Normalize paths into
   */
  PathExpression(path: ASTv2.PathExpression, utils: NormalizationUtilities): ExpressionOut {
    let { tail, ref: head } = path;

    let expr = EXPR_KEYWORDS.translate(path, utils);

    if (expr !== null) {
      return expr.expect('TODO');
    }

    switch (head.type) {
      case 'Arg':
        return pathOrExpr(utils.op(hir.GetArg, { name: head.name }).offsets(head.loc));

      case 'This':
        return pathOrExpr(utils.op(hir.GetThis).offsets(head.loc));

      case 'Free':
        if (head.resolution === STRICT_RESOLUTION) {
          return pathOrExpr(
            utils
              .op(hir.GetFreeVar, {
                name: head.name,
              })
              .offsets(head.loc)
          );
        } else {
          return pathOrExpr(
            utils
              .op(hir.GetFreeVarWithResolution, {
                name: head.name,
                resolution: head.resolution,
              })
              .offsets(head.loc)
          );
        }

      case 'Local':
        return pathOrExpr(utils.op(hir.GetLocalVar, { name: head.name }).offsets(head.loc));
    }

    function pathOrExpr(head: hir.Expr): hir.Expr {
      if (isPresent(tail)) {
        return utils.op(hir.Path, { head, tail }).loc(path);
      } else {
        return head;
      }
    }
  }

  Literal(literal: ASTv2.LiteralExpression, utils: NormalizationUtilities): hir.Literal {
    return utils.op(hir.Literal, { value: literal.value }).loc(literal);
  }

  Interpolate(expr: ASTv2.InterpolateExpression, utils: NormalizationUtilities): hir.Interpolate {
    return utils
      .op(hir.Interpolate, {
        parts: new PresentList(expr.parts).map((e) => VISIT_EXPRS.visit(e, utils)),
      })
      .loc(expr);
  }

  CallExpression(expr: ASTv2.CallExpression, utils: NormalizationUtilities): hir.Expr {
    if (!hasPath(expr)) {
      throw new Error(`unimplemented subexpression at the head of a subexpression`);
    } else {
      assertIsValidHelper(expr, expr.loc, 'helper');

      return utils
        .op(hir.SubExpression, {
          head: VISIT_EXPRS.visit(expr.callee, utils),
          args: VISIT_EXPRS.Args(expr.args, utils),
        })

        .loc(expr);
    }
  }

  Args({ positional, named, loc }: ASTv2.Args, utils: NormalizationUtilities): hir.Args {
    return utils
      .op(hir.Args, {
        positional: this.Positional(positional, utils),
        named: this.Named(named, utils),
      })
      .offsets(loc);
  }

  Positional(positional: ASTv2.Positional, utils: NormalizationUtilities): hir.Positional {
    return utils
      .op(hir.Positional, {
        list: OptionalList(positional.exprs.map((expr) => VISIT_EXPRS.visit(expr, utils))),
      })
      .offsets(positional.loc);
  }

  Named(named: ASTv2.Named, utils: NormalizationUtilities): hir.Named {
    let mappedPairs = OptionalList(named.entries).map((entry) =>
      utils
        .op(hir.NamedEntry, {
          key: entry.name,
          value: VISIT_EXPRS.visit(entry.value, utils),
        })
        .loc(entry)
    );

    return utils.op(hir.Named, { pairs: mappedPairs }).loc(named);
  }
}

export const VISIT_EXPRS = new NormalizeExpressions();
