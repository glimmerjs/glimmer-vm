import { AttrNamespace } from '@simple-dom/interface';
import { PresentArray } from '@glimmer/interfaces';
import { Null, VariableNamespace } from './expr';
import { ContentDecoder, ContentOutput, Template, UnpackContent } from './unpack/content';
import { ExprDecoder, UnpackExpr } from './unpack/expr';

export function debugPacked(template: Template): ContentDebug[] {
  let expr: ExprDecoder<ExprDebugOutput> = new ExprDecoder(new ExprDebugDecoder(template));
  let content: ContentDecoder<ContentDebugOutput, ExprDebugOutput> = new ContentDecoder(
    template,
    new ContentDebugDecoder(template, expr),
    expr
  );

  return template.content.map((c) => content.content(c));
}

interface ContentDebugOutput extends ContentOutput {
  expr: ExprDebugOutput;
  content: ContentDebug;
  Append: AppendDebug;
  Debugger: '%debugger';
  Partial: ['%partial', ExpressionDebug];
  Yield: YieldDebug;
  InElement: InElementDebug;
  InvokeBlock: InvokeBlockDebug;
  Component: InvokeComponentDebug;
  SimpleElement: SimpleElementDebug;
  ElementModifier: CallDebug;
  SplatAttr: ['...attributes', '...attributes'];
  Interpolate: InterpolateDebug;
  inlineBlock: InlineBlockDebug;
  attrValue: AttrValueDebugWithoutNs;
  positionalArguments: PositionalDebug;
  namedArguments: NamedArgumentsDebug;
  args: ArgsDebug;
  namedBlocks: NamedBlocksDebug;
  componentParams: ElementParametersDebug;
  dynamicElementParams: ElementAttrDebug;
  simpleElementParams: ElementAttrDebug;
  elementAttrs: Record<string, AttrValueDebug>;
  elementAttr: ElementAttrDebug;
  elementAttrWithNs: ElementAttrDebug;
}

export class ContentDebugDecoder implements UnpackContent<ContentDebugOutput, ExprDebugOutput> {
  constructor(private scope: Scope, private expr: ExprDecoder<ExprDebugOutput>) {}

  inElement(
    destination: ExpressionDebug,
    block: InlineBlockDebug,
    insertBefore: ExpressionDebug | null
  ): InElementDebug {
    let out = ['%in-element', destination, block] as const;

    if (insertBefore !== null) {
      return [...out, insertBefore] as const;
    } else {
      return out;
    }
  }

  debugger(): '%debugger' {
    return '%debugger';
  }

  partial(target: ExpressionDebug): ['%partial', ExpressionDebug] {
    return ['%partial', target];
  }

  splatAttr(): ['...attributes', '...attributes'] {
    return ['...attributes', '...attributes'];
  }

  elementAttr(options: {
    name: string;
    value: AttrValueDebugWithoutNs;
    dynamic: true;
    trusting: boolean;
  }): ElementAttrDebug;
  elementAttr(options: {
    name: string;
    value: AttrValueDebugWithoutNs;
    dynamic: false;
    trusting: boolean;
  }): ElementAttrDebug;
  elementAttr(options: {
    name: string;
    value: AttrValueDebugWithoutNs;
    dynamic: boolean;
    trusting: boolean;
  }): ElementAttrDebug;
  elementAttr({
    name,
    value,
  }: {
    name: string;
    value: AttrValueDebugWithoutNs;
    dynamic: boolean;
    trusting: boolean;
  }): ElementAttrDebug {
    return [name, value];
  }

