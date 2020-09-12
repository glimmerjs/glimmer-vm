import { ASTv2 } from '@glimmer/syntax';
import { isPresent, mapPresent } from '@glimmer/util';
import * as pass1 from '../../pass1/hir';
import { NormalizationUtilities } from '../context';

export function buildPath(utils: NormalizationUtilities, path: ASTv2.PathExpression): pass1.Expr {
  let { tail, head } = path;

  switch (head.type) {
    case 'AtHead':
      return pathOrExpr(
        utils.op(pass1.GetArg, { name: utils.slice(head.name).offsets(null) }).offsets(null)
      );

    case 'ThisHead':
      return pathOrExpr(utils.op(pass1.GetThis).offsets(null));

    case 'FreeVarHead':
      // TODO customizeComponentName for components
      return pathOrExpr(
        utils
          .op(pass1.GetFreeVarWithContext, {
            name: utils.slice(head.name).offsets(null),
            context: head.context,
          })
          .offsets(null)
      );
    case 'LocalVarHead':
      return pathOrExpr(
        utils.op(pass1.GetLocalVar, { name: utils.slice(head.name).offsets(null) }).offsets(null)
      );
  }

  function pathOrExpr(head: pass1.Expr): pass1.Expr {
    if (isPresent(tail)) {
      return utils
        .op(pass1.Path, { head, tail: mapPresent(tail, (e) => utils.slice(e).offsets(null)) })
        .loc(path);
    } else {
      return head;
    }
  }
}
