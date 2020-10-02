import { assert } from '@glimmer/util';
import { AttrNamespace } from '@simple-dom/interface';
import {
  AppendWhat,
  AttrSplat,
  AttrValue,
  Content,
  ContentOp,
  ElementAttr,
  ElementParameter,
  EvalInfo,
  hasParams,
  inflateAttrName,
  inflateTagName,
  InlineBlock,
  isInterpolate,
  isModifier,
  NamedBlocks,
  nsFor,
} from '../content';
import { Expression, Null } from '../expr';
import { PackedList } from '../shared';
import { content } from './content';
import {
  ArgsDebug,
  CallDebug,
  ExprDebugOutput,
  ExprDecoder,
  ExpressionDebug,
  ExprOutput,
  NamedArgumentsDebug,
  PositionalDebug,
} from './expr';

interface Scope {
  symbols: string[];
  upvars: string[];
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

interface Output {
  expr: ExprOutput;
  content: unknown;
  Append: unknown;
  Yield: unknown;
  Debugger: unknown;
  Partial: unknown;
  InElement: unknown;
  Block: unknown;
  Component: unknown;
  SimpleElement: unknown;
  ElementModifier: unknown;
  SplatAttr: unknown;
  Interpolate: unknown;
  elementAttr: unknown;
  elementAttrWithNs: unknown;
  elementAttrs: unknown;
  inlineBlock: unknown;
  attrValue: unknown;
  attrValueWithNs: unknown;
  positionalArguments: unknown;
  namedArguments: unknown;
  args: unknown;
  namedBlocks: unknown;
  componentParams: unknown;
  dynamicElementParams: unknown;
  simpleElementParams: unknown;
}

type SimpleElementAttrFor<O extends Output> = O['elementAttr'] | O['elementAttrWithNs'];

type DynamicElementAttrFor<O extends Output> = SimpleElementAttrFor<O> | O['SplatAttr'];

type ElementParameterFor<O extends Output> = DynamicElementAttrFor<O> | O['ElementModifier'];

interface UnpackContent<O extends Output> {
  append(value: O['expr']['expr'], what: AppendWhat): O['Append'];
  yield(to: number, positional: O['expr']['expr'][]): O['Yield'];
  debugger(info: EvalInfo): O['Debugger'];
  partial(target: O['expr']['expr'], info: EvalInfo): O['Partial'];
  inElement(
    destination: O['expr']['expr'],
    block: O['inlineBlock'],
    insertBefore: O['expr']['expr'] | null
  ): O['InElement'];
  invokeBlock(callee: O['expr']['expr'], args: O['args'], blocks: O['namedBlocks']): O['Block'];
  simpleElement(
    tag: string,
    attrs: SimpleElementAttrFor<O>[] | null,
    content: O['content'][] | null
  ): O['SimpleElement'];
  dynamicElement(
    tag: string,
    attrs: DynamicElementAttrFor<O>[] | null,
    content: O['content'][] | null
  ): O['SimpleElement'];
  component(
    callee: O['expr']['expr'],
    params: ElementParameterFor<O>[] | null,
    args: O['namedArguments'] | null,
    blocks: O['namedBlocks']
  ): O['Component'];
  modifier(callee: O['expr']['expr'], args: O['expr']['args']): O['ElementModifier'];
  splatAttr(): O['SplatAttr'];
  elementAttr(name: string, value: O['attrValue'] | O['Interpolate']): O['elementAttr'];
  elementAttrWithNs(
    name: string,
    value: O['attrValue'] | O['Interpolate'],
    ns: AttrNamespace
  ): O['elementAttrWithNs'];
  elementAttrs(attrs: (O['elementAttr'] | O['elementAttrWithNs'])[]): O['elementAttrs'];
  inlineBlock(params: number[], content: O['content'][]): O['inlineBlock'];
  namedBlocks(blocks: null | [string, O['inlineBlock']][]): O['namedBlocks'];
}

interface ContentDebugOutput extends Output {
  expr: ExprDebugOutput;
  content: ContentDebug;
  Append: AppendDebug;
  Debugger: '%debugger';
  Partial: ['%partial', ExpressionDebug];
  Yield: YieldDebug;
  InElement: InElementDebug;
  Block: InvokeBlockDebug;
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

class ContentDebugDecoder implements UnpackContent<ContentDebugOutput> {
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

