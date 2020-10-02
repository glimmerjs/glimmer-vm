import { SexpOpcodes, WireFormat } from '@glimmer/interfaces';
import { LOCAL_LOGGER, LOGGER } from '@glimmer/util';

import { OptionalList } from '../../shared/list';
import { deflateTagName } from '../../utils';
import { EXPR } from './expressions';
import * as mir from './mir';

class WireStatements<S extends WireFormat.Statement = WireFormat.Statement> {
  constructor(private statements: readonly S[]) {}

  toArray(): readonly S[] {
    return this.statements;
  }
}

export class ContentEncoder {
  list(statements: mir.Content[]): WireFormat.Statement[] {
    let out: WireFormat.Statement[] = [];

    for (let statement of statements) {
      let result = CONTENT.content(statement);

      if (result && result instanceof WireStatements) {
        out.push(...result.toArray());
      } else {
        out.push(result);
      }
    }

    return out;
  }

  content(stmt: mir.Content): WireFormat.Statement | WireStatements {
    if (LOCAL_LOGGER) {
      LOGGER.log(`encoding`, stmt);
    }

    return this.visitContent(stmt);
  }

  private visitContent(stmt: mir.Content): WireFormat.Statement | WireStatements {
    switch (stmt.type) {
      case 'Debugger':
        return [SexpOpcodes.Debugger, stmt.scope.getEvalInfo()];
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

  Partial({ target, scope }: mir.Partial): WireFormat.Statements.Partial {
    return [SexpOpcodes.Partial, EXPR.expr(target), scope.getEvalInfo()];
  }

  Yield({ to, positional }: mir.Yield): WireFormat.Statements.Yield {
    return [SexpOpcodes.Yield, to, EXPR.Positional(positional)];
  }

  InElement({
    guid,
    insertBefore,
    destination,
    block,
  }: mir.InElement): WireFormat.Statements.InElement {
    let wireBlock = CONTENT.NamedBlock(block)[1];
    // let guid = args.guid;
    let wireDestination = EXPR.expr(destination);
    let wireInsertBefore = EXPR.expr(insertBefore);

    if (wireInsertBefore === undefined) {
      return [SexpOpcodes.InElement, wireBlock, guid, wireDestination];
    } else {
      return [SexpOpcodes.InElement, wireBlock, guid, wireDestination, wireInsertBefore];
    }
  }

  InvokeBlock({ head, args, blocks }: mir.InvokeBlock): WireFormat.Statements.Block {
    return [SexpOpcodes.Block, EXPR.expr(head), ...EXPR.Args(args), CONTENT.NamedBlocks(blocks)];
  }

  AppendTrustedHTML({ html }: mir.AppendTrustedHTML): WireFormat.Statements.TrustingAppend {
    return [SexpOpcodes.TrustingAppend, EXPR.expr(html)];
  }

  AppendTextNode({ text }: mir.AppendTextNode): WireFormat.Statements.Append {
    return [SexpOpcodes.Append, EXPR.expr(text)];
  }

  AppendComment({ value }: mir.AppendComment): WireFormat.Statements.Comment {
    return [SexpOpcodes.Comment, value.chars];
  }

  SimpleElement({ tag, params, body }: mir.SimpleElement): WireStatements {
    return new WireStatements<WireFormat.Statement | WireFormat.ElementParameter>([
      [SexpOpcodes.OpenElement, deflateTagName(tag.chars)],
      ...CONTENT.ElementAttributes(params).toArray(),
      [SexpOpcodes.FlushElement],
      ...CONTENT.list(body),
      [SexpOpcodes.CloseElement],
    ]);
  }

  DynamicElement({ tag, params, body }: mir.DynamicElement): WireStatements {
    return new WireStatements<WireFormat.Statement | WireFormat.ElementParameter>([
      [SexpOpcodes.OpenElementWithSplat, deflateTagName(tag.chars)],
      ...CONTENT.DynamicElementAttributes(params).toArray(),
      [SexpOpcodes.FlushElement],
      ...CONTENT.list(body),
      [SexpOpcodes.CloseElement],
    ]);
  }

  Component({ tag, params, args, blocks }: mir.Component): WireFormat.Statements.Component {
    let wireTag = EXPR.expr(tag);
    let wireComponentParams = CONTENT.ElementParameters(params);
    let wireNamed = EXPR.NamedArguments(args);

    let wireNamedBlocks = CONTENT.NamedBlocks(blocks);

    return [
      SexpOpcodes.Component,
      wireTag,
      wireComponentParams.toPresentArray(),
      wireNamed,
      wireNamedBlocks,
    ];
  }

  ElementAttributes({ body }: mir.ElementAttributes): OptionalList<WireFormat.ElementParameter> {
    return body.map((p) => CONTENT.ElementAttr(p));
  }

  DynamicElementAttributes({
    body,
  }: mir.DynamicElementAttributes): OptionalList<WireFormat.ElementParameter> {
    return body.map((p) => CONTENT.DynamicElementAttr(p));
  }

  ElementParameters({ body }: mir.ElementParameters): OptionalList<WireFormat.ElementParameter> {
    return body.map((p) => CONTENT.ElementParameter(p));
  }

  ElementAttr(param: mir.ElementAttr): WireFormat.ElementParameter {
    switch (param.type) {
      case 'DynamicAttr':
        return [dynamicAttrOp(param.kind), ...dynamicAttr(param)];
      case 'StaticAttr':
        return [staticAttrOp(param.kind), ...staticAttr(param)];
    }
  }

  DynamicElementAttr(param: mir.DynamicElementAttr): WireFormat.ElementParameter {
    switch (param.type) {
      case 'SplatAttr':
        return [SexpOpcodes.AttrSplat, param.symbol];
      default:
        return CONTENT.ElementAttr(param);
    }
  }

  ElementParameter(param: mir.ElementParameter): WireFormat.ElementParameter {
    switch (param.type) {
      case 'Modifier':
        return [SexpOpcodes.Modifier, EXPR.expr(param.callee), ...EXPR.Args(param.args)];
      default:
        return CONTENT.DynamicElementAttr(param);
    }
  }

  NamedBlocks({ blocks }: mir.NamedBlocks): WireFormat.Core.Blocks {
    let names: string[] = [];
    let serializedBlocks: WireFormat.SerializedInlineBlock[] = [];

    for (let block of blocks.toArray()) {
      let [name, serializedBlock] = CONTENT.NamedBlock(block);

      names.push(name);
      serializedBlocks.push(serializedBlock);
    }

    return [names, serializedBlocks];
  }

  NamedBlock({ name, body, scope }: mir.NamedBlock): WireFormat.Core.NamedBlock {
    return [
      name.chars,
      {
        parameters: scope.slots,
        statements: CONTENT.list(body),
      },
    ];
  }
}

export const CONTENT = new ContentEncoder();

export type StaticAttrArgs = [name: string, value: string, namespace?: string];

function staticAttr({ name, value, namespace }: mir.StaticAttr): StaticAttrArgs {
  let out: StaticAttrArgs = [name.chars, value.chars];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}

export type DynamicAttrArgs = [name: string, value: WireFormat.Expression, namespace?: string];

function dynamicAttr({ name, value, namespace }: mir.DynamicAttr): DynamicAttrArgs {
  let out: DynamicAttrArgs = [name.chars, EXPR.expr(value)];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}

function staticAttrOp(kind: {
  component: boolean;
}): SexpOpcodes.StaticAttr | SexpOpcodes.StaticComponentAttr;
function staticAttrOp(kind: { component: boolean }): WireFormat.AttrOp {
  if (kind.component) {
    return SexpOpcodes.StaticComponentAttr;
  } else {
    return SexpOpcodes.StaticAttr;
  }
}

function dynamicAttrOp(
  kind: mir.AttrKind
):
  | SexpOpcodes.TrustingComponentAttr
  | SexpOpcodes.TrustingDynamicAttr
  | SexpOpcodes.ComponentAttr
  | SexpOpcodes.DynamicAttr {
  if (kind.component) {
    return kind.trusting ? SexpOpcodes.TrustingComponentAttr : SexpOpcodes.ComponentAttr;
  } else {
    return kind.trusting ? SexpOpcodes.TrustingDynamicAttr : SexpOpcodes.DynamicAttr;
  }
}
