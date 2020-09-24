import { PresentArray } from '@glimmer/interfaces';
import { ASTv2 } from '@glimmer/syntax';
import { isPresent } from '@glimmer/util';

import { AnyOptionalList, PresentList } from '../../../shared/list';
import { Ok, Result, ResultArray } from '../../../shared/result';
import * as hir from '../../2-symbol-allocation/hir';
import { EXPR_KEYWORDS } from '../keywords';
import { assertIsValidHelper, hasPath } from '../utils/is-node';

export type ExpressionOut = hir.Expr;

export class NormalizeExpressions {
  visit(node: ASTv2.ExpressionNode): Result<hir.Expr> {
    let translated = EXPR_KEYWORDS.translate(node);

    if (translated !== null) {
      return translated;
    }

    switch (node.type) {
      case 'Literal':
        return Ok(this.Literal(node));
      case 'Interpolate':
        return this.Interpolate(node);
      case 'Path':
        return this.PathExpression(node);
      case 'Call':
        return this.CallExpression(node);
    }
  }

  visitList(nodes: PresentArray<ASTv2.ExpressionNode>): Result<PresentList<hir.Expr>>;
  visitList(nodes: readonly ASTv2.ExpressionNode[]): Result<AnyOptionalList<hir.Expr>>;
  visitList(nodes: readonly ASTv2.ExpressionNode[]): Result<AnyOptionalList<hir.Expr>> {
    return new ResultArray(nodes.map((e) => VISIT_EXPRS.visit(e))).toOptionalList();
  }

  /**
   * Normalize paths into `hir.Path` or a `hir.Expr` that corresponds to the ref.
   *
   * TODO since keywords don't support tails anyway, distinguish PathExpression from
   * VariableReference in ASTv2.
   */
  PathExpression(path: ASTv2.PathExpression): Result<hir.Expr> {
    let { tail } = path;

    let expr = EXPR_KEYWORDS.translate(path);

    if (expr !== null) {
      return expr;
    }

    let ref = this.VariableReference(path.ref);

    if (isPresent(tail)) {
      return Ok(new hir.Path(path.loc, { head: ref, tail }));
    } else {
      return Ok(ref);
    }
  }

  VariableReference(ref: ASTv2.VariableReference): hir.Expr {
    switch (ref.type) {
      case 'Arg':
        return new hir.GetArg(ref.loc, { name: ref.name });

      case 'This':
        return new hir.GetThis(ref.loc);

      case 'Free':
        if (ref.resolution === ASTv2.STRICT_RESOLUTION) {
          return new hir.GetFreeVar(ref.loc, {
            name: ref.name,
          });
        } else {
          return new hir.GetFreeVarWithResolution(ref.loc, {
            name: ref.name,
            resolution: ref.resolution,
          });
        }

      case 'Local':
        return new hir.GetLocalVar(ref.loc, { name: ref.name });
    }
  }

  Literal(literal: ASTv2.LiteralExpression): hir.Literal {
    return new hir.Literal(literal.loc, { value: literal.value });
  }

  Interpolate(expr: ASTv2.InterpolateExpression): Result<hir.Interpolate> {
    return VISIT_EXPRS.visitList(expr.parts).mapOk(
      (parts) =>
        new hir.Interpolate(expr.loc, {
          parts,
        })
    );
  }

  CallExpression(expr: ASTv2.CallExpression): Result<hir.Expr> {
    if (!hasPath(expr)) {
      throw new Error(`unimplemented subexpression at the head of a subexpression`);
    } else {
      assertIsValidHelper(expr, expr.loc, 'helper');

      return Result.all(VISIT_EXPRS.visit(expr.callee), VISIT_EXPRS.Args(expr.args)).mapOk(
        ([head, args]) =>
          new hir.SubExpression(expr.loc, {
            head,
            args,
          })
      );
    }
  }

  Args({ positional, named, loc }: ASTv2.Args): Result<hir.Args> {
    return Result.all(this.Positional(positional), this.Named(named)).mapOk(
      ([positional, named]) =>
        new hir.Args(loc, {
          positional,
          named,
        })
    );
  }

  Positional(positional: ASTv2.Positional): Result<hir.Positional> {
    return VISIT_EXPRS.visitList(positional.exprs).mapOk(
      (list) =>
        new hir.Positional(positional.loc, {
          list,
        })
    );
  }

  Named(named: ASTv2.Named): Result<hir.Named> {
    let pairs = named.entries.map((entry) =>
      VISIT_EXPRS.visit(entry.value).mapOk(
        (value) =>
          new hir.NamedEntry(entry.loc, {
            key: entry.name,
            value,
          })
      )
    );

    return new ResultArray(pairs)
      .toOptionalList()
      .mapOk((pairs) => new hir.Named(named.loc, { pairs }));
  }
}

export const VISIT_EXPRS = new NormalizeExpressions();