  elementAttr(name: string, value: ExpressionDebug | InterpolateDebug): ElementAttrDebug {
    return [name, value];
  }

  elementAttrWithNs(
    name: string,
    value: ExpressionDebug | InterpolateDebug,
    ns: AttrNamespace
  ): ElementAttrDebug {
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

  append(value: string, what: AppendWhat | undefined): AppendDebug {
    if (what === undefined && typeof value === 'string') {
      switch (value[0]) {
        case '!':
          return `comment|${value.slice(1)}`;
        case '#':
          return `html|${value.slice(1)}`;
        default:
          return `text|${value}`;
      }
    }

    switch (what) {
      case AppendWhat.Comment:
        assert(typeof value === 'string', `dynamic contents are not allowed`);
        return `comment|${value}`;
      case AppendWhat.Html: {
        if (typeof value === 'string') {
          return `html|${value}`;
        } else {
          return ['html', this.expr.expr(value)];
        }
      }
      case AppendWhat.Text:
        if (typeof value === 'string') {
          return `text|${value}`;
        } else {
          return ['text', this.expr.expr(value)];
        }
      case undefined:
        return ['text', this.expr.expr(value)];
    }
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
}

class ContentDecoder<O extends Output> {
  constructor(
    private scope: Scope,
    private decoder: UnpackContent<O>,
    private expr: ExprDecoder<ExprDebugOutput>
  ) {}

  content(c: Content): O['content'] {
    if (c === ContentOp.Yield) {
      return this.decoder.yield(this.scope.symbols.indexOf('&default'), []);
    }

    switch (c[0]) {
      case ContentOp.Append: {
        let [, value, what] = c;
        return this.decoder.append(value, what === undefined ? AppendWhat.Html : what);
      }

      case ContentOp.InvokeBlock: {
        let [, callee, blocks, p, n] = c;

        return this.decoder.invokeBlock(
          this.expr.expr(callee),
          this.expr.args(p, n),
          this.namedBlocks(blocks)
        );
      }

      case ContentOp.InvokeComponent: {
        let [, callee, blocks, elementParameters, a] = c;

        let decodedCallee = this.expr.expr(callee);

        let args = this.expr.namedArguments(a);
        let params = this.elementParameters(elementParameters);
        let decodedBlocks = this.namedBlocks(blocks);

        return this.decoder.component(decodedCallee, params, args, decodedBlocks);
      }

      case ContentOp.SplatElement: {
        let [, packedTag, packedAttrs, packedBody] = c;

        let tag = inflateTagName(packedTag);
        let attrs = this.attrs(packedAttrs);
        let body = this.contentBody(packedBody);

        return this.decoder.dynamicElement(tag, attrs, body);
      }

      case ContentOp.SimpleElement: {
        let [, packedTag, packedAttrs, packedBody] = c;

        let tag = inflateTagName(packedTag);
        let attrs = this.attrs(packedAttrs);
        let body = this.contentBody(packedBody);

        return this.decoder.simpleElement(tag, attrs, body);
      }

      case ContentOp.Yield: {
        let [, to, ...exprs]: [unknown, to: number, ...exprs: Expression[]] = c;
        return this.decoder.yield(
          to,
          exprs.map((e) => this.expr.expr(e))
        );
      }

      case ContentOp.Debugger: {
        return this.decoder.debugger(c[1]);
      }

      case ContentOp.Partial:
        return this.decoder.partial(this.expr.expr(c[1]), c[2]);

      case ContentOp.InElement: {
        let [, packedDestination, packedBlock, packedInsertBefore] = c;

        let dest = this.expr.expr(packedDestination);
        let block = this.block(packedBlock);
        let insertBefore =
          packedInsertBefore === undefined ? null : this.expr.expr(packedInsertBefore);

        return this.decoder.inElement(dest, block, insertBefore);
      }
    }
  }

  private contentBody(body: Content[] | Null | undefined): O['content'][] | null {
    if (body === Null || body === undefined) {
      return null;
    }

    return body.map((b) => this.content(b));
  }

  private attrValueWithoutNs(value: AttrValue): AttrValueDebugWithoutNs {
    if (isInterpolate(value)) {
      let [, ...parts] = value;
      return ['+', ...parts.map((p) => this.expr.expr(p))];
    } else {
      return this.expr.expr(value);
    }
  }

  private attrs(
    attrs: PackedList<ElementAttr> | undefined | Null
  ): (O['elementAttr'] | O['elementAttrWithNs'])[] | null;
  private attrs(
    attrs: PackedList<ElementAttr | AttrSplat> | undefined | Null
  ): (O['elementAttr'] | O['elementAttrWithNs'] | O['SplatAttr'])[] | null;
  private attrs(
    attrs: PackedList<ElementAttr | AttrSplat> | undefined | Null
  ): (O['elementAttr'] | O['elementAttrWithNs'] | O['SplatAttr'])[] | null {
    if (attrs === Null || attrs === undefined) {
      return null;
    }

    let out: (O['elementAttr'] | O['elementAttrWithNs'])[] = [];

    for (let attr of attrs) {
      if (attr === AttrSplat) {
        out.push(this.decoder.splatAttr());
      } else {
        let [name, value, namespace] = attr;
        let inflatedName = inflateAttrName(name);
        let ns = nsFor(namespace);

        if (ns) {
          out.push(this.decoder.elementAttrWithNs(inflatedName, value, ns));
        } else {
          out.push(this.decoder.elementAttr(inflatedName, value));
        }
      }
    }

    return out;
  }

  private attr([name, value, namespace]: ElementAttr): O['elementAttr'] | O['elementAttrWithNs'] {
    let n = inflateAttrName(name);
    let v = this.attrValueWithoutNs(value);
    let ns = nsFor(namespace);

    if (ns) {
      return this.decoder.elementAttrWithNs(n, v, ns);
    } else {
      return this.decoder.elementAttr(n, v);
    }
  }

  private elementParameters(
    params: PackedList<ElementParameter> | undefined
  ): ElementParameterFor<O>[] | null {
    if (params === Null || params === undefined) {
      return null;
    }

    return params.map((p) => this.parameter(p));
  }

  private parameter(p: ElementParameter): ElementParameterFor<O> {
    if (p === AttrSplat) {
      return '...attributes';
    } else if (isModifier(p)) {
      return this.decoder.modifier(this.expr.expr(p[1]), this.expr.args(p[2], p[3]));
    } else {
      return this.attr(p);
    }
  }

  private block(p: InlineBlock): O['Block'] {
    if (p === Null) {
      return this.decoder.inlineBlock([], []);
    } else {
      if (hasParams(p)) {
        let [first, ...rest] = p;
        let [, ...symbols] = first;

        return this.decoder.inlineBlock(
          symbols,
          rest.map((r) => this.content(r))
        );
      } else {
        return this.decoder.inlineBlock(
          [],
          p.map((r) => content(r, this.scope))
        );
      }
    }
  }

  private namedBlocks(p: NamedBlocks): O['namedBlocks'] {
    let [joinedNames, ...list] = p;
    let names = joinedNames.split('|');

    let blocks: [string, O['inlineBlock']][] = [];

    names.forEach((n, i) => blocks.push([n, this.block(list[i + i])]));

    return this.decoder.namedBlocks(blocks);
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
