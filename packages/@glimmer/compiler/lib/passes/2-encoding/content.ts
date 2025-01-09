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
import { exhausted } from '@glimmer/debug-util';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';
import {
  WF_APPEND_OPCODE,
  WF_ATTR_SPLAT_OPCODE,
  WF_BLOCK_OPCODE,
  WF_CLOSE_ELEMENT_OPCODE,
  WF_COMMENT_OPCODE,
  WF_COMPONENT_ATTR_OPCODE,
  WF_COMPONENT_OPCODE,
  WF_DEBUGGER_OPCODE,
  WF_DYNAMIC_ATTR_OPCODE,
  WF_EACH_OPCODE,
  WF_FLUSH_ELEMENT_OPCODE,
  WF_IF_OPCODE,
  WF_IN_ELEMENT_OPCODE,
  WF_INVOKE_COMPONENT_OPCODE,
  WF_LET_OPCODE,
  WF_MODIFIER_OPCODE,
  WF_OPEN_ELEMENT_OPCODE,
  WF_OPEN_ELEMENT_WITH_SPLAT_OPCODE,
  WF_STATIC_ATTR_OPCODE,
  WF_STATIC_COMPONENT_ATTR_OPCODE,
  WF_TRUSTING_APPEND_OPCODE,
  WF_TRUSTING_COMPONENT_ATTR_OPCODE,
  WF_TRUSTING_DYNAMIC_ATTR_OPCODE,
  WF_WITH_DYNAMIC_VARS_OPCODE,
  WF_YIELD_OPCODE,
} from '@glimmer/wire-format';

import type { OptionalList } from '../../shared/list';
import type * as mir from './mir';

import { deflateAttrName, deflateTagName } from '../../utils';
import { EXPR } from './expressions';

class WireStatements<S extends WireFormat.Statement = WireFormat.Statement> {
  constructor(private statements: readonly S[]) {}

  toArray(): readonly S[] {
    return this.statements;
  }
}

class ContentEncoder {
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
    if (LOCAL_TRACE_LOGGING) {
      LOCAL_LOGGER.debug(`encoding`, stmt);
    }

