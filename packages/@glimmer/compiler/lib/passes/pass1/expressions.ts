import * as pass1 from '../pass1/ops';
import * as pass2 from '../pass2/ops';
import { SourceOffsets } from '../shared/location';
import { OpArgs } from '../shared/op';
import { Context, MapVisitorsInterface } from './context';

export type ExpressionVisitor = MapVisitorsInterface<pass1.Expr, pass2.Expr>;

export class Pass1Expression implements ExpressionVisitor {
  GetSloppy(ctx: Context, { name }: OpArgs<pass1.GetSloppy>): pass2.Expr {
    if (ctx.table.has(name.getString())) {
      let symbol = ctx.table.get(name.getString());
      return ctx.op(pass2.GetSymbol, { symbol });
    } else {
      let symbol = ctx.table.allocateFree(name.getString());

      return ctx.op(pass2.GetSloppy, { symbol });
    }
  }

  GetArg(ctx: Context, { name }: OpArgs<pass1.GetArg>): pass2.Expr {
    return ctx.op(pass2.GetSymbol, { symbol: ctx.table.allocateNamed(name.getString()) });
  }

  GetThis(ctx: Context, _: OpArgs<pass1.GetThis>): pass2.Expr {
    return ctx.op(pass2.GetSymbol, { symbol: 0 });
  }

  GetVar(ctx: Context, { name, context }: OpArgs<pass1.GetVar>): pass2.Expr {
    if (ctx.table.has(name.getString())) {
      let symbol = ctx.table.get(name.getString());
      return ctx.op(pass2.GetSymbol, { symbol });
    } else {
      // this will be different in strict mode
      let symbol = ctx.table.allocateFree(name.getString());
      return ctx.op(pass2.GetFreeWithContext, { symbol, context });
    }
  }

  HasBlock(ctx: Context, { target }: OpArgs<pass1.HasBlock>): pass2.Expr {
    return ctx.op(pass2.HasBlock, { symbol: ctx.table.allocateBlock(target.getString()) });
  }

  HasBlockParams(ctx: Context, { target }: OpArgs<pass1.HasBlockParams>): pass2.Expr {
    return ctx.op(pass2.HasBlockParams, { symbol: ctx.table.allocateBlock(target.getString()) });
  }

  Concat(ctx: Context, { parts }: OpArgs<pass1.Concat>): pass2.Expr {
    let list = ctx.map(parts, (part) => ctx.visitExpr(part));
    return ctx.op(pass2.Concat, { parts: ctx.op(pass2.Positional, { list }) });
  }

  Path(ctx: Context, { head, tail }: OpArgs<pass1.Path>): pass2.Expr {
    let mappedHead = ctx.visitExpr(head);

    if (tail.length === 0) {
      return mappedHead;
    } else {
      // TODO Move the source location work to pass0
      let mappedTail = ctx.unlocatedOp(pass2.Tail, { members: tail }).offsets(tail);
      return ctx.op(pass2.GetPath, { head: mappedHead, tail: mappedTail });
    }
  }

  Literal(ctx: Context, { value }: OpArgs<pass1.Literal>): pass2.Expr {
    return ctx.op(pass2.Literal, { value });
  }

  SubExpression(ctx: Context, { head, params, hash }: OpArgs<pass1.SubExpression>): pass2.Helper {
    let mappedHead = ctx.visitExpr(head);
    let args = ctx.visitArgs({ params, hash });
    return ctx.op(pass2.Helper, { head: mappedHead, args });
  }
}

export const EXPRESSIONS = new Pass1Expression();