  elementAttrWithNs(options: {
    name: string;
    value: AttrValueDebugWithoutNs;
    ns: AttrNamespace;
    dynamic: true;
    trusting: boolean;
  }): ElementAttrDebug;
  elementAttrWithNs(options: {
    name: string;
    value: AttrValueDebugWithoutNs;
    ns: AttrNamespace;
    dynamic: false;
    trusting: boolean;
  }): ElementAttrDebug;
  elementAttrWithNs(options: {
    name: string;
    value: AttrValueDebugWithoutNs;
    ns: AttrNamespace;
    dynamic: boolean;
    trusting: boolean;
  }): ElementAttrDebug;
  elementAttrWithNs({
    name,
    value,
    ns,
  }: {
    name: string;
    value: AttrValueDebugWithoutNs;
    ns: AttrNamespace;
    dynamic: boolean;
    trusting: boolean;
  }): ElementAttrDebug {
    return [name, value, ns];
  }

  elementAttrs(attrs: ElementAttrDebug[]): Record<string, AttrValueDebug> {
    let out: Record<string, AttrValueDebug> = {};

    for (let [name, value] of attrs) {
      out[name] = value;
    }

    return out;
  }

  inlineBlock(params: number[], content: ContentDebug[]): InlineBlockDebug {
    if (content.length === 0) {
      return [];
    }

    if (params.length > 0) {
      return [['as', ...params.map((s) => this.scope.upvars[s])], ...content];
    } else {
      return content;
    }
  }

  modifier(callee: ExpressionDebug, args: ArgsDebug): CallDebug {
    return this.expr.decoder.invoke(callee, args);
  }

  append(value: ExpressionDebug, trusting: boolean): AppendDebug {
    if (typeof value === 'string') {
      return trusting ? `html|${value}` : `text|${value}`;
    } else {
      return trusting ? ['html', value] : ['text', value];
    }
  }

  appendComment(value: string): string {
    return `comment|${value}`;
  }

  yield(to: number, positional: ExpressionDebug[]): YieldDebug {
    if (isPresent(positional)) {
      return ['%yield', { to: this.scope.symbols[to] }, ...positional];
    } else {
      return ['%yield', { to: this.scope.symbols[to] }];
    }
  }

  invokeBlock(
    callee: ExpressionDebug,
    args: ArgsDebug,
    blocks: Record<string, InlineBlockDebug>
  ): InvokeBlockDebug {
    return ['{{#}}', callee, ...args, blocks];
  }

  simpleElement(
    tag: string,
    attrs: ElementAttrDebug[] | null,
    body: ContentDebug[] | null
  ): SimpleElementDebug {
    return this.dynamicElement(tag, attrs, body);
  }

  dynamicElement(
    tag: string,
    attrs: ElementAttrDebug[] | null,
    body: ContentDebug[] | null
  ): SimpleElementDebug {
    let attrRecord: Record<string, AttrValueDebug> | null = null;

    if (attrs) {
      attrRecord = {};
      for (let [key, value] of attrs) {
        attrRecord[key] = value;
      }
    }

    let tail = combineSpread(attrRecord, body);
    return [`<${tag}>`, ...tail];
  }
  component(
    callee: ExpressionDebug,
    params: ElementParametersDebug | null,
    args: Record<string, ExpressionDebug> | null,
    blocks: Record<string, InlineBlockDebug>
  ): InvokeComponentDebug {
    let head = ['<>', callee] as const;
    let argsPart = args ? ([args] as const) : ([] as const);
    let paramsPart = params ? ([params] as const) : ([] as const);

    return [...head, ...argsPart, ...paramsPart, blocks];
  }

  namedBlocks(blocks: null | [string, InlineBlockDebug][]): NamedBlocksDebug {
    if (blocks === null) {
      return null;
    }

    let o: Record<string, InlineBlockDebug> = {};

    for (let [name, block] of blocks) {
      o[name] = block;
    }

    return o;
  }

  interpolate(exprs: ExpressionDebug[]): InterpolateDebug {
    return ['+', ...exprs];
  }
}

type InlineBlockDebug = [['as', ...string[]], ...ContentDebug[]] | [...ContentDebug[]];

type NamedBlocksDebug = Record<string, InlineBlockDebug> | null;

