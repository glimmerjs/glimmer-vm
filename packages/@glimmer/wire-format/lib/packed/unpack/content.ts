import { AttrNamespace } from '@simple-dom/interface';
import { PresentArray } from '@glimmer/interfaces';
import {
  AppendWhat,
  AttrSplat,
  AttrValue,
  Content,
  ContentOp,
  ElementAttr,
  ComponentParameter,
  EvalInfo,
  hasParams,
  inflateAttrName,
  inflateTagName,
  InlineBlock,
  isInterpolate,
  isModifier,
  NamedBlocks,
  nsFor,, isTrusted
} from '../content';
import { Expression, Null } from '../expr';
import { PackedList } from '../shared';
import { ExprDecoder, ExprOutput } from './expr';
import { assertPresent } from '@glimmer/util';

export interface Template {
  content: Content[];
  symbols: string[];
  upvars: string[];
  hasEval: boolean;
}

interface Scope {
  symbols: string[];
  upvars: string[];
}

export interface ContentOutput {
  content: unknown;
  Append: unknown;
  Comment: unknown;
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
  inlineBlock: unknown;
  positionalArguments: unknown;
  namedArguments: unknown;
  args: unknown;
  namedBlocks: unknown;
  componentParams: unknown;
  dynamicElementParams: unknown;
  simpleElementParams: unknown;

  elementAttr: unknown;
  dynamicElementAttr: unknown;
  elementAttrWithNs: unknown;
  dynamicElementAttrWithNs: unknown;
  elementAttrs: unknown;
  dynamicElementAttrs: unknown;
}

type SimpleElementAttrFor<O extends ContentOutput> = O['elementAttr'] | O['elementAttrWithNs'];
type DynamicElementAttrFor<O extends ContentOutput> =
  | O['dynamicElementAttr']
  | O['dynamicElementAttrWithNs']
  | O['SplatAttr'];
type ElementParameterFor<O extends ContentOutput> = DynamicElementAttrFor<O> | O['ElementModifier'];

export interface UnpackContent<O extends ContentOutput, Expr extends ExprOutput> {
  append(value: Expr['expr'], trusting: boolean): O['Append'];
  appendComment(value: string): O['Comment'];
  yield(to: number, positional: Expr['expr'][]): O['Yield'];
  debugger(info: EvalInfo): O['Debugger'];
  partial(target: Expr['expr'], info: EvalInfo): O['Partial'];
  inElement(
    destination: Expr['expr'],
    block: O['inlineBlock'],
    insertBefore: Expr['expr'] | null
  ): O['InElement'];
  invokeBlock(callee: Expr['expr'], args: O['args'], blocks: O['namedBlocks']): O['Block'];
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
    callee: Expr['expr'],
    params: ElementParameterFor<O>[] | null,
    args: O['namedArguments'] | null,
    blocks: O['namedBlocks']
  ): O['Component'];
  modifier(callee: Expr['expr'], args: Expr['args']): O['ElementModifier'];
  splatAttr(): O['SplatAttr'];
  interpolate(exprs: PresentArray<Expr['expr']>): O['Interpolate'];

  inlineBlock(params: number[], content: O['content'][]): O['inlineBlock'];
  namedBlocks(blocks: null | [string, O['inlineBlock']][]): O['namedBlocks'];

  elementAttrs(
    attrs: (O['elementAttr'] | O['elementAttrWithNs'])[],
    dynamic: false
  ): O['elementAttrs'];
  elementAttrs(
    attrs: (O['dynamicElementAttr'] | O['dynamicElementAttrWithNs'])[],
    dynamic: true
  ): O['dynamicElementAttrs'];

  elementAttr(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    dynamic: true;
    trusting: boolean;
  }): O['dynamicElementAttr'];
  elementAttr(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    dynamic: false;
    trusting: boolean;
  }): O['elementAttr'];
  elementAttr(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    dynamic: boolean;
    trusting: boolean;
  }): O['elementAttr'] | O['dynamicElementAttr'];

  elementAttrWithNs(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    ns: AttrNamespace;
    dynamic: true;
    trusting: boolean;
  }): O['dynamicElementAttrWithNs'];
  elementAttrWithNs(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    ns: AttrNamespace;
    dynamic: false;
    trusting: boolean;
  }): O['elementAttrWithNs'];
  elementAttrWithNs(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    ns: AttrNamespace;
    dynamic: boolean;
    trusting: boolean;
  }): O['elementAttrWithNs'] | O['dynamicElementAttrWithNs'];
}

