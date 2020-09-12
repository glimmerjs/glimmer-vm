/* eslint-disable qunit/no-global-expect */
import { PresentArray } from '@glimmer/interfaces';
import { expect } from '@glimmer/util';
import * as pass1 from './hir';
import * as pass2 from '../pass2/ops';
import { OpArgs, OpConstructor } from '../../shared/op';
import { Context, MapVisitorsInterface } from './context';

export type StatementVisitor = MapVisitorsInterface<pass1.Statement, pass2.Statement>;

export class Pass1Statement implements StatementVisitor {
  Yield(ctx: Context, { target, params }: OpArgs<pass1.Yield>): pass2.Yield {
    let to = ctx.table.allocateBlock(target.getString());
    return ctx.op(pass2.Yield, { to, params: ctx.visitInternal(params) });
  }

  Debugger(ctx: Context, { table }: OpArgs<pass1.Debugger>): pass2.Debugger {
    ctx.setHasEval();

    return ctx.op(pass2.Debugger, { table });
  }

  InElement(
    ctx: Context,
    { destination, guid, insertBefore, block }: OpArgs<pass1.InElement>
  ): pass2.InElement {
    return ctx.op(pass2.InElement, {
      guid,
      insertBefore: ctx.visitOptionalExpr(insertBefore),
      destination: ctx.visitExpr(destination),
      block: ctx.visitInternal(block),
    });
  }

  Partial(ctx: Context, { expr, table }: OpArgs<pass1.Partial>): pass2.Partial {
    ctx.setHasEval();
    return ctx.op(pass2.Partial, { target: ctx.visitExpr(expr), table });
  }

  AppendTextNode(ctx: Context, { value }: OpArgs<pass1.AppendTextNode>): pass2.AppendTextNode {
    return ctx.op(pass2.AppendTextNode, { text: ctx.visitExpr(value) });
  }

  AppendWhitespace(ctx: Context, { value }: OpArgs<pass1.AppendWhitespace>): pass2.AppendTextNode {
    return ctx.op(pass2.AppendTextNode, {
      text: ctx.op(pass2.Literal, { value }),
    });
  }

  AppendTrustedHTML(
    ctx: Context,
    { value }: OpArgs<pass1.AppendTrustedHTML>
  ): pass2.AppendTrustedHTML {
    return ctx.op(pass2.AppendTrustedHTML, { html: ctx.visitExpr(value) });
  }

  AppendComment(ctx: Context, args: OpArgs<pass1.AppendComment>): pass2.AppendComment {
    return ctx.op(pass2.AppendComment, args);
  }

  Component(ctx: Context, { tag, params, args, blocks }: OpArgs<pass1.Component>): pass2.Component {
    return ctx.op(pass2.Component, {
      tag: ctx.visitExpr(tag),
      params: ctx.visitInternal(params),
      args: ctx.visitInternal(args),
      blocks: ctx.visitInternal(blocks),
    });
  }

  SimpleElement(
    ctx: Context,
    { tag, params, body, dynamicFeatures }: OpArgs<pass1.SimpleElement>
  ): pass2.SimpleElement {
    return ctx.op(pass2.SimpleElement, {
      tag,
      params: ctx.visitInternal(params),
      body: ctx.visitInternal(body),
      dynamicFeatures,
    });
  }

  Modifier(ctx: Context, { head, params, hash }: OpArgs<pass1.Modifier>): pass2.Modifier {
    return ctx.op(pass2.Modifier, {
      head: ctx.visitExpr(head),
      args: ctx.visitArgs({ params, hash }),
    });
  }

  AttrSplat(ctx: Context, _: OpArgs<pass1.AttrSplat>): pass2.AttrSplat {
    return ctx.op(pass2.AttrSplat, { symbol: ctx.table.allocateBlock('attrs') });
  }

  Attr(
    ctx: Context,
    { kind, name, value: attrValue, namespace }: OpArgs<pass1.Attr>
  ): pass2.AnyAttr {
    if (attrValue.name === 'Literal' && typeof attrValue.args.value === 'string') {
      let op = kind.component ? pass2.StaticComponentAttr : pass2.StaticSimpleAttr;
      let value = ctx
        .unlocatedOp(pass2.SourceSlice, { value: attrValue.args.value })
        .offsets(attrValue.offsets);
      return ctx.op<pass2.AnyAttr>(op, { name, value, namespace });
    } else {
      let op: OpConstructor<pass2.AnyAttr>;

      if (kind.trusting) {
        op = kind.component ? pass2.TrustingComponentAttr : pass2.TrustingDynamicAttr;
      } else {
        op = kind.component ? pass2.ComponentAttr : pass2.DynamicSimpleAttr;
      }

      return ctx.op<pass2.AnyAttr>(op, { name, value: ctx.visitExpr(attrValue), namespace });
    }
  }

  BlockInvocation(
    ctx: Context,
    { head, params, hash, blocks }: OpArgs<pass1.BlockInvocation>
  ): pass2.Statement {
    let defaultBlock = expect(pass1.getBlock(blocks, 'default'), 'expected a default block');
    let namedBlocks: PresentArray<pass2.NamedBlock> = [ctx.visitInternal(defaultBlock)];
    let inverseBlock = pass1.getBlock(blocks, 'else') || null;

    if (inverseBlock) {
      namedBlocks.push(ctx.visitInternal(inverseBlock));
    }

    return ctx.op(pass2.InvokeBlock, {
      head: ctx.visitExpr(head),
      args: ctx.visitArgs({ params, hash }),
      blocks: ctx.op(pass2.NamedBlocks, { blocks: namedBlocks }),
    });
  }
}

export const STATEMENTS = new Pass1Statement();
