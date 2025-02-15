import type {
  AttrOpcode,
  Buildable,
  ComponentAttrOpcode,
  DynamicAttrOpcode,
  Optional,
  StaticAttrOpcode,
  StaticComponentAttrOpcode,
  TrustingComponentAttrOpcode,
  TrustingDynamicAttrOpcode,
  WellKnownAttrName,
  WireFormat,
} from '@glimmer/interfaces';
import type { BlockSymbolTable } from '@glimmer/syntax';
import { assertPresentArray, exhausted, localAssert } from '@glimmer/debug-util';
import { LOCAL_DEBUG, LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';
import { SexpOpcodes as Op } from '@glimmer/wire-format';

import type { OptionalList } from '../../shared/list';
import type * as mir from './mir';

import { buildComponentArgs } from '../../builder/builder';
import { deflateAttrName, deflateTagName } from '../../utils';
import { CALL_KEYWORDS } from '../1-normalization/keywords';
import {
  callArgs,
  encodeComponentBlockArgs,
  encodeExpr,
  encodeMaybeExpr,
  encodeNamedArguments,
  encodePositional,
} from './expressions';

class WireContent<S extends WireFormat.Content = WireFormat.Content> {
  constructor(private statements: readonly Buildable<S>[]) {}

  toArray(): readonly S[] {
    return this.statements.map(compactSexpr);
  }
}

export function encodeContentList(statements: mir.Content[]): WireFormat.Content[] {
  let out: WireFormat.Content[] = [];

  for (let statement of statements) {
    let result = encodeContent(statement);

    if (result instanceof WireContent) {
      out.push(...result.toArray());
    } else {
      out.push(compactSexpr(result));
    }
  }

  return out;
}

export function compactSexpr<T extends WireFormat.Content>(content: Buildable<T>): T {
  while (content.length > 1 && content.at(-1) === undefined) {
    content.pop();
  }

  return content as unknown as T;
}

function encodeContent(stmt: mir.Debugger): WireFormat.Content.Debugger;
function encodeContent(stmt: mir.AppendHtmlComment): WireFormat.Content.AppendHtmlText;
function encodeContent(stmt: mir.AppendHtmlComment): WireFormat.Content.AppendHtmlComment;
function encodeContent(stmt: mir.AppendValueCautiously): WireFormat.Content.AppendValueCautiously;
function encodeContent(stmt: mir.AppendTrustedHTML): WireFormat.Content.AppendTrustedHtml;
function encodeContent(stmt: mir.Yield): WireFormat.Content.Yield;
function encodeContent(stmt: mir.AngleBracketComponent): WireFormat.Content.SomeInvokeComponent;
function encodeContent(stmt: mir.SimpleElement): WireContent;
function encodeContent(stmt: mir.InElement): WireFormat.Content.InElement;
function encodeContent(stmt: mir.InvokeBlockComponent): WireFormat.Content.SomeBlock;
function encodeContent(stmt: mir.IfContent): WireFormat.Content.If;
function encodeContent(stmt: mir.Each): WireFormat.Content.Each;
function encodeContent(stmt: mir.Let): WireFormat.Content.Let;
function encodeContent(stmt: mir.WithDynamicVars): WireFormat.Content.WithDynamicVars;
function encodeContent(
  stmt: mir.InvokeComponentKeyword | mir.InvokeResolvedComponentKeyword
): WireFormat.Content.InvokeComponentKeyword;
function encodeContent(stmt: mir.Content): WireFormat.Content | WireContent;
function encodeContent(stmt: mir.Content): Buildable<WireFormat.Content> | WireContent {
  if (LOCAL_TRACE_LOGGING) {
    LOCAL_LOGGER.debug(`encoding`, stmt);
  }

  switch (stmt.type) {
    case 'Debugger':
      return Debugger(stmt);
    case 'AppendStaticContent':
      return AppendStaticContent(stmt);
    case 'AppendResolvedInvokableCautiously':
      return AppendResolvedInvokableCautiously(stmt);
    case 'AppendTrustingResolvedInvokable':
      return AppendTrustedResolvedInvokable(stmt);
    case 'AppendHtmlComment':
      return AppendComment(stmt);
    case 'AppendHtmlText':
      return AppendText(stmt);
    case 'AppendValueCautiously':
      return AppendValueCautiously(stmt);
    case 'AppendTrustedHTML':
      return AppendTrustedHTML(stmt);
    case 'Yield':
      return Yield(stmt);
    case 'AngleBracketComponent':
      return AngleBracketComponent(stmt);
    case 'SimpleElement':
      return SimpleElement(stmt);
    case 'InElement':
      return InElement(stmt);
    case 'InvokeBlockComponent':
      return InvokeBlockComponent(stmt);
    case 'IfContent':
      return IfContent(stmt);
    case 'Each':
      return Each(stmt);
    case 'Let':
      return Let(stmt);
    case 'WithDynamicVars':
      return WithDynamicVars(stmt);
    case 'InvokeComponentKeyword':
      return InvokeComponentKeyword(stmt);
    case 'InvokeResolvedComponentKeyword':
      return InvokeResolvedComponentKeyword(stmt);
    default:
      return exhausted(stmt);
  }
}

export function Debugger({ scope }: mir.Debugger): Buildable<WireFormat.Content.Debugger> {
  return [Op.Debugger, ...scope.getDebugInfo(), {}];
}

export function Yield({ to, positional }: mir.Yield): WireFormat.Content.Yield {
  return [Op.Yield, to, encodePositional(positional)];
}

export function InElement({
  guid,
  insertBefore,
  destination,
  block,
}: mir.InElement): Buildable<WireFormat.Content.InElement> {
  return [
    Op.InElement,
    namedBlock(block.body, block.scope),
    guid,
    encodeExpr(destination),
    encodeMaybeExpr(insertBefore),
  ];
}

export function InvokeBlockComponent({
  head,
  args,
  blocks,
}: mir.InvokeBlockComponent): Buildable<WireFormat.Content.SomeBlock> {
  if (head.type === 'Local' && head.referenceType === 'lexical') {
    return [
      Op.InvokeLexicalComponent,
      encodeExpr(head),
      encodeComponentBlockArgs(args.positional, args.named, blocks),
    ];
  } else if (head.type === 'ResolvedComponentCallee') {
    return [
      Op.InvokeResolvedComponent,
      head.symbol,
      encodeComponentBlockArgs(args.positional, args.named, blocks),
    ];
  } else {
    return [
      Op.InvokeDynamicBlock,
      encodeExpr(head),
      encodeComponentBlockArgs(args.positional, args.named, blocks),
    ];
  }
}

export function AppendTrustedHTML({
  html,
}: mir.AppendTrustedHTML): WireFormat.Content.AppendTrustedHtml {
  return [Op.AppendTrustedHtml, encodeExpr(html)];
}

export function AppendValueCautiously({
  value,
}: mir.AppendValueCautiously): WireFormat.Content.SomeAppend {
  switch (value.type) {
    case 'CallExpression': {
      const args = callArgs(value.args.positional, value.args.named);

      switch (value.callee.type) {
        case 'ResolvedHelperCallee': {
          return [
            Op.AppendResolvedInvokableCautiously,
            value.callee.symbol,
            callArgs(value.args.positional, value.args.named),
          ];
        }

        case 'Local': {
          if (LOCAL_DEBUG && value.callee.referenceType === 'dynamic') {
            throw new Error(`BUG: Local ${value.callee.name} is not appendable`);
          }

          return [Op.AppendDynamicInvokable, encodeExpr(value.callee), args];
        }

        case 'This':
        case 'Arg':
        case 'PathExpression':
        case 'Keyword':
        case 'Not':
        case 'IfExpression':
        case 'HasBlock':
        case 'HasBlockParams':
        case 'Curry':
        case 'GetDynamicVar':
        case 'Log':
          return [Op.AppendDynamicInvokable, encodeExpr(value.callee), args];

        case 'CallExpression': {
          throw new Error('Unimplemented: CallExpression in AppendValueCautiously');
        }

        default:
          exhausted(value.callee);
      }
    }

    default:
      return [Op.AppendValueCautiously, encodeExpr(value)];
  }
}

export function AppendComment({
  value,
}: mir.AppendHtmlComment): WireFormat.Content.AppendHtmlComment {
  return [Op.Comment, value.chars];
}

export function AppendStaticContent({
  value,
}: mir.AppendStaticContent): WireFormat.Content.AppendStatic {
  return [Op.AppendStatic, value.value ?? [Op.Undefined]];
}

export function AppendResolvedInvokableCautiously({
  callee,
  args,
}: mir.AppendResolvedInvokableCautiously): WireFormat.Content.AppendResolvedInvokableCautiously {
  return [
    Op.AppendResolvedInvokableCautiously,
    callee.symbol,
    callArgs(args.positional, args.named),
  ];
}

export function AppendTrustedResolvedInvokable({
  callee,
  args,
}: mir.AppendTrustingResolvedInvokable):
  | WireFormat.Content.AppendTrustedResolvedInvokable
  | WireFormat.Content.AppendResolvedInvokableCautiously {
  return [Op.AppendTrustedResolvedInvokable, callee.symbol, callArgs(args.positional, args.named)];
}

export function AppendText({ value }: mir.AppendHtmlText): WireFormat.Content.AppendHtmlText {
  return [Op.AppendHtmlText, value];
}

export function SimpleElement({
  tag,
  params,
  body,
  dynamicFeatures,
}: mir.SimpleElement): WireContent {
  let op = dynamicFeatures ? Op.OpenElementWithSplat : Op.OpenElement;
  return new WireContent<WireFormat.Content | WireFormat.ElementParameter>([
    [op, deflateTagName(tag.chars)],
    ...ElementParameters(params).toArray(),
    [Op.FlushElement],
    ...encodeContentList(body),
    [Op.CloseElement],
  ]);
}

export function AngleBracketComponent({
  tag,
  params,
  args: named,
  blocks,
}: mir.AngleBracketComponent): WireFormat.Content.SomeInvokeComponent {
  let wireSplattributes = ElementParameters(params);
  let wireNamed = encodeNamedArguments(named, { insertAtPrefix: false });

  let wireNamedBlocks = NamedBlocks(blocks);

  const args = buildComponentArgs(wireSplattributes.toPresentArray(), wireNamed, wireNamedBlocks);

  if (tag.type === 'ResolvedComponentCallee') {
    return [Op.InvokeResolvedComponent, tag.symbol, args];
  }

  if (tag.type === 'Local' && tag.referenceType === 'lexical') {
    return [Op.InvokeLexicalComponent, tag.symbol, args];
  }

  return [Op.InvokeDynamicComponent, encodeExpr(tag), args];
}

export function ElementParameters({
  body,
}: mir.ElementParameters): OptionalList<WireFormat.ElementParameter> {
  return body.map((p) => ElementParameter(p));
}

export function ElementParameter(param: mir.ElementParameter): WireFormat.ElementParameter {
  switch (param.type) {
    case 'SplatAttr':
      return [Op.AttrSplat, param.symbol];
    case 'DynamicAttr':
      return [dynamicAttrOp(param.kind), ...dynamicAttr(param)];
    case 'StaticAttr':
      return [staticAttrOp(param.kind), ...staticAttr(param)];

    case 'ResolvedModifier': {
      const { callee, args } = param;
      return [Op.ResolvedModifier, callee.symbol, callArgs(args.positional, args.named)];
    }

    case 'LexicalModifier': {
      const { callee, args } = param;
      return [Op.LexicalModifier, callee.symbol, callArgs(args.positional, args.named)];
    }

    case 'DynamicModifier': {
      return [
        Op.DynamicModifier,
        encodeExpr(param.callee),
        callArgs(param.args.positional, param.args.named),
      ];
    }
  }
}

export function NamedBlocks({
  blocks: blocksNode,
}: mir.NamedBlocks): Optional<WireFormat.Core.Blocks> {
  const blocks = blocksNode.toPresentArray();
  if (!blocks) return;

  let names: string[] = [];
  let serializedBlocks: WireFormat.SerializedInlineBlock[] = [];

  for (const block of blocks) {
    const [name, serializedBlock] = NamedBlock(block);

    names.push(name);
    serializedBlocks.push(serializedBlock);
  }

  assertPresentArray(names);
  assertPresentArray(serializedBlocks);

  return [names, serializedBlocks];
}

export function NamedBlock({ name, body, scope }: mir.NamedBlock): WireFormat.Core.NamedBlock {
  return [name.chars === 'inverse' ? 'else' : name.chars, namedBlock(body, scope)];
}

export function namedBlock(
  body: mir.Content[],
  scope: BlockSymbolTable
): WireFormat.SerializedInlineBlock {
  return [encodeContentList(body), scope.slots];
}

export function IfContent({ condition, block, inverse }: mir.IfContent): WireFormat.Content.If {
  return compactSexpr([
    Op.If,
    encodeExpr(condition),
    NamedBlock(block)[1],
    inverse ? NamedBlock(inverse)[1] : undefined,
  ]);
}

export function Each({ value, key, block, inverse }: mir.Each): WireFormat.Content.Each {
  return compactSexpr([
    Op.Each,
    encodeExpr(value),
    key ? encodeExpr(key) : null,
    namedBlock(block.body, block.scope),
    inverse ? namedBlock(inverse.body, inverse.scope) : undefined,
  ]);
}

export function Let({ positional, block }: mir.Let): WireFormat.Content.Let {
  return [Op.Let, encodePositional(positional), NamedBlock(block)[1]];
}

export function WithDynamicVars({
  named,
  block,
}: mir.WithDynamicVars): WireFormat.Content.WithDynamicVars {
  return [
    Op.WithDynamicVars,
    encodeNamedArguments(named, { insertAtPrefix: false }),
    namedBlock(block.body, block.scope),
  ];
}

export function InvokeComponentKeyword({
  definition,
  args,
  blocks,
}: mir.InvokeComponentKeyword): WireFormat.Content.InvokeComponentKeyword {
  const expression = encodeExpr(definition);

  localAssert(
    expression[0] !== Op.GetStrictKeyword,
    `[BUG] {{component <KW>}} is not a valid node`
  );

  return [
    Op.InvokeComponentKeyword,
    expression,
    encodeComponentBlockArgs(args.positional, args.named, blocks),
  ];
}

export function InvokeResolvedComponentKeyword({
  definition,
  args,
  blocks,
}: mir.InvokeResolvedComponentKeyword): WireFormat.Content.InvokeComponentKeyword {
  return [
    Op.InvokeComponentKeyword,
    definition,
    encodeComponentBlockArgs(args.positional, args.named, blocks),
  ];
}

export type StaticAttrArgs = [name: string | WellKnownAttrName, value: string, namespace?: string];

function staticAttr({ name, value, namespace }: mir.StaticAttr): StaticAttrArgs {
  let out: StaticAttrArgs = [deflateAttrName(name.chars), value.chars];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}

export type DynamicAttrArgs = [
  name: string | WellKnownAttrName,
  value: WireFormat.Expression,
  namespace?: string,
];

function dynamicAttr({ name, value, namespace }: mir.DynamicAttr): DynamicAttrArgs {
  let out: DynamicAttrArgs = [deflateAttrName(name.chars), encodeExpr(value)];

  if (namespace) {
    out.push(namespace);
  }

  return out;
}

function staticAttrOp(kind: { component: boolean }): StaticAttrOpcode | StaticComponentAttrOpcode;
function staticAttrOp(kind: { component: boolean }): AttrOpcode {
  if (kind.component) {
    return Op.StaticComponentAttr;
  } else {
    return Op.StaticAttr;
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
    return kind.trusting ? Op.TrustingComponentAttr : Op.ComponentAttr;
  } else {
    return kind.trusting ? Op.TrustingDynamicAttr : Op.DynamicAttr;
  }
}
