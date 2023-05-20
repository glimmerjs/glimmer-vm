import type {
  AttrOpcode,
  ComponentAttrOpcode,
  DynamicAttrOpcode,
  StaticAttrOpcode,
  StaticComponentAttrOpcode,
  TrustingComponentAttrOpcode,
  TrustingDynamicAttrOpcode,
  WellKnownAttrName,
  WireFormat,
} from '@glimmer/interfaces';
import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { exhausted, LOCAL_LOGGER } from '@glimmer/util';

import type { OptionalList } from '../../shared/list';
import { deflateAttrName as deflateAttributeName, deflateTagName } from '../../utils';
import { EXPR } from './expressions';
import type * as mir from './mir';
import {
  WIRE_APPEND,
  WIRE_ATTR_SPLAT,
  WIRE_BLOCK,
  WIRE_CLOSE_ELEMENT,
  WIRE_COMMENT,
  WIRE_COMPONENT,
  WIRE_COMPONENT_ATTR,
  WIRE_DEBUGGER,
  WIRE_DYNAMIC_ATTR,
  WIRE_EACH,
  WIRE_FLUSH_ELEMENT,
  WIRE_IF,
  WIRE_INVOKE_COMPONENT,
  WIRE_IN_ELEMENT,
  WIRE_LET,
  WIRE_MODIFIER,
  WIRE_OPEN_ELEMENT,
  WIRE_OPEN_ELEMENT_WITH_SPLAT,
  WIRE_STATIC_ATTR,
  WIRE_STATIC_COMPONENT_ATTR,
  WIRE_TRUSTING_APPEND,
  WIRE_TRUSTING_COMPONENT_ATTR,
  WIRE_TRUSTING_DYNAMIC_ATTR,
  WIRE_WITH,
  WIRE_WITH_DYNAMIC_VARS,
  WIRE_YIELD,
} from '@glimmer/wire-format';

class WireStatements<S extends WireFormat.Statement = WireFormat.Statement> {
  constructor(private statements: readonly S[]) {}

  toArray(): readonly S[] {
    return this.statements;
  }
}

