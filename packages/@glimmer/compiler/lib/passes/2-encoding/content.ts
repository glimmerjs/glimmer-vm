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
import { assertPresentArray, exhausted } from '@glimmer/debug-util';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';
import { SexpOpcodes as Op } from '@glimmer/wire-format';

import type { OptionalList } from '../../shared/list';
import type * as mir from './mir';

import { buildComponentArgs } from '../../builder/builder';
import { createEncodingView } from '../../shared/post-validation-view';
import { deflateAttrName, deflateTagName } from '../../utils';
import {
  callArgs,
  encodeAttrValue,
  encodeComponentArguments,
  encodeComponentBlockArgs,
  encodeExpr,
  encodeMaybeExpr,
  encodeNamedArguments,
  encodePositional,
} from './expressions';

const view = createEncodingView();

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
    case 'AppendInvokableCautiously':
      return AppendResolvedInvokableCautiously(stmt);
    case 'AppendTrustingInvokable':
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
    case 'ResolvedAngleBracketComponent':
      return ResolvedAngleBracketComponent(stmt);
    case 'SimpleElement':
      return SimpleElement(stmt);
    case 'InElement':
      return InElement(stmt);
    case 'InvokeBlockComponent':
      return InvokeBlockComponent(stmt);
    case 'InvokeResolvedBlockComponent':
      return InvokeResolvedBlockComponent(stmt);
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

export function InvokeResolvedComponent({
  head,
  args,
  blocks,
}: mir.InvokeResolvedBlockComponent): Buildable<WireFormat.Content.SomeInvokeComponent> {
  return [
    Op.InvokeResolvedComponent,
    head.symbol,
    encodeComponentBlockArgs(args.positional, args.named, blocks),
  ];
}

export function InvokeBlockComponent({
  head,
  args,
  blocks,
}: mir.InvokeBlockComponent): Buildable<WireFormat.Content.SomeBlock> {
  if (head.type === 'Lexical') {
    return [
      Op.InvokeLexicalComponent,
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

export function InvokeResolvedBlockComponent({
  head,
  args,
  blocks,
}: mir.InvokeResolvedBlockComponent): Buildable<WireFormat.Content.InvokeResolvedComponent> {
  return [
    Op.InvokeResolvedComponent,
    head.symbol,
    encodeComponentBlockArgs(args.positional, args.named, blocks),
  ];
}

export function AppendTrustedHTML({
  value,
}: mir.AppendTrustedHTML):
  | WireFormat.Content.AppendTrustedHtml
  | WireFormat.Content.AppendTrustedResolvedHtml {
  const resolvedValue = view.get(value, 'append trusted HTML value');
  if (resolvedValue.type === 'ResolvedName') {
    return [Op.AppendTrustedResolvedHtml, resolvedValue.symbol];
  } else {
    return [Op.AppendTrustedHtml, encodeExpr(resolvedValue)];
  }
}

export function AppendValueCautiously({
  value,
}: mir.AppendValueCautiously):
  | WireFormat.Content.AppendValueCautiously
  | WireFormat.Content.AppendResolvedValueCautiously {
  const resolvedValue = view.get(value, 'append value cautiously');
  if (resolvedValue.type === 'ResolvedName') {
    return [Op.AppendResolvedValueCautiously, resolvedValue.symbol];
  } else {
    return [Op.AppendValueCautiously, encodeExpr(resolvedValue)];
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
  if (value.value === undefined) {
    return [Op.AppendStatic, [Op.Undefined]];
  } else {
    return [Op.AppendStatic, value.value];
  }
}

export function AppendResolvedInvokableCautiously({
  callee,
  args,
}: mir.AppendInvokableCautiously):
  | WireFormat.Content.AppendResolvedInvokableCautiously
  | WireFormat.Content.AppendInvokableCautiously {
  const resolvedCallee = view.get(callee, 'append invokable cautiously callee');
  if (resolvedCallee.type === 'ResolvedName') {
    return [
      Op.AppendResolvedInvokableCautiously,
      resolvedCallee.symbol,
      callArgs(args.positional, args.named),
    ];
  } else {
    return [
      Op.AppendInvokableCautiously,
      encodeExpr(resolvedCallee),
      callArgs(args.positional, args.named),
    ];
  }
}

export function AppendTrustedResolvedInvokable({
  callee,
  args,
}: mir.AppendTrustingInvokable):
  | WireFormat.Content.AppendTrustedResolvedInvokable
  | WireFormat.Content.AppendTrustedInvokable {
  const resolvedCallee = view.get(callee, 'append trusted invokable callee');
  if (resolvedCallee.type === 'ResolvedName') {
    return [
      Op.AppendTrustedResolvedInvokable,
      resolvedCallee.symbol,
      callArgs(args.positional, args.named),
    ];
  } else {
    return [
      Op.AppendTrustedInvokable,
      encodeExpr(resolvedCallee),
      callArgs(args.positional, args.named),
    ];
  }
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

export function ResolvedAngleBracketComponent({
  tag,
  params,
  args: named,
  blocks,
}: mir.ResolvedAngleBracketComponent): WireFormat.Content.InvokeResolvedComponent {
  let wireSplattributes = ElementParameters(params);
  let wireNamed = encodeComponentArguments(named);

  let wireNamedBlocks = NamedBlocks(blocks);

  const args = buildComponentArgs(wireSplattributes.toPresentArray(), wireNamed, wireNamedBlocks);

  return [Op.InvokeResolvedComponent, tag.symbol, args];
}

export function AngleBracketComponent({
  tag,
  params,
  args: named,
  blocks,
}: mir.AngleBracketComponent): WireFormat.Content.SomeInvokeComponent {
  let wireSplattributes = ElementParameters(params);
  let wireNamed = encodeComponentArguments(named);

  let wireNamedBlocks = NamedBlocks(blocks);

  const args = buildComponentArgs(wireSplattributes.toPresentArray(), wireNamed, wireNamedBlocks);

  if (tag.type === 'Lexical') {
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
        encodeExpr(view.get(param.callee, 'dynamic modifier callee')),
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
    const validBlock = view.get(block, 'named block');
    const [name, serializedBlock] = NamedBlock(validBlock);

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
    key ? encodeExpr(key.value) : null,
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
  // For now, we treat the string definition as a literal expression
  // This might need to be revisited to use proper keyword resolution
  const literalExpr: WireFormat.Expressions.StackExpression = [
    Op.StackExpression,
    [Op.PushConstant, definition],
  ];

  return [
    Op.InvokeComponentKeyword,
    literalExpr,
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
  let out: DynamicAttrArgs = [deflateAttrName(name.chars), encodeAttrValue(value)];

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
