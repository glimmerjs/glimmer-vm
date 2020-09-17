/* eslint-disable qunit/no-global-expect */
import { expect } from '@glimmer/util';
import { SourceSlice } from '@glimmer/syntax';
import { OptionalList } from '../../shared/list';
import { OpArgs, OpConstructor } from '../../shared/op';
import * as mir from '../3-encoding/mir';
import { Context, MapVisitorsInterface } from './context';
import * as hir from './hir';

export type StatementVisitor = MapVisitorsInterface<hir.Statement, mir.Statement>;

export class Pass1Statement implements StatementVisitor {
  Yield(ctx: Context, { target, params }: OpArgs<hir.Yield>): mir.Yield {
    let to = ctx.table.allocateBlock(target.getString());
    return ctx.op(mir.Yield, { to, params: ctx.visitInternal(params) });
  }

  Debugger(ctx: Context, { table }: OpArgs<hir.Debugger>): mir.Debugger {
    ctx.setHasEval();

    return ctx.op(mir.Debugger, { table });
  }

  InElement(
    ctx: Context,
    { destination, guid, insertBefore, block }: OpArgs<hir.InElement>
  ): mir.InElement {
    return ctx.op(mir.InElement, {
      guid,
      insertBefore: ctx.visitOptionalExpr(insertBefore),
      destination: ctx.visitExpr(destination),
      block: ctx.visitInternal(block),
    });
  }

  Partial(ctx: Context, { expr, table }: OpArgs<hir.Partial>): mir.Partial {
    ctx.setHasEval();
    return ctx.op(mir.Partial, { target: ctx.visitExpr(expr), table });
  }

  AppendTextNode(ctx: Context, { value }: OpArgs<hir.AppendTextNode>): mir.AppendTextNode {
    return ctx.op(mir.AppendTextNode, { text: ctx.visitExpr(value) });
  }

  AppendWhitespace(ctx: Context, { value }: OpArgs<hir.AppendWhitespace>): mir.AppendTextNode {
    return ctx.op(mir.AppendTextNode, {
      text: ctx.op(mir.Literal, { value }),
    });
  }

  AppendTrustedHTML(ctx: Context, { value }: OpArgs<hir.AppendTrustedHTML>): mir.AppendTrustedHTML {
    return ctx.op(mir.AppendTrustedHTML, { html: ctx.visitExpr(value) });
  }

  AppendComment(ctx: Context, args: OpArgs<hir.AppendComment>): mir.AppendComment {
    return ctx.op(mir.AppendComment, args);
  }

  Component(ctx: Context, { tag, params, args, blocks }: OpArgs<hir.Component>): mir.Component {
    return ctx.op(mir.Component, {
      tag: ctx.visitExpr(tag),
      params: ctx.visitInternal(params),
      args: ctx.visitInternal(args),
      blocks: ctx.visitInternal(blocks),
    });
  }

  SimpleElement(
    ctx: Context,
    { tag, params, body, dynamicFeatures }: OpArgs<hir.SimpleElement>
  ): mir.SimpleElement {
    return ctx.op(mir.SimpleElement, {
      tag,
      params: ctx.visitInternal(params),
      body: body.map((b) => ctx.visitStmt(b)),
      dynamicFeatures,
    });
  }

  Modifier(ctx: Context, { head, params, hash }: OpArgs<hir.Modifier>): mir.Modifier {
    return ctx.op(mir.Modifier, {
      head: ctx.visitExpr(head),
      args: ctx.visitArgs({ params, hash }),
    });
  }

  AttrSplat(ctx: Context, _: OpArgs<hir.AttrSplat>): mir.AttrSplat {
    return ctx.op(mir.AttrSplat, { symbol: ctx.table.allocateBlock('attrs') });
  }

  Attr(ctx: Context, { kind, name, value: attrValue, namespace }: OpArgs<hir.Attr>): mir.AnyAttr {
    if (attrValue.name === 'Literal' && typeof attrValue.args.value === 'string') {
      let op = kind.component ? mir.StaticComponentAttr : mir.StaticSimpleAttr;
      let value = new SourceSlice({
        chars: attrValue.args.value,
        loc: attrValue.offsets.toLocation(ctx.source),
      });
      return ctx.op<mir.AnyAttr>(op, { name, value, namespace });
    } else {
      let op: OpConstructor<mir.AnyAttr>;

      if (kind.trusting) {
        op = kind.component ? mir.TrustingComponentAttr : mir.TrustingDynamicAttr;
      } else {
        op = kind.component ? mir.ComponentAttr : mir.DynamicSimpleAttr;
      }

      return ctx.op<mir.AnyAttr>(op, { name, value: ctx.visitExpr(attrValue), namespace });
    }
  }

  BlockInvocation(
    ctx: Context,
    { head, params, hash, blocks }: OpArgs<hir.BlockInvocation>
  ): mir.Statement {
    let defaultBlock = expect(hir.getBlock(blocks, 'default'), 'expected a default block');
    let namedBlocks: mir.NamedBlock[] = [ctx.visitInternal(defaultBlock)];
    let inverseBlock = hir.getBlock(blocks, 'else') || null;

    if (inverseBlock) {
      namedBlocks.push(ctx.visitInternal(inverseBlock));
    }

    return ctx.op(mir.InvokeBlock, {
      head: ctx.visitExpr(head),
      args: ctx.visitArgs({ params, hash }),
      blocks: ctx.op(mir.NamedBlocks, { blocks: OptionalList(namedBlocks) }),
    });
  }
}

export const STATEMENTS = new Pass1Statement();
