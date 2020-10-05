import { WellKnownAttrName } from '@glimmer/interfaces';
import { LOCAL_LOGGER, LOGGER } from '@glimmer/util';
import { packed } from '@glimmer/wire-format';

import { AnyOptionalList, OptionalList } from '../../shared/list';
import * as mir from '../2-encoding/mir';
import { EXPR, INTERPOLATE, LONGHAND, PACKED } from './expressions';

class WireContentList<S extends packed.Content = packed.Content> {
  constructor(private statements: readonly S[]) {}

  toArray(): readonly S[] {
    return this.statements;
  }
}

export class ContentEncoder {
  list(statements: mir.Content[]): packed.Content[] {
    let out: packed.Content[] = [];

    for (let statement of statements) {
      let result = CONTENT.content(statement);

      if (result && result instanceof WireContentList) {
        out.push(...result.toArray());
      } else {
        out.push(result);
      }
    }

    return out;
  }

  content(stmt: mir.Content): packed.Content {
    if (LOCAL_LOGGER) {
      LOGGER.log(`encoding`, stmt);
    }

    return this.visitContent(stmt);
  }

  private visitContent(stmt: mir.Content): packed.Content {
    switch (stmt.type) {
      case 'Debugger':
        return [packed.ContentOp.Debugger, stmt.scope.getEvalInfo()];
      case 'Partial':
        return this.Partial(stmt);
      case 'AppendComment':
        return this.AppendComment(stmt);
      case 'AppendTextNode':
        return this.AppendTextNode(stmt);
      case 'AppendTrustedHTML':
        return this.AppendTrustedHTML(stmt);
      case 'Yield':
        return this.Yield(stmt);
      case 'Component':
        return this.Component(stmt);
      case 'SimpleElement':
        return this.SimpleElement(stmt);
      case 'DynamicElement':
        return this.DynamicElement(stmt);
      case 'InElement':
        return this.InElement(stmt);
      case 'InvokeBlock':
        return this.InvokeBlock(stmt);
    }
  }

  Partial({ target, scope }: mir.Partial): packed.content.Partial {
    return [packed.ContentOp.Partial, EXPR.expr(target, PACKED), scope.getEvalInfo()];
  }

  Yield({ to, positional }: mir.Yield): packed.content.Yield {
    let list = positional.list.map((l) => EXPR.expr(l, PACKED)).toArray();

    return [packed.ContentOp.Yield, to, ...list];
  }

  InElement({ insertBefore, destination, block, guid }: mir.InElement): packed.content.InElement {
    let wireBlock = CONTENT.NamedBlock(block)[1];
    // let guid = args.guid;
    let wireDestination = EXPR.expr(destination, PACKED);
    let wireInsertBefore = EXPR.expr(insertBefore, PACKED);

    if (wireInsertBefore === undefined) {
      return [packed.ContentOp.InElement, wireDestination, wireBlock, guid];
    } else {
      return [packed.ContentOp.InElement, wireDestination, wireBlock, guid, wireInsertBefore];
    }
  }

  InvokeBlock({ head, args, blocks }: mir.InvokeBlock): packed.content.InvokeBlock {
    return [
      packed.ContentOp.InvokeBlock,
      EXPR.expr(head, PACKED),
      CONTENT.NamedBlocks(blocks),
      ...EXPR.Args(args),
    ];
  }

  AppendTrustedHTML({ html }: mir.AppendTrustedHTML): packed.content.AppendContent {
    if (html.type === 'Literal') {
      if (typeof html.value === 'string') {
        return packed.content.appendStatic(html.value, packed.content.AppendWhat.Html);
      }
    }

    return [packed.ContentOp.Append, EXPR.expr(html, LONGHAND), packed.content.AppendWhat.Html];
  }

  AppendTextNode({ text }: mir.AppendTextNode): packed.content.AppendContent {
    if (text.type === 'Literal') {
      if (typeof text === 'string') {
        return packed.content.appendStatic(text, packed.content.AppendWhat.Text);
      }
    }

    return [packed.ContentOp.Append, EXPR.expr(text, LONGHAND), packed.content.AppendWhat.Text];
  }

  AppendComment({ value }: mir.AppendComment): packed.content.AppendContent {
    return packed.content.appendStatic(value.chars, packed.content.AppendWhat.Comment);
  }

  SimpleElement({ tag, params, body }: mir.SimpleElement): packed.content.SimpleElement {
    const content = packed.list(body.map((b) => CONTENT.content(b)));
    const attrs = packed.list(CONTENT.ElementParameters(params).toArray());

    const op = [packed.ContentOp.SimpleElement, tag.chars] as const;

    if (content === 0) {
      return attrs === 0 ? op : [...op, attrs];
    } else {
      return [...op, attrs, content];
    }
  }

