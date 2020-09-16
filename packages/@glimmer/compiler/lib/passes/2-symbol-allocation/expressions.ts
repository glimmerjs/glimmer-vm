import * as hir from './hir';
import * as mir from '../3-encoding/mir';
import { OpArgs } from '../../shared/op';
import { Context, MapVisitorsInterface } from './context';

export type ExpressionVisitor = MapVisitorsInterface<hir.Expr, mir.Expr>;

export class Pass1Expression implements ExpressionVisitor {
  GetArg(ctx: Context, { name }: OpArgs<hir.GetArg>): mir.Expr {
    return ctx.op(mir.GetSymbol, { symbol: ctx.table.allocateNamed(name.getString()) });
  }

  GetThis(ctx: Context, _: OpArgs<hir.GetThis>): mir.Expr {
    return ctx.op(mir.GetSymbol, { symbol: 0 });
  }

  GetLocalVar(ctx: Context, { name }: OpArgs<hir.GetLocalVar>): mir.Expr {
    let symbol = ctx.table.get(name.getString());
    return ctx.op(mir.GetSymbol, { symbol });
  }

  GetFreeVar(ctx: Context, { name }: OpArgs<hir.GetFreeVar>): mir.Expr {
    let symbol = ctx.table.allocateFree(name.getString());
    return ctx.op(mir.GetFree, { symbol });
  }

  GetFreeVarWithContext(
    ctx: Context,
    { name, context }: OpArgs<hir.GetFreeVarWithContext>
  ): mir.Expr {
    // this will be different in strict mode
    let symbol = ctx.table.allocateFree(name.getString());
    return ctx.op(mir.GetFreeWithContext, { symbol, context });
  }

  GetWithResolver(ctx: Context, { name }: OpArgs<hir.GetFreeVar>): mir.Expr {
    let symbol = ctx.table.allocateFree(name.getString());

    return ctx.op(mir.GetWithResolver, { symbol });
  }

  HasBlock(ctx: Context, { target }: OpArgs<hir.HasBlock>): mir.Expr {
    return ctx.op(mir.HasBlock, { symbol: ctx.table.allocateBlock(target.getString()) });
  }

  HasBlockParams(ctx: Context, { target }: OpArgs<hir.HasBlockParams>): mir.Expr {
    return ctx.op(mir.HasBlockParams, { symbol: ctx.table.allocateBlock(target.getString()) });
  }

  Interpolate(ctx: Context, { parts }: OpArgs<hir.Interpolate>): mir.Expr {
    let list = parts.map((part) => ctx.visitExpr(part));
    return ctx.op(mir.Concat, { parts: ctx.op(mir.Positional, { list }) });
  }

  Path(ctx: Context, { head, tail }: OpArgs<hir.Path>): mir.Expr {
    let mappedHead = ctx.visitExpr(head);

    if (tail.length === 0) {
      return mappedHead;
    } else {
      // TODO Move the source location work to pass0
      let mappedTail = ctx.unlocatedOp(mir.Tail, { members: tail }).offsets(tail);
      return ctx.op(mir.GetPath, { head: mappedHead, tail: mappedTail });
    }
  }

  Literal(ctx: Context, { value }: OpArgs<hir.Literal>): mir.Expr {
    return ctx.op(mir.Literal, { value });
  }

  SubExpression(ctx: Context, { head, params, hash }: OpArgs<hir.SubExpression>): mir.Helper {
    let mappedHead = ctx.visitExpr(head);
    let args = ctx.visitArgs({ params, hash });
    return ctx.op(mir.Helper, { head: mappedHead, args });
  }
}

export const EXPRESSIONS = new Pass1Expression();
