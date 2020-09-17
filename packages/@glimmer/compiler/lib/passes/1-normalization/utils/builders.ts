import { ASTv2, STRICT_RESOLUTION } from '@glimmer/syntax';
import { isPresent } from '@glimmer/util';
import { Ok, Result } from '../../../shared/result';
import * as pass1 from '../../2-symbol-allocation/hir';
import { VisitorContext } from '../context';
import { EXPR_KEYWORDS } from '../keywords';

export function buildPath(ctx: VisitorContext, path: ASTv2.PathExpression): Result<pass1.Expr> {
  let { tail, ref: head } = path;
  let { utils } = ctx;

  if (EXPR_KEYWORDS.match(path)) {
    return EXPR_KEYWORDS.translate(path, ctx);
  }

  switch (head.type) {
    case 'ArgReference':
      return pathOrExpr(utils.op(pass1.GetArg, { name: head.name }).offsets(null));

    case 'ThisReference':
      return pathOrExpr(utils.op(pass1.GetThis).offsets(null));

    case 'FreeVarReference':
      if (head.resolution === STRICT_RESOLUTION) {
        return pathOrExpr(
          utils
            .op(pass1.GetFreeVar, {
              name: utils.slice(head.name),
            })
            .offsets(null)
        );
      } else {
        return pathOrExpr(
          utils
            .op(pass1.GetFreeVarWithContext, {
              name: utils.slice(head.name),
              context: head.resolution,
            })
            .offsets(null)
        );
      }

    case 'LocalVarReference':
      return pathOrExpr(
        utils.op(pass1.GetLocalVar, { name: utils.slice(head.name) }).offsets(null)
      );
  }

  function pathOrExpr(head: pass1.Expr): Result<pass1.Expr> {
    if (isPresent(tail)) {
      return Ok(utils.op(pass1.Path, { head, tail }).loc(path));
    } else {
      return Ok(head);
    }
  }
}