  DynamicElement({ tag, params, body }: mir.DynamicElement): packed.content.SplatElement {
    const content = packed.list(body.map((b) => CONTENT.content(b)));
    const attrs = packed.list(CONTENT.DynamicElementParameters(params).toArray());

    const op = [packed.ContentOp.SplatElement, tag.chars] as const;

    if (content === 0) {
      return attrs === 0 ? op : [...op, attrs];
    } else {
      return [...op, attrs, content];
    }
  }

  Component({ tag, params, args, blocks }: mir.Component): packed.content.InvokeComponent {
    let callee = EXPR.expr(tag, PACKED);
    let wireAttrs = packed.list(CONTENT.DynamicElementParameters(params).toArray());
    let wireNamed = EXPR.NamedArguments(args);

    let wireNamedBlocks = CONTENT.NamedBlocks(blocks);

    return [packed.ContentOp.InvokeComponent, callee, wireNamedBlocks, wireAttrs, wireNamed];
    // return [
    //   SexpOpcodes.Component,
    //   wireTag,
    //   wirePositional.toPresentArray(),
    //   wireNamed,
    //   wireNamedBlocks,
    // ];
  }

  ElementParameters({
    body,
  }: mir.ElementAttrs): OptionalList<packed.content.ElementAttr | packed.content.ElementModifier> {
    return body.map((p) => CONTENT.ElementAttr(p));
  }

  DynamicElementParameters({
    body,
  }: mir.DynamicElementParameters): AnyOptionalList<
    packed.content.ElementAttr | packed.content.ElementModifier | packed.content.AttrSplat
  > {
    return body.map((p) => CONTENT.DynamicElementAttr(p));
  }

  ElementAttr(param: mir.ElementAttr): packed.content.ElementAttr | packed.content.ElementModifier {
    switch (param.type) {
      case 'DynamicAttr':
        return this.DynamicAttr(param);
      case 'StaticAttr':
        return this.StaticAttr(param);
    }
  }

  DynamicElementAttr(
    param: mir.DynamicElementAttr
  ): packed.content.ElementAttr | packed.content.ElementModifier | packed.content.AttrSplat {
    switch (param.type) {
      case 'SplatAttr':
        return packed.content.AttrSplat;
      case 'Modifier':
        return this.Modifier(param);

      default:
        return this.ElementAttr(param);
    }
  }

  Modifier(modifier: mir.Modifier): packed.content.ElementModifier {
    let { callee, args } = modifier;

    let packedCallee = EXPR.expr(callee, PACKED);
    let positional = EXPR.Positional(args.positional);
    let named = EXPR.NamedArguments(args.named);

    let hasPositional = positional !== 0;
    let hasNamed = named !== 0;

    if (hasPositional) {
      return hasNamed
        ? [WellKnownAttrName.RESERVED, packedCallee, positional, named]
        : [WellKnownAttrName.RESERVED, packedCallee, positional];
    } else {
      return hasNamed
        ? [WellKnownAttrName.RESERVED, packedCallee, packed.expr.Null, named]
        : [WellKnownAttrName.RESERVED, packedCallee];
    }
  }

  DynamicAttr({ kind, name, value, namespace }: mir.DynamicAttr): packed.content.ElementAttr {
    const out = [name.chars, EXPR.expr(value, INTERPOLATE)] as const;

    let ns = namespace ? packed.content.ns(namespace, kind.trusting) : null;

    return ns ? [...out, ns] : out;
  }

  StaticAttr({ name, value, namespace }: mir.StaticAttr): packed.content.ElementAttr {
    const out = [name.chars, value.chars] as const;

    let ns = namespace ? packed.content.ns(namespace, false) : null;

    return ns ? [...out, ns] : out;
  }

  NamedBlocks({ blocks }: mir.NamedBlocks): packed.content.NamedBlocks {
    let names: string[] = [];
    let serializedBlocks: packed.content.InlineBlock[] = [];

    for (let block of blocks.toArray()) {
      let [name, serializedBlock] = CONTENT.NamedBlock(block);

      names.push(name);
      serializedBlocks.push(serializedBlock);
    }

    return [names.join('|'), ...serializedBlocks];
  }

  NamedBlock({ name, body, scope }: mir.NamedBlock): [string, packed.content.InlineBlock] {
    let content = CONTENT.list(body);
    return [name.chars, packed.content.block(content, scope.slots)];
  }
}

export const CONTENT = new ContentEncoder();
