import { ExpressionContext, GetContextualFreeOp, SexpOpcodes as WireOp } from '@glimmer/interfaces';
import { exhausted, mapPresent } from '@glimmer/util';
import * as pass1 from '../pass1/ops';
import { OpArgs } from '../shared/op';
import { Visitors } from '../shared/visitors';
import { Context } from './context';
import * as pass2 from './ops';
import * as out from './out';

export class Pass2Internal implements Visitors<pass2.InternalTable, out.Internal> {
  Missing(ctx: Context): out.Missing {
    return ctx.op(out.Missing);
  }

  ElementParameters(
    ctx: Context,
    { body }: OpArgs<pass2.ElementParameters>
  ): out.ElementParameters {
    return ctx.op(out.ElementParameters, { statements: mapPresent(body, (b) => ctx.visit(b)) });
  }

  EmptyElementParameters(ctx: Context): out.EmptyElementParameters {
    return ctx.op(out.EmptyElementParameters);
  }

  SourceSlice(ctx: Context, args: OpArgs<pass1.SourceSlice>): out.SourceSlice {
    return ctx.op(out.SourceSlice, args);
  }

  Tail(ctx: Context, { members }: OpArgs<pass2.Tail>): out.Tail {
    return ctx.op(out.Tail, { members });
  }

  NamedBlocks(ctx: Context, { blocks }: OpArgs<pass2.NamedBlocks>): out.NamedBlocks {
    return ctx.op(out.NamedBlocks, { blocks: ctx.visitList(blocks) });
  }

  EmptyNamedBlocks(ctx: Context): out.EmptyNamedBlocks {
    return ctx.op(out.EmptyNamedBlocks);
  }

  NamedBlock(ctx: Context, { name, body, symbols }: OpArgs<pass2.NamedBlock>): out.NamedBlock {
    return ctx.op(out.NamedBlock, {
      name: ctx.op(out.SourceSlice, name.args),
      parameters: symbols.slots,
      statements: body.map((s) => ctx.visit(s)),
    });
  }

  Args(ctx: Context, { positional, named }: OpArgs<pass2.Args>): out.Args {
    return ctx.op(out.Args, { positional: ctx.visit(positional), named: ctx.visit(named) });
  }

  Positional(ctx: Context, { list }: OpArgs<pass2.Positional>): out.Positional {
    let params = ctx.visitList(list);

    return ctx.op(out.Positional, { list: params });
  }

  EmptyPositional(ctx: Context): out.EmptyPositional {
    return ctx.op(out.EmptyPositional);
  }

  NamedArgument(ctx: Context, { key, value }: OpArgs<pass2.NamedArgument>): out.HashPair {
    return ctx.op(out.HashPair, { key: ctx.visit(key), value: ctx.visit(value) });
  }

  NamedArguments(ctx: Context, { pairs }: OpArgs<pass2.NamedArguments>): out.NamedArguments {
    return ctx.op(out.NamedArguments, { pairs: ctx.visitList(pairs) });
  }

  EmptyNamedArguments(ctx: Context): out.EmptyNamedArguments {
    return ctx.op(out.EmptyNamedArguments);
  }
}

export const INTERNAL = new Pass2Internal();

export function isInternal(input: pass2.Op): input is pass2.Internal {
  return input.name in INTERNAL;
}

export class Pass2Expression implements Visitors<pass2.ExprTable, out.Expr> {
  Literal(ctx: Context, { value }: OpArgs<pass2.Literal>): out.Expr {
    if (value === undefined) {
      return ctx.op(out.Undefined);
    } else {
      return ctx.op(out.Value, { value });
    }
  }

  Missing(ctx: Context): out.Missing {
    return ctx.op(out.Missing);
  }

  HasBlock(ctx: Context, { symbol }: OpArgs<pass2.HasBlock>): out.Expr {
    return ctx.op(out.HasBlock, { symbol });
  }

  HasBlockParams(ctx: Context, { symbol }: OpArgs<pass2.HasBlockParams>): out.Expr {
    return ctx.op(out.HasBlockParams, { symbol });
  }

  GetFreeWithContext(
    ctx: Context,
    { symbol, context }: OpArgs<pass2.GetFreeWithContext>
  ): out.Expr {
    return ctx.op(out.GetContextualFree, { symbol, context: expressionContextOp(context) });
  }

  GetFree(ctx: Context, { symbol }: OpArgs<pass2.GetFree>): out.Expr {
    return ctx.op(out.GetFree, { symbol });
  }

  GetSloppy(ctx: Context, { symbol }: OpArgs<pass2.GetSloppy>): out.Expr {
    return ctx.op(out.GetSloppy, { symbol });
  }

  GetSymbol(ctx: Context, { symbol }: OpArgs<pass2.GetSymbol>): out.Expr {
    return ctx.op(out.GetSymbol, { symbol });
  }

  GetPath(ctx: Context, { head, tail }: OpArgs<pass2.GetPath>): out.GetPath {
    return ctx.op(out.GetPath, {
      head: ctx.visit(head),
      tail: ctx.visit(tail),
    });
  }

  Concat(ctx: Context, { parts }: OpArgs<pass2.Concat>): out.Expr {
    return ctx.op(out.Concat, { parts: ctx.visit(parts) });
  }

  Helper(ctx: Context, { head, args }: OpArgs<pass2.Helper>): out.Call {
    // let head = ctx.popValue(EXPR);
    // let params = ctx.popValue(PARAMS);
    // let hash = ctx.popValue(HASH);

    return ctx.op(out.Call, { head: ctx.visit(head), args: ctx.visit(args) });
  }
}

export const EXPRESSIONS = new Pass2Expression();

export function isExpr(input: pass2.Op): input is pass2.Expr {
  return input.name in EXPRESSIONS;
}

export function expressionContextOp(context: ExpressionContext): GetContextualFreeOp {
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