export class ContentEncoder {
  list(statements: mir.Statement[]): WireFormat.Statement[] {
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

  content(stmt: mir.Statement): WireFormat.Statement | WireStatements {
    if (LOCAL_SHOULD_LOG) {
      LOCAL_LOGGER.log(`encoding`, stmt);
    }

    return this.visitContent(stmt);
  }

  private visitContent(stmt: mir.Statement): WireFormat.Statement | WireStatements {
    switch (stmt.type) {
      case 'Debugger':
        return [WIRE_DEBUGGER, stmt.scope.getDebugInfo()];
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
      case 'InElement':
        return this.InElement(stmt);
      case 'InvokeBlock':
        return this.InvokeBlock(stmt);
      case 'If':
        return this.If(stmt);
      case 'Each':
        return this.Each(stmt);
      case 'With':
        return this.With(stmt);
      case 'Let':
        return this.Let(stmt);
      case 'WithDynamicVars':
        return this.WithDynamicVars(stmt);
      case 'InvokeComponent':
        return this.InvokeComponent(stmt);
      default:
        return exhausted(stmt);
    }
  }

  Yield({ to, positional }: mir.Yield): WireFormat.Statements.Yield {
    return [WIRE_YIELD, to, EXPR.Positional(positional)];
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

    return wireInsertBefore === undefined ? [WIRE_IN_ELEMENT, wireBlock, guid, wireDestination] : [WIRE_IN_ELEMENT, wireBlock, guid, wireDestination, wireInsertBefore];
  }

  InvokeBlock({ head, args, blocks }: mir.InvokeBlock): WireFormat.Statements.Block {
    return [WIRE_BLOCK, EXPR.expr(head), ...EXPR.Args(args), CONTENT.NamedBlocks(blocks)];
  }

  AppendTrustedHTML({ html }: mir.AppendTrustedHTML): WireFormat.Statements.TrustingAppend {
    return [WIRE_TRUSTING_APPEND, EXPR.expr(html)];
  }

  AppendTextNode({ text }: mir.AppendTextNode): WireFormat.Statements.Append {
    return [WIRE_APPEND, EXPR.expr(text)];
  }

  AppendComment({ value }: mir.AppendComment): WireFormat.Statements.Comment {
    return [WIRE_COMMENT, value.chars];
  }

  SimpleElement({ tag, params, body, dynamicFeatures }: mir.SimpleElement): WireStatements {
    let op = dynamicFeatures ? WIRE_OPEN_ELEMENT_WITH_SPLAT : WIRE_OPEN_ELEMENT;
    return new WireStatements<WireFormat.Statement | WireFormat.ElementParameter>([
      [op, deflateTagName(tag.chars)],
      ...CONTENT.ElementParameters(params).toArray(),
      [WIRE_FLUSH_ELEMENT],
      ...CONTENT.list(body),
      [WIRE_CLOSE_ELEMENT],
    ]);
  }

  Component({ tag, params, args, blocks }: mir.Component): WireFormat.Statements.Component {
    let wireTag = EXPR.expr(tag);
    let wirePositional = CONTENT.ElementParameters(params);
    let wireNamed = EXPR.NamedArguments(args);

    let wireNamedBlocks = CONTENT.NamedBlocks(blocks);

    return [WIRE_COMPONENT, wireTag, wirePositional.toPresentArray(), wireNamed, wireNamedBlocks];
  }

  ElementParameters({ body }: mir.ElementParameters): OptionalList<WireFormat.ElementParameter> {
    return body.map((p) => CONTENT.ElementParameter(p));
  }

  ElementParameter(parameter: mir.ElementParameter): WireFormat.ElementParameter {
    switch (parameter.type) {
      case 'SplatAttr':
        return [WIRE_ATTR_SPLAT, parameter.symbol];
      case 'DynamicAttr':
        return [dynamicAttributeOp(parameter.kind), ...dynamicAttribute(parameter)];
      case 'StaticAttr':
        return [staticAttributeOp(parameter.kind), ...staticAttribute(parameter)];
      case 'Modifier':
        return [WIRE_MODIFIER, EXPR.expr(parameter.callee), ...EXPR.Args(parameter.args)];
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

    return names.length > 0 ? [names, serializedBlocks] : null;
  }

  NamedBlock({ name, body, scope }: mir.NamedBlock): WireFormat.Core.NamedBlock {
    let nameChars = name.chars;
    if (nameChars === 'inverse') {
      nameChars = 'else';
    }
    return [nameChars, [CONTENT.list(body), scope.slots]];
  }

  If({ condition, block, inverse }: mir.If): WireFormat.Statements.If {
    return [
      WIRE_IF,
      EXPR.expr(condition),
      CONTENT.NamedBlock(block)[1],
      inverse ? CONTENT.NamedBlock(inverse)[1] : null,
    ];
  }

  Each({ value, key, block, inverse }: mir.Each): WireFormat.Statements.Each {
    return [
      WIRE_EACH,
      EXPR.expr(value),
      key ? EXPR.expr(key) : null,
      CONTENT.NamedBlock(block)[1],
      inverse ? CONTENT.NamedBlock(inverse)[1] : null,
    ];
  }

  With({ value, block, inverse }: mir.With): WireFormat.Statements.With {
    return [
      WIRE_WITH,
      EXPR.expr(value),
      CONTENT.NamedBlock(block)[1],
      inverse ? CONTENT.NamedBlock(inverse)[1] : null,
    ];
  }

  Let({ positional, block }: mir.Let): WireFormat.Statements.Let {
    return [WIRE_LET, EXPR.Positional(positional), CONTENT.NamedBlock(block)[1]];
  }

  WithDynamicVars({ named, block }: mir.WithDynamicVars): WireFormat.Statements.WithDynamicVars {
    return [WIRE_WITH_DYNAMIC_VARS, EXPR.NamedArguments(named), CONTENT.NamedBlock(block)[1]];
  }

  InvokeComponent({
    definition,
    args,
    blocks,
  }: mir.InvokeComponent): WireFormat.Statements.InvokeComponent {
    return [
      WIRE_INVOKE_COMPONENT,
      EXPR.expr(definition),
      EXPR.Positional(args.positional),
      EXPR.NamedArguments(args.named),
      blocks ? CONTENT.NamedBlocks(blocks) : null,
    ];
  }
}

export const CONTENT = new ContentEncoder();

export type StaticAttrArgs = [name: string | WellKnownAttrName, value: string, namespace?: string];

function staticAttribute({ name, value, namespace }: mir.StaticAttr): StaticAttrArgs {
  let out: StaticAttrArgs = [deflateAttributeName(name.chars), value.chars];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}

export type DynamicAttrArgs = [
  name: string | WellKnownAttrName,
  value: WireFormat.Expression,
  namespace?: string
];

function dynamicAttribute({ name, value, namespace }: mir.DynamicAttr): DynamicAttrArgs {
  let out: DynamicAttrArgs = [deflateAttributeName(name.chars), EXPR.expr(value)];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}

function staticAttributeOp(kind: { component: boolean }): StaticAttrOpcode | StaticComponentAttrOpcode;
function staticAttributeOp(kind: { component: boolean }): AttrOpcode {
  return kind.component ? WIRE_STATIC_COMPONENT_ATTR : WIRE_STATIC_ATTR;
}

function dynamicAttributeOp(
  kind: mir.AttributeKind
):
  | TrustingComponentAttrOpcode
  | TrustingDynamicAttrOpcode
  | ComponentAttrOpcode
  | DynamicAttrOpcode {
  if (kind.component) {
    return kind.trusting ? WIRE_TRUSTING_COMPONENT_ATTR : WIRE_COMPONENT_ATTR;
  } else {
    return kind.trusting ? WIRE_TRUSTING_DYNAMIC_ATTR : WIRE_DYNAMIC_ATTR;
  }
}
