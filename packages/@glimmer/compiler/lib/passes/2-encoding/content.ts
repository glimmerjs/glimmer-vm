import type {
  AttrOpcode,
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
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';
import { isGetLexical, SexpOpcodes as Op } from '@glimmer/wire-format';

import type { OptionalList } from '../../shared/list';
import type * as mir from './mir';

import {
  buildAppend,
  buildComponentArgs,
  compact,
  headType,
  isGet,
  isGetSymbolOrPath,
  isTupleExpression,
  MODIFIER_TYPES,
  needsAtNames,
} from '../../builder/builder';
import { deflateAttrName, deflateTagName } from '../../utils';
import { encodeArgs, encodeExpr, encodeNamedArguments, encodePositional } from './expressions';

class WireContent<S extends WireFormat.Content = WireFormat.Content> {
  constructor(private statements: readonly S[]) {}

  toArray(): readonly S[] {
    return this.statements;
  }
}

export function encodeContentList(statements: mir.Content[]): WireFormat.Content[] {
  let out: WireFormat.Content[] = [];

  for (let statement of statements) {
    let result = encodeContent(statement);

    if (result instanceof WireContent) {
      out.push(...result.toArray());
    } else {
      out.push(result);
    }
  }

  return out;
}

function encodeContent(stmt: mir.Debugger): WireFormat.Content.Debugger;
function encodeContent(stmt: mir.AppendHtmlComment): WireFormat.Content.AppendHtmlComment;
function encodeContent(stmt: mir.AppendValue): WireFormat.Content.AppendValue;
function encodeContent(stmt: mir.AppendTrustedHTML): WireFormat.Content.AppendTrustedHtml;
function encodeContent(stmt: mir.Yield): WireFormat.Content.Yield;
function encodeContent(stmt: mir.Component): WireFormat.Content.SomeInvokeComponent;
function encodeContent(stmt: mir.SimpleElement): WireContent;
function encodeContent(stmt: mir.InElement): WireFormat.Content.InElement;
function encodeContent(stmt: mir.InvokeBlock): WireFormat.Content.SomeBlock;
function encodeContent(stmt: mir.IfContent): WireFormat.Content.If;
function encodeContent(stmt: mir.Each): WireFormat.Content.Each;
function encodeContent(stmt: mir.Let): WireFormat.Content.Let;
function encodeContent(stmt: mir.WithDynamicVars): WireFormat.Content.WithDynamicVars;
function encodeContent(
  stmt: mir.InvokeComponentKeyword | mir.InvokeResolvedComponentKeyword
): WireFormat.Content.InvokeComponentKeyword;
function encodeContent(stmt: mir.Content): WireFormat.Content | WireContent;
function encodeContent(stmt: mir.Content): WireFormat.Content | WireContent {
  if (LOCAL_TRACE_LOGGING) {
    LOCAL_LOGGER.debug(`encoding`, stmt);
  }

  switch (stmt.type) {
    case 'Debugger':
      return Debugger(stmt);
    case 'AppendHtmlComment':
      return AppendComment(stmt);
    case 'AppendValue':
      return AppendValue(stmt);
    case 'AppendTrustedHTML':
      return AppendTrustedHTML(stmt);
    case 'Yield':
      return Yield(stmt);
    case 'Component':
      return Component(stmt);
    case 'SimpleElement':
      return SimpleElement(stmt);
    case 'InElement':
      return InElement(stmt);
    case 'InvokeBlock':
      return InvokeBlock(stmt);
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

export function Debugger({ scope }: mir.Debugger): WireFormat.Content.Debugger {
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
}: mir.InElement): WireFormat.Content.InElement {
  let wireBlock = NamedBlock(block)[1];
  // let guid = args.guid;
  let wireDestination = encodeExpr(destination);
  let wireInsertBefore = encodeExpr(insertBefore);

  if (wireInsertBefore === undefined) {
    return [Op.InElement, wireBlock, guid, wireDestination];
  } else {
    return [Op.InElement, wireBlock, guid, wireDestination, wireInsertBefore];
  }
}

export function BlockArgs(
  argsNode: Pick<mir.Args, 'positional' | 'named'>,
  blocksNode: Optional<mir.NamedBlocks>,
  { insertAtPrefix }: { insertAtPrefix: boolean }
): Optional<WireFormat.Core.BlockArgs> {
  return compact({
    ...encodeArgs(argsNode, insertAtPrefix),
    blocks: blocksNode ? NamedBlocks(blocksNode) : undefined,
  });
}

export function InvokeBlock({ head, args, blocks }: mir.InvokeBlock): WireFormat.Content.SomeBlock {
  const path = encodeExpr(head);

  localAssert(isGet(path), `Expected ${JSON.stringify(path)} to be a Get`);

  if (head.type === 'Local' && head.referenceType === 'lexical') {
    // @ts-expect-error
    return [
      Op.InvokeLexicalComponent,
      encodeExpr(head),
      BlockArgs(args, blocks, { insertAtPrefix: needsAtNames(path) }),
    ];
  } else if (head.type === 'Resolved') {
    return [
      Op.ResolvedBlock,
      encodeExpr(head),
      BlockArgs(args, blocks, { insertAtPrefix: needsAtNames(path) }),
    ];
  }

  return [Op.DynamicBlock, path, BlockArgs(args, blocks, { insertAtPrefix: needsAtNames(path) })];
}

export function AppendTrustedHTML({
  html,
}: mir.AppendTrustedHTML): WireFormat.Content.AppendTrustedHtml {
  return [Op.AppendTrustedHtml, encodeExpr(html)];
}

export function AppendValue({ value }: mir.AppendValue): WireFormat.Content.SomeAppend {
  return buildAppend(false, encodeExpr(value));
}

export function AppendComment({
  value,
}: mir.AppendHtmlComment): WireFormat.Content.AppendHtmlComment {
  return [Op.Comment, value.chars];
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

// This is used by the `{{component}}` keyword
export function Component({
  tag,
  params,
  args: named,
  blocks,
}: mir.Component): WireFormat.Content.SomeInvokeComponent {
  let wireTag = encodeExpr(tag);
  let wirePositional = ElementParameters(params);
  let wireNamed = encodeNamedArguments(named, false);

  let wireNamedBlocks = NamedBlocks(blocks);

  const args = buildComponentArgs(wirePositional.toPresentArray(), wireNamed, wireNamedBlocks);

  localAssert(
    isTupleExpression(wireTag),
    `Expected ${JSON.stringify(wireTag)} to be a tuple expression`
  );

  // There are special cases for non-path expressions that refer to out-of-template variables:
  // lexical variables and resolved variables.

  if (isGetLexical(wireTag)) {
    // if the expression is something like `x.Foo`, then the component is dynamic, not
    // a lexical variable.
    return [
      wireTag.length === 2 ? Op.InvokeLexicalComponent : Op.InvokeDynamicComponent,
      wireTag,
      args,
    ];
  }

  if (wireTag[0] === Op.GetFreeAsComponentHead) {
    localAssert(
      wireTag.length === 2,
      `Unexpected free variable as component head with a path tail ${JSON.stringify(wireTag)}`
    );

    return [Op.InvokeResolvedComponent, wireTag, args];
  }

  // The only remaining case here should be a reference to a local Handlebars variable (possibly a
  // path).
  localAssert(isGetSymbolOrPath(wireTag), `Expected ${JSON.stringify(wireTag)} to be a symbol`);

  return [Op.InvokeDynamicComponent, wireTag, args];
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
    case 'Modifier': {
      const expression = encodeExpr(param.callee);
      return [
        MODIFIER_TYPES[headType(expression, 'modifier')],
        encodeExpr(param.callee),
        encodeArgs(param.args),
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
  return [
    Op.If,
    encodeExpr(condition),
    NamedBlock(block)[1],
    inverse ? NamedBlock(inverse)[1] : null,
  ];
}

export function Each({ value, key, block, inverse }: mir.Each): WireFormat.Content.Each {
  return [
    Op.Each,
    encodeExpr(value),
    key ? encodeExpr(key) : null,
    NamedBlock(block)[1],
    inverse ? NamedBlock(inverse)[1] : null,
  ];
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
    encodeNamedArguments(named, false),
    namedBlock(block.body, block.scope),
  ];
}

export function InvokeComponentKeyword({
  definition,
  args,
  blocks,
}: mir.InvokeComponentKeyword): WireFormat.Content.InvokeComponentKeyword {
  const expression = encodeExpr(definition);
  const type = headType(expression, 'component');

  localAssert(type !== 'keyword', `[BUG] {{component <KW>}} is not a valid node`);

  return [
    Op.InvokeComponentKeyword,
    expression,
    BlockArgs(args, blocks, { insertAtPrefix: false }),
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
    BlockArgs(args, blocks, { insertAtPrefix: false }),
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