type AttrsDebug = Record<string, AttrValueDebug> | null;

type InterpolateDebug = ['+', ...ExpressionDebug[]];
type AttrValueDebugWithoutNs = InterpolateDebug | ExpressionDebug;
type AttrValueDebug =
  | '...attributes'
  | AttrValueDebugWithoutNs
  | { value: AttrValueDebugWithoutNs; ns: AttrNamespace };

type ElementAttrDebug = readonly [name: string, value: AttrValueDebugWithoutNs, ns?: AttrNamespace];

type ElementParametersDebug = ElementParameterDebug[];
type ElementParameterDebug = ElementAttrDebug | CallDebug | '...attributes';

function isPresent<T>(value: T | null | undefined | Null): value is T {
  return value !== null && value !== undefined && value !== Null;
}

function combineSpread<T, U>(
  left: T | null | undefined,
  right: U[] | null | undefined
): [] | [T] | [...U[]] | [T, ...U[]] {
  if (left === null || left === undefined) {
    return right === null || right === undefined ? [] : right;
  } else {
    return right === null || right === undefined ? [left] : [left, ...right];
  }
}

export interface ExprDebugOutput {
  expr: ExpressionDebug;
  HasBlock: HasBlockDebug;
  HasBlockParams: HasBlockParamsDebug;
  Literal: null | undefined | boolean | string | number;
  GetThis: 'this';
  GetSymbol: string;
  GetNamespacedFree: string;
  GetStrictFree: string;
  GetLooseAttr: string;
  GetLooseAppend: string;
  GetPath: PathDebug;
  Invoke: CallDebug;
  positionalArguments: PositionalDebug;
  namedArguments: NamedArgumentsDebug;
  args: ArgsDebug;
}

export class ExprDebugDecoder implements UnpackExpr<ExprDebugOutput> {
  constructor(private scope: Scope) {}

  hasBlock(symbol: number | undefined): HasBlockDebug {
    if (symbol === undefined) {
      return '%has-block';
    } else {
      return ['%has-block', this.scope.upvars[symbol]];
    }
  }

  hasBlockParams(symbol: number | undefined): HasBlockParamsDebug {
    if (symbol === undefined) {
      return '%has-block-params';
    } else {
      return ['%has-block-params', this.scope.upvars[symbol]];
    }
  }

  literal(
    value: string | number | boolean | null | undefined
  ): string | number | boolean | null | undefined {
    return value;
  }

  getThis(): 'this' {
    return 'this';
  }

  getSymbol(value: number): string {
    return this.scope.symbols[value];
  }

  getNamespacedFree(upvar: number, namespace: VariableNamespace): string {
    return `${varNamespace(namespace)}::${this.scope.upvars[upvar]}`;
  }

  getStrictFree(upvar: number): string {
    return `!${this.scope.upvars[upvar]}`;
  }

  getLooseAttr(upvar: number): string {
    return `attr?::${this.scope.upvars[upvar]}`;
  }

  getLooseAppend(upvar: number): string {
    return `append?::${this.scope.upvars[upvar]}`;
  }

  getPath(head: ExpressionDebug, tail: string[]): PathDebug {
    return ['.', head, tail.join('.')];
  }

  invoke(callee: ExpressionDebug, args: ArgsDebug): CallDebug {
    return ['()', callee, ...args];
  }

  positional(positional: PresentArray<ExpressionDebug> | null): PositionalDebug {
    return positional;
  }

  namedArguments(
    named: [string, ExpressionDebug][] | null
  ): Record<string, ExpressionDebug> | null {
    if (named === null) {
      return null;
    }

    let o: Record<string, ExpressionDebug> = {};

    for (let [key, value] of named) {
      o[key] = value;
    }

    return o;
  }

  args(positional: PositionalDebug, named: Record<string, ExpressionDebug>): ArgsDebug {
    return combine(positional, named);
  }
}

