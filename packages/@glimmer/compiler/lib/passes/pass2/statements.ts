import * as pass1 from '../pass1/ops';
import { OpArgs } from '../shared/op';
import { Visitors } from '../shared/visitors';
import { ComponentBlock, NamedBlock } from './blocks';
import { check, EXPR, HASH, MAYBE_EXPR, NAMED_BLOCK, PARAMS } from './checks';
import { Context } from './context';
import * as pass2 from './ops';
import * as out from './out';

class StatementsVisitor implements Visitors<pass2.StatementTable, out.Statement | void> {
  StartProgram(): void {
    // ctx.startBlock(new Template(symbols));
  }

  EndProgram(): void {}

  StartBlock(ctx: Context, { name, symbols }: OpArgs<pass2.StartBlock>): void {
    ctx.startBlock(new NamedBlock(name, symbols));
  }

  EndBlock(ctx: Context): void {
    ctx.pushValue(ctx.popBlock(NAMED_BLOCK));
  }

  Partial(ctx: Context): out.Statement {
    let expr = ctx.popValue(EXPR);
    return ctx.op(out.Partial, { expr, info: ctx.currentBlock.evalInfo });
  }

  Debugger(ctx: Context): out.Statement {
    return ctx.op(out.Debugger, { info: ctx.currentBlock.evalInfo });
  }

  Yield(ctx: Context, { symbol }: OpArgs<pass2.Yield>): out.Statement {
    return ctx.op(out.Yield, { to: symbol, params: ctx.popValue(PARAMS) });
  }

  InvokeInElement(ctx: Context, { guid }: OpArgs<pass2.InvokeInElement>): out.Statement {
    let block = ctx.popValue(NAMED_BLOCK);
    let destination = ctx.popValue(EXPR);
    let insertBefore = ctx.popValue(MAYBE_EXPR);

    return ctx.op(out.InElement, { guid, block, insertBefore, destination });
  }

  InvokeBlock(ctx: Context, { hasInverse }: OpArgs<pass2.InvokeBlock>): out.Statement {
    let blocks: [NamedBlock, ...NamedBlock[]] = [ctx.popValue(NAMED_BLOCK)];

    if (hasInverse) {
      blocks.push(ctx.popValue(NAMED_BLOCK));
    }

    let head = ctx.popValue(EXPR);
    let params = ctx.popValue(PARAMS);
    let hash = ctx.popValue(HASH);

    return ctx.op(out.InvokeBlock, {
      head,
      params,
      hash,
      blocks: ctx.op(out.NamedBlocks, { blocks }),
    });
  }

  AppendTrustedHTML(ctx: Context): out.Statement {
    return ctx.op(out.TrustingAppend, { value: ctx.popValue(EXPR) });
  }

  AppendTextNode(ctx: Context): out.Statement {
    return ctx.op(out.Append, { value: ctx.popValue(EXPR) });
  }

  AppendComment(ctx: Context, { value }: OpArgs<pass2.AppendComment>): out.Statement {
    return ctx.op(out.AppendComment, { value: ctx.slice(value) });
  }

  Modifier(ctx: Context): out.Statement {
    let head = ctx.popValue(EXPR);
    let params = ctx.popValue(PARAMS);
    let hash = ctx.popValue(HASH);

    return ctx.op(out.Modifier, { head, params, hash });
  }

  OpenNamedBlock(ctx: Context, { tag, symbols }: OpArgs<pass2.OpenNamedBlock>): void {
    ctx.startBlock(new NamedBlock(tag, symbols));
  }

  CloseNamedBlock(ctx: Context): void {
    let block = check(ctx.blocks.pop(), NAMED_BLOCK) as NamedBlock;

    ctx.currentComponent.pushBlock(block);
  }

  OpenSimpleElement(ctx: Context, { tag }: OpArgs<pass2.OpenSimpleElement>): out.Statement {
    return ctx.op(out.OpenElement, { tag: ctx.slice(tag) });
  }

  OpenElementWithDynamicFeatures(
    ctx: Context,
    { tag }: OpArgs<pass2.OpenSimpleElement>
  ): out.Statement {
    return ctx.op(out.OpenElementWithSplat, { tag: ctx.slice(tag) });
  }

  CloseElement(ctx: Context): out.Statement {
    return ctx.op(out.CloseElement);
  }

  OpenComponent(ctx: Context, { symbols, selfClosing }: OpArgs<pass2.OpenComponent>): void {
    let tag = ctx.popValue(EXPR);

    ctx.startBlock(new ComponentBlock(tag, symbols, selfClosing));
  }

  CloseComponent(ctx: Context): out.Statement {
    return ctx.op(out.InvokeComponent, { block: ctx.endComponent() });
  }

  StaticArg(ctx: Context, { name }: OpArgs<pass2.StaticArg>): out.Statement {
    return ctx.op(out.StaticArg, { name: ctx.slice(name), value: ctx.popValue(EXPR) });
  }

  DynamicArg(ctx: Context, { name }: OpArgs<pass2.DynamicArg>): out.Statement {
    return ctx.op(out.DynamicArg, { name: ctx.slice(name), value: ctx.popValue(EXPR) });
  }

  StaticAttr(ctx: Context, args: OpArgs<pass2.StaticAttr>): out.Statement {
    return ctx.op(out.StaticAttr, attr(ctx, args));
  }

  StaticComponentAttr(ctx: Context, args: OpArgs<pass2.StaticComponentAttr>): out.Statement {
    return ctx.op(out.StaticComponentAttr, attr(ctx, args));
  }

  ComponentAttr(ctx: Context, args: OpArgs<pass2.ComponentAttr>): out.Statement {
    return ctx.op(out.ComponentAttr, attr(ctx, args));
  }

  DynamicAttr(ctx: Context, args: OpArgs<pass2.DynamicAttr>): out.Statement {
    return ctx.op(out.DynamicAttr, attr(ctx, args));
  }

  TrustingComponentAttr(ctx: Context, args: OpArgs<pass2.TrustingComponentAttr>): out.Statement {
    return ctx.op(out.TrustingComponentAttr, attr(ctx, args));
  }

  TrustingAttr(ctx: Context, args: OpArgs<pass2.TrustingAttr>): out.Statement {
    return ctx.op(out.TrustingDynamicAttr, attr(ctx, args));
  }

  AttrSplat(ctx: Context, args: OpArgs<pass2.AttrSplat>): out.Statement {
    return ctx.op(out.AttrSplat, args);
  }

  FlushElement(ctx: Context): out.Statement {
    return ctx.op(out.FlushElement);
  }
}

export const STATEMENTS: Visitors<
  pass2.StatementTable,
  out.Statement | void
> = new StatementsVisitor();

export function isStatement(input: pass2.Op): input is pass2.Statement {
  return input.name in STATEMENTS;
}

function attr(
  ctx: Context,
  { name, namespace }: { name: pass1.SourceSlice; namespace?: string }
): out.AttrArgs {
  // deflateAttrName is an encoding concern

  let value = ctx.popValue(EXPR);

  return { name: ctx.slice(name), value, namespace };
}
