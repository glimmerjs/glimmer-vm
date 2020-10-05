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
  nsFor,
  isTrusted,
  ElementModifier,
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

export declare abstract class ContentOutput {
  abstract Append: unknown;
  abstract Comment: unknown;
  abstract Yield: unknown;
  abstract Debugger: unknown;
  abstract Partial: unknown;
  abstract InElement: unknown;
  abstract InvokeBlock: unknown;
  abstract Component: unknown;
  abstract SimpleElement: unknown;
  abstract DynamicElement: unknown;
  abstract ElementModifier: unknown;
  abstract SplatAttr: unknown;
  abstract Interpolate: unknown;
  abstract inlineBlock: unknown;
  abstract positionalArguments: unknown;
  abstract namedArguments: unknown;
  abstract args: unknown;
  abstract namedBlocks: unknown;
  abstract componentParams: unknown;
  abstract dynamicElementParams: unknown;
  abstract simpleElementParams: unknown;

  abstract elementAttr: unknown;
  abstract elementAttrWithNs: unknown;
  abstract elementAttrs: unknown;

  abstract dynamicElementAttr: unknown;
  abstract dynamicElementAttrWithNs: unknown;
  abstract dynamicElementAttrs: unknown;

  content:
    | this['Append']
    | this['Comment']
    | this['Yield']
    | this['Debugger']
    | this['Partial']
    | this['InElement']
    | this['InvokeBlock']
    | this['Component']
    | this['SimpleElement']
    | this['DynamicElement'];
}

type SimpleElementAttrFor<O extends ContentOutput> = O['elementAttr'] | O['elementAttrWithNs'];
type DynamicElementAttrFor<O extends ContentOutput> =
  | O['dynamicElementAttr']
  | O['dynamicElementAttrWithNs']
  | O['SplatAttr'];
type ElementParameterFor<O extends ContentOutput> = DynamicElementAttrFor<O> | O['ElementModifier'];

export abstract class UnpackContent<O extends ContentOutput, Expr extends ExprOutput> {
  abstract append(value: Expr['expr'], trusting: boolean): O['Append'];
  abstract appendComment(value: string): O['Comment'];
  abstract yield(to: number, positional: Expr['expr'][]): O['Yield'];
  abstract debugger(info: EvalInfo): O['Debugger'];
  abstract partial(target: Expr['expr'], info: EvalInfo): O['Partial'];
  abstract inElement(
    destination: Expr['expr'],
    block: O['inlineBlock'],
    insertBefore: Expr['expr'] | null,
    guid: string
  ): O['InElement'];
  abstract invokeBlock(
    callee: Expr['expr'],
    args: O['args'],
    blocks: O['namedBlocks']
  ): O['InvokeBlock'];
  abstract simpleElement(
    tag: string,
    attrs: SimpleElementAttrFor<O>[] | null,
    content: O['content'][] | null
  ): O['SimpleElement'];
  abstract dynamicElement(
    tag: string,
    attrs: DynamicElementAttrFor<O>[] | null,
    content: O['content'][] | null
  ): O['DynamicElement'];
  abstract component(
    callee: Expr['expr'],
    params: ElementParameterFor<O>[] | null,
    args: O['namedArguments'] | null,
    blocks: O['namedBlocks']
  ): O['Component'];
  abstract modifier(callee: Expr['expr'], args: Expr['args']): O['ElementModifier'];
  abstract splatAttr(): O['SplatAttr'];
  abstract interpolate(exprs: PresentArray<Expr['expr']>): O['Interpolate'];

  abstract inlineBlock(params: number[], content: O['content'][]): O['inlineBlock'];
  abstract namedBlocks(blocks: null | [string, O['inlineBlock']][]): O['namedBlocks'];

  abstract elementAttrs(
    attrs: (O['elementAttr'] | O['elementAttrWithNs'])[],
    dynamic: false
  ): O['elementAttrs'];
  abstract elementAttrs(
    attrs: (O['dynamicElementAttr'] | O['dynamicElementAttrWithNs'])[],
    dynamic: true
  ): O['dynamicElementAttrs'];

  abstract elementAttr(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    dynamic: true;
    trusting: boolean;
  }): O['dynamicElementAttr'];
  abstract elementAttr(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    dynamic: false;
    trusting: boolean;
  }): O['elementAttr'];
  abstract elementAttr(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    dynamic: boolean;
    trusting: boolean;
  }): O['elementAttr'] | O['dynamicElementAttr'];

  abstract elementAttrWithNs(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    ns: AttrNamespace;
    dynamic: true;
    trusting: boolean;
  }): O['dynamicElementAttrWithNs'];
  abstract elementAttrWithNs(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    ns: AttrNamespace;
    dynamic: false;
    trusting: boolean;
  }): O['elementAttrWithNs'];
  abstract elementAttrWithNs(options: {
    name: string;
    value: Expr['expr'] | O['Interpolate'];
    ns: AttrNamespace;
    dynamic: boolean;
    trusting: boolean;
  }): O['elementAttrWithNs'] | O['dynamicElementAttrWithNs'];
}