export type CallDebug =
  | ['()', ExpressionDebug]
  | ['()', ExpressionDebug, PositionalDebug]
  | ['()', ExpressionDebug, NamedArgumentsDebug]
  | ['()', ExpressionDebug, PositionalDebug, NamedArgumentsDebug];

export type PathDebug = ['.', ExpressionDebug, string];

export type UnambiguousExpressionDebug = string | 'this' | PathDebug | CallDebug;

export type ArgsDebug =
  | []
  | [PositionalDebug]
  | [NamedArgumentsDebug]
  | [PositionalDebug, NamedArgumentsDebug];

export type PositionalDebug = ExpressionDebug[] | null;

export type NamedArgumentsDebug = Record<string, ExpressionDebug> | null;

type HasBlockDebug = '%has-block' | ['%has-block', ExpressionDebug];
type HasBlockParamsDebug = '%has-block-params' | ['%has-block-params', ExpressionDebug];

export type ExpressionDebug =
  | UnambiguousExpressionDebug
  | HasBlockDebug
  | HasBlockParamsDebug
  | null
  | undefined
  | boolean
  | string
  | number;

function varNamespace(ns: VariableNamespace): string {
  switch (ns) {
    case VariableNamespace.Component:
      return 'component';
    case VariableNamespace.Helper:
      return 'helper';
    case VariableNamespace.Modifier:
      return 'modifier';
    case VariableNamespace.HelperOrComponent:
      return 'append';
  }
}

export interface Scope {
  symbols: string[];
  upvars: string[];
}

export function combine<T, U>(
  left: T | null | undefined | Null,
  right: U | null | undefined | Null
): [] | [T] | [U] | [T, U] {
  if (isPresent(left)) {
    return isPresent(right) ? [left, right] : [left];
  } else {
    return isPresent(right) ? [right] : [];
  }
}
type AppendDebug = string | readonly ['html', ExpressionDebug] | readonly ['text', ExpressionDebug];

type YieldDebug =
  | readonly ['%yield', ...ExpressionDebug[]]
  | readonly ['%yield', { to: string }, ...ExpressionDebug[]];

type InvokeComponentDebug =
  | readonly ['<>', ExpressionDebug, NamedBlocksDebug]
  | readonly ['<>', ExpressionDebug, NamedArgumentsDebug, NamedBlocksDebug]
  | readonly ['<>', ExpressionDebug, ElementParametersDebug, NamedBlocksDebug]
  | readonly ['<>', ExpressionDebug, NamedArgumentsDebug, ElementParametersDebug, NamedBlocksDebug];

type SimpleElementDebug =
  | readonly [string /* `<...>` */, AttrsDebug]
  | readonly [string /* `<...>` */, AttrsDebug, ...ContentDebug[]]
  | readonly [string /* `<...>` */, ...ContentDebug[]]
  | readonly [string /* `<...>` */];

type InvokeBlockDebug =
  | readonly ['{{#}}', ExpressionDebug, NamedBlocksDebug]
  | readonly ['{{#}}', ExpressionDebug, PositionalDebug, NamedBlocksDebug]
  | readonly ['{{#}}', ExpressionDebug, NamedArgumentsDebug, NamedBlocksDebug]
  | readonly ['{{#}}', ExpressionDebug, PositionalDebug, NamedArgumentsDebug, NamedBlocksDebug];

type InElementDebug = readonly [
  op: '%in-element',
  destination: ExpressionDebug,
  block: InlineBlockDebug,
  insertBefore?: ExpressionDebug
];

type ContentDebug =
  | ExpressionDebug
  | string
  | '%debugger'
  | YieldDebug
  | readonly ['%partial', ExpressionDebug]
  | readonly ['html', ExpressionDebug]
  | readonly ['text', ExpressionDebug]
  | InvokeBlockDebug
  | SimpleElementDebug
  | InvokeComponentDebug
  | InElementDebug;
