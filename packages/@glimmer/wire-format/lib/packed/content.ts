// eslint-disable-next-line import/no-extraneous-dependencies
import { DEBUG } from '@glimmer/env';
import { WellKnownAttrName } from '@glimmer/interfaces';
import { isPresent, toPresentOption } from '@glimmer/util';
import { AttrNamespace, Namespace } from '@simple-dom/interface';
import {
  Args,
  Expression,
  Interpolate,
  InvokeOp,
  LiteralValue,
  LonghandExpression,
  NamedArguments,
  Null,
  SpecialExpr,
} from './expr';
import { PackedList } from './shared';

export interface Template {
  symbols: string[];
  hasEval: boolean;
  upvars: string[];
  content: Content[];
}

export const enum ContentOp {
  Append = 0,
  InvokeBlock = 1,
  InvokeComponent = 2,
  SimpleElement = 3,
  SplatElement = 4,
  Yield = 5,
  InElement = 6,
  Debugger = 7,
  Partial = 8,

  // Specifies the parameters at the head of a block
  Params = 9,
}

export type PackedBoolean = 0 | 1;

export const enum AppendWhat {
  // default
  Text = 0,
  Html = 1,
  Comment = 2,
}

export type WellKnownTagName = number;
export type TagName = string | WellKnownTagName;

export type AttrName = string | WellKnownAttrName;

export type PackedOption<T extends object> = T | Null;

/**
 * string: itself
 * comment: `!${string}`
 * html: `#${string}`
 *
 * string that begins with ! or #: FullString
 */
export type ShorthandContent = string;
export type AppendContent =
  | readonly [op: ContentOp.Append, value: string, what: AppendWhat.Comment]
  | readonly [op: ContentOp.Append, value: ShorthandContent]
  | readonly [
      op: ContentOp.Append,
      value: LonghandExpression,
      what?: AppendWhat.Text | AppendWhat.Html
    ];

export function appendStatic(value: string, what: AppendWhat): AppendContent {
  switch (what) {
    case AppendWhat.Text: {
      if (value[0] === '!' || value[0] === '#') {
        return [ContentOp.Append, [SpecialExpr.Literal, value]];
      } else {
        return [ContentOp.Append, value];
      }
    }

    case AppendWhat.Html:
      return [ContentOp.Append, `#${value}`];

    case AppendWhat.Comment:
      return [ContentOp.Append, `!${value}`];
  }
}

export type InvokeBlock = readonly [
  op: ContentOp.InvokeBlock,
  callee: Expression,
  blocks: NamedBlocks,
  ...args: Args
];

export type InvokeComponent = readonly [
  op: ContentOp.InvokeComponent,
  callee: Expression,
  blocks: NamedBlocks,
  parameters: PackedList<ComponentParameter>,
  args: NamedArguments
];

export type PackedElement<O, A> =
  | readonly [op: O, tag: string]
  | readonly [op: O, tag: string, attrs: PackedList<A>]
  | readonly [op: O, tag: string, attrs: PackedList<A>, body: PackedList<Content>];

export type SimpleElement = PackedElement<ContentOp.SimpleElement, ElementAttr | ElementModifier>;
export type SplatElement = PackedElement<
  ContentOp.SplatElement,
  ElementAttr | ElementModifier | AttrSplat
>;

export type Yield = ContentOp.Yield | [op: ContentOp.Yield, to: number, ...exprs: Expression[]];

export type EvalInfo = number[];

export type Debugger = [op: ContentOp.Debugger, info: EvalInfo];

export type Partial = [op: ContentOp.Partial, target: Expression, info: EvalInfo];

export type InElement = [
  op: ContentOp.InElement,
  destination: Expression,
  block: InlineBlock,
  guid: string,
  insertBefore?: Expression
];

export type Content =
  | AppendContent
  | InvokeBlock
  | InvokeComponent
  | SimpleElement
  | SplatElement
  | Yield
  | Debugger
  | Partial
  | InElement;

/**
 * AttrNamespace is needed if either of these conditions is true:
 *
 * - the namespace is not HTML
 * - the attribute is trusted
 */