    return this.visitContent(stmt);
  }

  private visitContent(stmt: mir.Statement): WireFormat.Statement | WireStatements {
    switch (stmt.type) {
      case 'Debugger':
        return [WF_DEBUGGER_OPCODE, ...stmt.scope.getDebugInfo(), {}];
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
    return [WF_YIELD_OPCODE, to, EXPR.Positional(positional)];
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
      return [WF_IN_ELEMENT_OPCODE, wireBlock, guid, wireDestination];
    } else {
      return [WF_IN_ELEMENT_OPCODE, wireBlock, guid, wireDestination, wireInsertBefore];
    }
  }

  InvokeBlock({ head, args, blocks }: mir.InvokeBlock): WireFormat.Statements.Block {
    return [WF_BLOCK_OPCODE, EXPR.expr(head), ...EXPR.Args(args), CONTENT.NamedBlocks(blocks)];
  }

  AppendTrustedHTML({ html }: mir.AppendTrustedHTML): WireFormat.Statements.TrustingAppend {
    return [WF_TRUSTING_APPEND_OPCODE, EXPR.expr(html)];
  }

  AppendTextNode({ text }: mir.AppendTextNode): WireFormat.Statements.Append {
    return [WF_APPEND_OPCODE, EXPR.expr(text)];
  }

  AppendComment({ value }: mir.AppendComment): WireFormat.Statements.Comment {
    return [WF_COMMENT_OPCODE, value.chars];
  }

  SimpleElement({ tag, params, body, dynamicFeatures }: mir.SimpleElement): WireStatements {
    let op = dynamicFeatures ? WF_OPEN_ELEMENT_WITH_SPLAT_OPCODE : WF_OPEN_ELEMENT_OPCODE;
    return new WireStatements<WireFormat.Statement | WireFormat.ElementParameter>([
      [op, deflateTagName(tag.chars)],
      ...CONTENT.ElementParameters(params).toArray(),
      [WF_FLUSH_ELEMENT_OPCODE],
      ...CONTENT.list(body),
      [WF_CLOSE_ELEMENT_OPCODE],
    ]);
  }

  Component({ tag, params, args, blocks }: mir.Component): WireFormat.Statements.Component {
    let wireTag = EXPR.expr(tag);
    let wirePositional = CONTENT.ElementParameters(params);
    let wireNamed = EXPR.NamedArguments(args);

    let wireNamedBlocks = CONTENT.NamedBlocks(blocks);

    return [
      WF_COMPONENT_OPCODE,
      wireTag,
      wirePositional.toPresentArray(),
      wireNamed,
      wireNamedBlocks,
    ];
  }

  ElementParameters({ body }: mir.ElementParameters): OptionalList<WireFormat.ElementParameter> {
    return body.map((p) => CONTENT.ElementParameter(p));
  }

  ElementParameter(param: mir.ElementParameter): WireFormat.ElementParameter {
    switch (param.type) {
      case 'SplatAttr':
        return [WF_ATTR_SPLAT_OPCODE, param.symbol];
      case 'DynamicAttr':
        return [dynamicAttrOp(param.kind), ...dynamicAttr(param)];
      case 'StaticAttr':
        return [staticAttrOp(param.kind), ...staticAttr(param)];
      case 'Modifier':
        return [WF_MODIFIER_OPCODE, EXPR.expr(param.callee), ...EXPR.Args(param.args)];
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
      WF_IF_OPCODE,
      EXPR.expr(condition),
      CONTENT.NamedBlock(block)[1],
      inverse ? CONTENT.NamedBlock(inverse)[1] : null,
    ];
  }

  Each({ value, key, block, inverse }: mir.Each): WireFormat.Statements.Each {
    return [
      WF_EACH_OPCODE,
      EXPR.expr(value),
      key ? EXPR.expr(key) : null,
      CONTENT.NamedBlock(block)[1],
      inverse ? CONTENT.NamedBlock(inverse)[1] : null,
    ];
  }

  Let({ positional, block }: mir.Let): WireFormat.Statements.Let {
    return [WF_LET_OPCODE, EXPR.Positional(positional), CONTENT.NamedBlock(block)[1]];
  }

  WithDynamicVars({ named, block }: mir.WithDynamicVars): WireFormat.Statements.WithDynamicVars {
    return [WF_WITH_DYNAMIC_VARS_OPCODE, EXPR.NamedArguments(named), CONTENT.NamedBlock(block)[1]];
  }

  InvokeComponent({
    definition,
    args,
    blocks,
  }: mir.InvokeComponent): WireFormat.Statements.InvokeComponent {
    return [
      WF_INVOKE_COMPONENT_OPCODE,
      EXPR.expr(definition),
      EXPR.Positional(args.positional),
      EXPR.NamedArguments(args.named),
      blocks ? CONTENT.NamedBlocks(blocks) : null,
    ];
  }
}

export const CONTENT: ContentEncoder = new ContentEncoder();

type StaticAttrArgs = [name: string | WellKnownAttrName, value: string, namespace?: string];

function staticAttr({ name, value, namespace }: mir.StaticAttr): StaticAttrArgs {
  let out: StaticAttrArgs = [deflateAttrName(name.chars), value.chars];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}

type DynamicAttrArgs = [
  name: string | WellKnownAttrName,
  value: WireFormat.Expression,
  namespace?: string,
];

function dynamicAttr({ name, value, namespace }: mir.DynamicAttr): DynamicAttrArgs {
  let out: DynamicAttrArgs = [deflateAttrName(name.chars), EXPR.expr(value)];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}

function staticAttrOp(kind: { component: boolean }): StaticAttrOpcode | StaticComponentAttrOpcode;
function staticAttrOp(kind: { component: boolean }): AttrOpcode {
  if (kind.component) {
    return WF_STATIC_COMPONENT_ATTR_OPCODE;
  } else {
    return WF_STATIC_ATTR_OPCODE;
  }
}

function dynamicAttrOp(
  kind: mir.AttrKind
):
  | TrustingComponentAttrOpcode
  | TrustingDynamicAttrOpcode
  | ComponentAttrOpcode
  | DynamicAttrOpcode {
  if (kind.component) {
    return kind.trusting ? WF_TRUSTING_COMPONENT_ATTR_OPCODE : WF_COMPONENT_ATTR_OPCODE;
  } else {
    return kind.trusting ? WF_TRUSTING_DYNAMIC_ATTR_OPCODE : WF_DYNAMIC_ATTR_OPCODE;
  }
}
