import * as pass1 from '../pass1/ops';
import { OpArgs } from '../shared/op';
import { Visitors } from '../shared/visitors';
import { Context } from './context';
import * as pass2 from './ops';
import * as out from './out';

export class Pass2Statement implements Visitors<pass2.StatementTable, out.Op> {
  Partial(ctx: Context, { target, table }: OpArgs<pass2.Partial>): out.Partial {
    return ctx.op(out.Partial, { target: ctx.visit(target), info: table.getEvalInfo() });
  }

  Debugger(ctx: Context, { table }: OpArgs<pass2.Debugger>): out.Debugger {
    return ctx.op(out.Debugger, { info: table.getEvalInfo() });
  }

  Yield(ctx: Context, { to, params }: OpArgs<pass2.Yield>): out.Yield {
    return ctx.op(out.Yield, { to, params: ctx.visit(params) });
  }

  InElement(
    ctx: Context,
    { guid, insertBefore, destination, block }: OpArgs<pass2.InElement>
  ): out.InElement {
    return ctx.op(out.InElement, {
      guid,
      block: ctx.visit(block),
      insertBefore: ctx.visit(insertBefore),
      destination: ctx.visit(destination),
    });
  }

  InvokeBlock(ctx: Context, { head, args, blocks }: OpArgs<pass2.InvokeBlock>): out.InvokeBlock {
    return ctx.op(out.InvokeBlock, {
      head: ctx.visit(head),
      args: ctx.visit(args),
      blocks: ctx.visit(blocks),
    });
  }

  AppendTrustedHTML(ctx: Context, { html }: OpArgs<pass2.AppendTrustedHTML>): out.TrustingAppend {
    return ctx.op(out.TrustingAppend, { value: ctx.visit(html) });
  }

  AppendTextNode(ctx: Context, { text }: OpArgs<pass2.AppendTextNode>): out.Append {
    return ctx.op(out.Append, { value: ctx.visit(text) });
  }

  AppendComment(ctx: Context, { value }: OpArgs<pass2.AppendComment>): out.AppendComment {
    return ctx.op(out.AppendComment, { value });
  }

  Modifier(ctx: Context, { head, args }: OpArgs<pass2.Modifier>): out.Modifier {
    // let head = ctx.popValue(EXPR);
    // let params = ctx.popValue(PARAMS);
    // let hash = ctx.popValue(HASH);

    return ctx.op(out.Modifier, { head: ctx.visit(head), args: ctx.visit(args) });
  }

  SimpleElement(ctx: Context, { tag, params, body }: OpArgs<pass2.SimpleElement>): out.Element {
    return ctx.op(out.Element, {
      tag: ctx.visit(tag),
      params: ctx.visit(params),
      body: ctx.visit(body),
      dynamicFeatures: false,
    });
  }

  ElementWithDynamicFeatures(
    ctx: Context,
    { tag, params, body }: OpArgs<pass2.ElementWithDynamicFeatures>
  ): out.Element {
    return ctx.op(out.Element, {
      tag: ctx.visit(tag),
      params: ctx.visit(params),
      body: ctx.visit(body),
      dynamicFeatures: true,
    });
  }

  Component(
    ctx: Context,
    { tag, params, args, blocks, selfClosing }: OpArgs<pass2.Component>
  ): out.Component {
    return ctx.op(out.Component, {
      tag: ctx.visit(tag),
      params: ctx.visit(params),
      args: ctx.visit(args),
      blocks: ctx.visit(blocks),
      selfClosing,
    });
  }

  StaticArg(ctx: Context, { name, value }: OpArgs<pass2.StaticArg>): out.StaticArg {
    return ctx.op(out.StaticArg, { name: ctx.visit(name), value: ctx.visit(value) });
  }

  DynamicArg(ctx: Context, { name, value }: OpArgs<pass2.DynamicArg>): out.DynamicArg {
    return ctx.op(out.DynamicArg, { name: ctx.visit(name), value: ctx.visit(value) });
  }

  StaticSimpleAttr(ctx: Context, args: OpArgs<pass2.StaticSimpleAttr>): out.StaticAttr {
    return ctx.op(out.StaticAttr, staticAttr(ctx, args));
  }

  StaticComponentAttr(
    ctx: Context,
    args: OpArgs<pass2.StaticComponentAttr>
  ): out.StaticComponentAttr {
    return ctx.op(out.StaticComponentAttr, staticAttr(ctx, args));
  }

  ComponentAttr(ctx: Context, args: OpArgs<pass2.ComponentAttr>): out.ComponentAttr {
    return ctx.op(out.ComponentAttr, dynamicAttr(ctx, args));
  }

  DynamicSimpleAttr(ctx: Context, args: OpArgs<pass2.DynamicSimpleAttr>): out.DynamicAttr {
    return ctx.op(out.DynamicAttr, staticAttr(ctx, args));
  }

  TrustingComponentAttr(
    ctx: Context,
    args: OpArgs<pass2.TrustingComponentAttr>
  ): out.TrustingComponentAttr {
    return ctx.op(out.TrustingComponentAttr, dynamicAttr(ctx, args));
  }

  TrustingDynamicAttr(
    ctx: Context,
    args: OpArgs<pass2.TrustingDynamicAttr>
  ): out.TrustingDynamicAttr {
    return ctx.op(out.TrustingDynamicAttr, dynamicAttr(ctx, args));
  }

  AttrSplat(ctx: Context, args: OpArgs<pass2.AttrSplat>): out.AttrSplat {
    return ctx.op(out.AttrSplat, args);
  }
}

export const STATEMENTS = new Pass2Statement();

export function isStatement(input: pass2.Op): input is pass2.Statement {
  return input.name in STATEMENTS;
}

function staticAttr(
  ctx: Context,
  {
    name,
    value,
    namespace,
  }: { name: pass1.SourceSlice; value: pass1.SourceSlice; namespace?: string }
): out.StaticAttrArgs {
  return { name: ctx.visit(name), value: ctx.visit(value), namespace };
}

function dynamicAttr(
  ctx: Context,
  { name, value, namespace }: { name: pass1.SourceSlice; value: pass2.Expr; namespace?: string }
): out.DynamicAttrArgs {
  return { name: ctx.visit(name), value: ctx.visit(value), namespace };
}