export const enum AttrOptions {
  /** untrusted Html can be elided */
  TrustedHtml = 0,
  Xlink = 1,
  TrustedXlink = 2,
  Xml = 3,
  TrustedXml = 4,
  XmlNs = 5,
  TrustedXmlNs = 6,
}

export function isTrusted(options: AttrOptions | undefined): boolean {
  return (
    options === AttrOptions.TrustedHtml ||
    options === AttrOptions.TrustedXlink ||
    options === AttrOptions.TrustedXml ||
    options === AttrOptions.TrustedXmlNs
  );
}

export function nsFor(options: AttrOptions | undefined): AttrNamespace | null {
  if (options === undefined) {
    return null;
  }

  switch (options) {
    case AttrOptions.TrustedHtml:
      return null;
    case AttrOptions.Xlink:
    case AttrOptions.TrustedXlink:
      return Namespace.XLink;
    case AttrOptions.Xml:
    case AttrOptions.TrustedXml:
      return Namespace.XML;
    case AttrOptions.XmlNs:
    case AttrOptions.TrustedXmlNs:
      return Namespace.XMLNS;
  }
}

export function ns(namespace: string, trusted: boolean): AttrOptions | null {
  switch (namespace) {
    case Namespace.HTML:
      return trusted ? AttrOptions.TrustedHtml : null;
    case Namespace.XLink:
      return trusted ? AttrOptions.TrustedXlink : AttrOptions.Xlink;
    case Namespace.XML:
      return trusted ? AttrOptions.TrustedXml : AttrOptions.Xml;
    case Namespace.XMLNS:
      return trusted ? AttrOptions.TrustedXmlNs : AttrOptions.XmlNs;
    default:
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.warn(`TODO: ns() was called with an invalid attribute namespace ${namespace}`);
      }

      return null;
  }
}

export type AttrValue = Expression | Interpolate;

export function isInterpolate(v: AttrValue): v is Interpolate {
  return Array.isArray(v) && v[0] === SpecialExpr.Interpolate;
}

export type ElementAttr = readonly [name: AttrName, value: AttrValue, namespace?: AttrOptions];
export type ElementModifier = InvokeOp<WellKnownAttrName.RESERVED>;

export const AttrSplat = 0;
export type AttrSplat = 0;

export type InlineBlock =
  | [[op: ContentOp.Params, ...params: number[]], ...Content[]]
  | Content[]
  // this represents an empty block, not "no block"
  | Null;

export function hasParams(
  block: [[op: ContentOp.Params, ...params: number[]], ...Content[]] | Content[]
): block is [[op: ContentOp.Params, ...params: number[]], ...Content[]] {
  let first = block[0];
  return Array.isArray(first) && first[0] === ContentOp.Params;
}

export function block(content: Content[], params?: number[]): InlineBlock {
  if (isPresent(content)) {
    params = params ? toPresentOption(params) || undefined : undefined;

    if (params) {
      return [[ContentOp.Params, ...params], ...content];
    } else {
      return [...content];
    }
  } else {
    return LiteralValue.Null;
  }
}

export type NamedBlocks = [names: string, ...blocks: InlineBlock[]];

export type ComponentParameter = ElementAttr | AttrSplat | ElementModifier;

export function isModifier(p: ComponentParameter): p is ElementModifier {
  return Array.isArray(p) && p[0] === WellKnownAttrName.RESERVED;
}

const INFLATE_ATTR_TABLE: {
  [I in WellKnownAttrName]: string;
} = ['class', 'id', 'value', 'name', 'type', 'style', 'href', undefined, undefined, 'RESERVED'];
const INFLATE_TAG_TABLE: {
  [I in WellKnownTagName]: string;
} = ['div', 'span', 'p', 'a'];

export function inflateTagName(tagName: string | WellKnownTagName): string {
  return typeof tagName === 'string' ? tagName : INFLATE_TAG_TABLE[tagName];
}

export function inflateAttrName(attrName: string | WellKnownAttrName): string {
  return typeof attrName === 'string' ? attrName : INFLATE_ATTR_TABLE[attrName];
}