export class ContentDecoder<C extends ContentOutput, Expr extends ExprOutput> {
  constructor(
    private scope: Scope,
    private decoder: UnpackContent<C, Expr>,
    private expr: ExprDecoder<Expr>
  ) {}

  content(c: Content): C['content'] {
    if (c === ContentOp.Yield) {
      return this.decoder.yield(this.scope.symbols.indexOf('&default'), []);
    }

    switch (c[0]) {
      case ContentOp.Append: {
        let [, value, what] = c;

        if (what === undefined && typeof value === 'string') {
          switch (value[0]) {
            case '!':
              return this.decoder.appendComment(value.slice(1));
            case '#':
              return this.decoder.append(value.slice(1), true);
            default:
              return this.decoder.append(value, true);
          }
        }

        switch (c[2]) {
          case undefined:
          case AppendWhat.Text:
            return this.decoder.append(this.expr.expr(value), false);
          case AppendWhat.Html:
            return this.decoder.append(this.expr.expr(value), true);
          case AppendWhat.Comment:
            return this.decoder.appendComment(c[1]);
        }
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
        let [, packedDestination, packedBlock, guid, packedInsertBefore] = c;

        let dest = this.expr.expr(packedDestination);
        let block = this.block(packedBlock);
        let insertBefore =
          packedInsertBefore === undefined ? null : this.expr.expr(packedInsertBefore);

        return this.decoder.inElement(dest, block, insertBefore, guid);
      }
    }
  }

  private contentBody(body: Content[] | Null | undefined): C['content'][] | null {
    if (body === Null || body === undefined) {
      return null;
    }

    return body.map((b) => this.content(b));
  }

  private attrValueWithoutNs(value: AttrValue): Expr['expr'] | C['Interpolate'] {
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
    attrs: PackedList<ElementAttr | ElementModifier> | undefined | Null,
    dynamic: false
  ): (C['elementAttr'] | C['elementAttrWithNs'] | C['ElementModifier'])[] | null;
  private attrs(
    attrs: PackedList<ElementAttr | ElementModifier | AttrSplat> | undefined | Null,
    dynamic: true
  ):
    | (
        | C['dynamicElementAttr']
        | C['dynamicElementAttrWithNs']
        | C['ElementModifier']
        | C['SplatAttr']
      )[]
    | null;
  private attrs(
    attrs: PackedList<ElementAttr | ElementModifier | AttrSplat> | undefined | Null,
    dynamic: true | false
  ): (C['elementAttr'] | C['elementAttrWithNs'] | C['ElementModifier'] | C['SplatAttr'])[] | null {
    if (attrs === Null || attrs === undefined) {
      return null;
    }

    let out: (C['elementAttr'] | C['elementAttrWithNs'])[] = [];

    for (let attr of attrs) {
      if (attr === AttrSplat) {
        out.push(this.decoder.splatAttr());
      } else if (isModifier(attr)) {
        let [, callee, positional, named] = attr;
        out.push(this.decoder.modifier(this.expr.expr(callee), this.expr.args(positional, named)));
      } else {
        let [name, value, namespace] = attr;
        let inflatedName = inflateAttrName(name);
        let ns = nsFor(namespace);
        let trusting = isTrusted(namespace);

        if (ns) {
          out.push(
            this.decoder.elementAttrWithNs({ name: inflatedName, value, ns, dynamic, trusting })
          );
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
  ): C['elementAttr'] | C['elementAttrWithNs'] {
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
  ): ElementParameterFor<C>[] | null {
    if (params === Null || params === undefined) {
      return null;
    }

    return params.map((p) => this.componentParameter(p));
  }

  private componentParameter(p: ComponentParameter): ElementParameterFor<C> {
    if (p === AttrSplat) {
      return '...attributes';
    } else if (isModifier(p)) {
      return this.decoder.modifier(this.expr.expr(p[1]), this.expr.args(p[2], p[3]));
    } else {
      return this.attr(p, true);
    }
  }

  private block(p: InlineBlock): C['InvokeBlock'] {
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

  private namedBlocks(p: NamedBlocks): C['namedBlocks'] {
    let [joinedNames, ...list] = p;
    let names = joinedNames.split('|');

    let blocks: [string, C['inlineBlock']][] = [];

    names.forEach((n, i) => blocks.push([n, this.block(list[i + i])]));

    return this.decoder.namedBlocks(blocks);
  }
}
