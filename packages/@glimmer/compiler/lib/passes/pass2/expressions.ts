import { ExpressionContext, SexpOpcodes as WireOp } from '@glimmer/interfaces';
import { assert, exhausted, isPresent, mapPresent } from '@glimmer/util';
import { OpArgs } from '../shared/op';
import { Visitors } from '../shared/visitors';
import { CONCAT_PARAMS, EXPR, GET, HASH, HASH_PAIR, PARAMS } from './checks';
import { Context } from './context';
import * as pass2 from './ops';
import * as out from './out';

class InternalVisitors implements Visitors<pass2.InternalTable, void> {
  Missing(ctx: Context): void {
    ctx.pushValue(out.Missing);
  }

  Params(ctx: Context, { entries }: OpArgs<pass2.Params>): void {
    ctx.assertStackHas(entries);

    let values: out.Expr[] = [];

    for (let i = 0; i < entries; i++) {
      values.unshift(ctx.popValue(EXPR));
    }

    if (isPresent(values)) {
      ctx.pushValue(out.Params, { list: values });
    } else {
      ctx.pushValue(out.EmptyParams);
    }
  }

  EmptyParams(ctx: Context): void {
    ctx.pushValue(out.EmptyParams);
  }

  HashPair(ctx: Context, { key }: OpArgs<pass2.HashPair>): void {
    let value = ctx.popValue(EXPR);

    ctx.pushValue(out.HashPair, { key: ctx.slice(key), value });
  }

  Hash(ctx: Context, { entries }: OpArgs<pass2.Hash>): void {
    assert(entries >= 1, `pass2.Hash must have at least one entry (use pass2.EmptyHash)`);

    ctx.assertStackHas(entries);

    let pairs: out.HashPair[] = [];

    for (let i = 0; i < entries; i++) {
      pairs.unshift(ctx.popValue(HASH_PAIR));
    }

    if (isPresent(pairs)) {
      ctx.pushValue(out.Hash, { pairs });
    } else {
      ctx.pushValue(out.EmptyHash);
    }
  }

  EmptyHash(ctx: Context): void {
    ctx.pushValue(out.EmptyHash);
  }
}

export const INTERNAL: Visitors<pass2.InternalTable, void> = new InternalVisitors();

export function isInternal(input: pass2.Op): input is pass2.Internal {
  return input.name in INTERNAL;
}

class ExpressionVisitors implements Visitors<pass2.ExprTable, void> {
  Literal(ctx: Context, { value }: OpArgs<pass2.Literal>): void {
    if (value === undefined) {
      ctx.pushValue(out.Undefined);
    } else {
      ctx.pushValue(out.Value, { value });
    }
  }

  HasBlock(ctx: Context, { symbol }: OpArgs<pass2.HasBlock>): void {
    ctx.pushValue(out.HasBlock, { symbol });
  }

  HasBlockParams(ctx: Context, { symbol }: OpArgs<pass2.HasBlockParams>): void {
    ctx.pushValue(out.HasBlockParams, { symbol });
  }

  GetFreeWithContext(ctx: Context, { symbol, context }: OpArgs<pass2.GetFreeWithContext>): void {
    ctx.pushValue(out.GetContextualFree, { symbol, context: expressionContextOp(context) });
  }

  GetFree(ctx: Context, { symbol }: OpArgs<pass2.GetFree>): void {
    ctx.pushValue(out.GetFree, { symbol });
  }

  GetSymbol(ctx: Context, { symbol }: OpArgs<pass2.GetSymbol>): void {
    ctx.pushValue(out.GetSymbol, { symbol });
  }

  GetPath(ctx: Context, tail: OpArgs<pass2.GetPath>): void {
    let head = ctx.popValue(GET);
    ctx.pushValue(out.GetPath, {
      head,
      tail: mapPresent(tail, t => ctx.op(out.SourceSlice, t)),
    });
  }

  Concat(ctx: Context): void {
    ctx.pushValue(out.Concat, { parts: ctx.popValue(CONCAT_PARAMS) });
  }

  Helper(ctx: Context): void {
    let head = ctx.popValue(EXPR);
    let params = ctx.popValue(PARAMS);
    let hash = ctx.popValue(HASH);

    ctx.pushValue(out.Call, { head, params, hash });
  }
}

export const EXPRESSIONS: Visitors<pass2.ExprTable, void> = new ExpressionVisitors();

export function isExpr(input: pass2.Op): input is pass2.Expr {
  return input.name in EXPRESSIONS;
}

export function expressionContextOp(context: ExpressionContext) {
  switch (context) {
    case ExpressionContext.AppendSingleId:
      return WireOp.GetFreeInAppendSingleId;
    case ExpressionContext.Expression:
      return WireOp.GetFreeInExpression;
    case ExpressionContext.CallHead:
      return WireOp.GetFreeInCallHead;
    case ExpressionContext.BlockHead:
      return WireOp.GetFreeInBlockHead;
    case ExpressionContext.ModifierHead:
      return WireOp.GetFreeInModifierHead;
    case ExpressionContext.ComponentHead:
      return WireOp.GetFreeInComponentHead;
    default:
      return exhausted(context);
  }
}
