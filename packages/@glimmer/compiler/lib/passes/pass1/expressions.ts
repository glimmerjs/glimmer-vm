import * as pass2 from '../pass2/ops';
import * as pass1 from '../pass1/ops';
import { OpArgs } from '../shared/op';
import { Context, Pass1Visitor } from './context';
import { SourceOffsets } from '../shared/location';

type Pass1ExpressionsVisitor = Pass1Visitor['expressions'];

class Pass1Expressions implements Pass1ExpressionsVisitor {
  GetArg({ name }: OpArgs<pass1.GetArg>, ctx: Context): pass2.Op {
    return ctx.op(pass2.GetSymbol, { symbol: ctx.table.allocateNamed(name.getString()) });
  }

  GetThis(_: OpArgs<pass1.GetThis>, ctx: Context): pass2.Op {
    return ctx.op(pass2.GetSymbol, { symbol: 0 });
  }

  GetVar({ name, context }: OpArgs<pass1.GetVar>, ctx: Context): pass2.Op {
    if (ctx.table.has(name.getString())) {
      let symbol = ctx.table.get(name.getString());
      return ctx.op(pass2.GetSymbol, { symbol });
    } else {
      // this will be different in strict mode
      let symbol = ctx.table.allocateFree(name.getString());
      return ctx.op(pass2.GetFreeWithContext, { symbol, context });
    }
  }

  HasBlock({ target }: OpArgs<pass1.HasBlock>, ctx: Context): pass2.Op {
    return ctx.op(pass2.HasBlock, { symbol: ctx.table.allocateBlock(target.getString()) });
  }

  HasBlockParams({ target }: OpArgs<pass1.HasBlockParams>, ctx: Context): pass2.Op {
    return ctx.op(pass2.HasBlockParams, { symbol: ctx.table.allocateBlock(target.getString()) });
  }

  Concat({ parts }: OpArgs<pass1.Concat>, ctx: Context): pass2.Op[] {
    return ctx.ops(
      ctx.map([...parts].reverse(), part => ctx.visitExpr(part)),
      ctx.op(pass2.Params, { entries: parts.length }),
      ctx.op(pass2.Concat)
    );
  }

  Path({ head, tail }: OpArgs<pass1.Path>, ctx: Context): pass2.Op[] {
    let headOps = ctx.visitExpr(head);

    // let tailParts = tail.map(slice => slice.getString());

    if (tail.length === 0) {
      return headOps;
    } else {
      return ctx.ops(headOps, ctx.unlocatedOp(pass2.GetPath, tail).offsets(range(tail)));
    }
  }

  Params({ list }: OpArgs<pass1.Params>, ctx: Context): pass2.Op[] {
    if (list) {
      return ctx.ops(
        ctx.map(list, expr => ctx.visitExpr(expr)),
        ctx.op(pass2.Params, { entries: list.length })
      );
    } else {
      return ctx.ops(ctx.op(pass2.EmptyParams));
    }
  }

  Hash({ pairs }: OpArgs<pass1.Hash>, ctx: Context): pass2.Op[] {
    if (pairs.length === 0) {
      return ctx.ops(ctx.op(pass2.EmptyHash));
    }

    return ctx.ops(
      ctx.map(pairs, pair => ctx.visitExpr(pair)),
      ctx.op(pass2.Hash, { entries: pairs.length })
    );
  }

  HashPair({ key, value }: OpArgs<pass1.HashPair>, ctx: Context): pass2.Op[] {
    return ctx.ops(ctx.visitExpr(value), ctx.op(pass2.HashPair, { key }));
  }

  Literal({ type, value }: OpArgs<pass1.Literal>, ctx: Context): pass2.Op {
    return ctx.op(pass2.Literal, { type, value });
  }

  SubExpression({ head, params, hash }: OpArgs<pass1.SubExpression>, ctx: Context): pass2.Op[] {
    return ctx.ops(ctx.helper.args({ params, hash }), ctx.visitExpr(head), ctx.op(pass2.Helper));
  }
}

function range(list: { offsets: SourceOffsets | null }[]): SourceOffsets | null {
  if (list.length === 0) {
    return null;
  } else {
    let first = list[0];
    let last = list[list.length - 1];

    if (first.offsets === null || last.offsets === null) {
      return null;
    } else {
      return { start: first.offsets.start, end: last.offsets.end };
    }
  }
}

export const EXPRESSIONS = new Pass1Expressions();