export class ContentDecoder<O extends ContentOutput, Expr extends ExprOutput> {
  constructor(
    private scope: Scope,
    private decoder: UnpackContent<O, Expr>,
    private expr: ExprDecoder<Expr>
  ) {}

  content(c: Content): O['content'] {
    if (c === ContentOp.Yield) {
      return this.decoder.yield(this.scope.symbols.indexOf('&default'), []);
    }

    switch (c[0]) {
      case ContentOp.Append: {
        let [, value, what] = c;
        return this.decoder.append(
          this.expr.expr(value),
          what === undefined ? AppendWhat.Html : what
        );
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
        let params = this.componentParameters(elementParameters);
        let decodedBlocks = this.namedBlocks(blocks);

        return this.decoder.component(decodedCallee, params, args, decodedBlocks);
      }

      case ContentOp.SplatElement: {
        let [, packedTag, packedAttrs, packedBody] = c;

        let tag = inflateTagName(packedTag);
        let attrs = this.attrs(packedAttrs, true);
        let body = this.contentBody(packedBody);

        return this.decoder.dynamicElement(tag, attrs, body);
      }

      case ContentOp.SimpleElement: {
        let [, packedTag, packedAttrs, packedBody] = c;

        let tag = inflateTagName(packedTag);
        let attrs = this.attrs(packedAttrs, false);
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

  private attrValueWithoutNs(value: AttrValue): Expr['expr'] | O['Interpolate'] {
    if (isInterpolate(value)) {
      let [, ...parts] = value;
      let concat = parts.map((p) => this.expr.expr(p));
      assertPresent(concat);

      return this.decoder.interpolate(concat);
    } else {
      return this.expr.expr(value);
    }
  }

  private attrs(
    attrs: PackedList<ElementAttr> | undefined | Null,
    dynamic: false
  ): (O['elementAttr'] | O['elementAttrWithNs'])[] | null;
  private attrs(
    attrs: PackedList<ElementAttr | AttrSplat> | undefined | Null,
    dynamic: true
  ): (O['dynamicElementAttr'] | O['dynamicElementAttrWithNs'] | O['SplatAttr'])[] | null;
  private attrs(
    attrs: PackedList<ElementAttr | AttrSplat> | undefined | Null,
    dynamic: true | false
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
        let trusting = isTrusted(namespace);

        if (ns) {
          out.push(this.decoder.elementAttrWithNs({ name: inflatedName, value, ns, dynamic, trusting }));
        } else {
          out.push(this.decoder.elementAttr({ name: inflatedName, value, dynamic, trusting }));
        }
      }
    }

    return out;
  }

  private attr(
    [name, value, namespace]: ElementAttr,
    dynamic: boolean
  ):
    | O['elementAttr']
    | O['elementAttrWithNs']
    | O['dynamicElementAttr']
    | O['dynamicElementAttrWithNs'] {
    let n = inflateAttrName(name);
    let v = this.attrValueWithoutNs(value);
    let ns = nsFor(namespace);
    let trusting = isTrusted(namespace);

    if (ns) {
      return this.decoder.elementAttrWithNs({ name: n, value: v, ns, dynamic, trusting });
    } else {
      return this.decoder.elementAttr({ name: n, value: v, dynamic, trusting });
    }
  }

  private componentParameters(
    params: PackedList<ComponentParameter> | undefined
  ): ElementParameterFor<O>[] | null {
    if (params === Null || params === undefined) {
      return null;
    }

    return params.map((p) => this.componentParameter(p));
  }

  private componentParameter(p: ComponentParameter): ElementParameterFor<O> {
    if (p === AttrSplat) {
      return '...attributes';
    } else if (isModifier(p)) {
      return this.decoder.modifier(this.expr.expr(p[1]), this.expr.args(p[2], p[3]));
    } else {
      return this.attr(p, true);
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
          p.map((r) => this.content(r))
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
