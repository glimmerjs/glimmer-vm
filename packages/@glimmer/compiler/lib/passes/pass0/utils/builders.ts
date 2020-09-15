import { ASTv2 } from '@glimmer/syntax';
import { isPresent, mapPresent } from '@glimmer/util';
import { VariableResolution } from '@glimmer/interfaces';
import { Ok, Result } from '../../../shared/result';
import * as pass1 from '../../pass1/hir';
import { VisitorContext } from '../context';
import { EXPR_KEYWORDS } from '../keywords';

export function buildPath(ctx: VisitorContext, path: ASTv2.PathExpression): Result<pass1.Expr> {
  let { tail, head } = path;
  let { utils } = ctx;

  if (EXPR_KEYWORDS.match(path)) {
    return EXPR_KEYWORDS.translate(path, ctx);
  }

  switch (head.type) {
    case 'AtHead':
      return pathOrExpr(
        utils.op(pass1.GetArg, { name: utils.slice(head.name).offsets(null) }).offsets(null)
      );

    case 'ThisHead':
      return pathOrExpr(utils.op(pass1.GetThis).offsets(null));

    case 'FreeVarHead':
      if (head.context === VariableResolution.Strict) {
        return pathOrExpr(
          utils
            .op(pass1.GetFreeVar, {
              name: utils.slice(head.name).offsets(null),
            })
            .offsets(null)
        );
      } else {
        return pathOrExpr(
          utils
            .op(pass1.GetFreeVarWithContext, {
              name: utils.slice(head.name).offsets(null),
              context: head.context,
            })
            .offsets(null)
        );
      }

    case 'LocalVarHead':
      return pathOrExpr(
        utils.op(pass1.GetLocalVar, { name: utils.slice(head.name).offsets(null) }).offsets(null)
      );
  }

  function pathOrExpr(head: pass1.Expr): Result<pass1.Expr> {
    if (isPresent(tail)) {
      return Ok(
        utils
          .op(pass1.Path, { head, tail: mapPresent(tail, (e) => utils.slice(e).offsets(null)) })
          .loc(path)
      );
    } else {
      return Ok(head);
    }
  }
}
