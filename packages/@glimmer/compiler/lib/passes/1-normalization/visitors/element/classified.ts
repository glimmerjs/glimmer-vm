import { ASTv2, maybeLoc, SourceSpan } from '@glimmer/syntax';
import { isPresent } from '@glimmer/util';

import { OptionalList } from '../../../../shared/list';
import { Ok, Result, ResultArray } from '../../../../shared/result';
import { getAttrNamespace } from '../../../../utils';
import * as mir from '../../../2-encoding/mir';
import { NormalizationState } from '../../context';
import { assertIsValidHelper, isHelperInvocation } from '../../utils/is-node';
import { VISIT_EXPRS } from '../expressions';

export type SimpleAttr = mir.StaticAttr | mir.DynamicAttr;
export type AttrWithSplat = SimpleAttr | mir.SplatAttr;

interface SimpleProcessedAttributes {
  attrs: SimpleAttr[];
  args: mir.NamedArguments;
  hasSplat: false;
}

interface DynamicProcessedAttributes {
  attrs: AttrWithSplat[];
  args: mir.NamedArguments;
  hasSplat: true;
}

type ProcessedAttributes = SimpleProcessedAttributes | DynamicProcessedAttributes;

type ValidAttr<A extends Allow> = A extends { splat: true } ? AttrWithSplat : SimpleAttr;

interface Allow {
  arg: boolean;
}

export interface Classified {
  readonly dynamicFeatures: boolean;

  arg(attr: ASTv2.AttrNode, classified: ClassifiedElement): Result<mir.NamedArgument>;
  toStatement(classified: ClassifiedElement, prepared: PreparedArgs): Result<mir.Content>;
}

export class ClassifiedElement {
  readonly delegate: Classified;

  constructor(
    readonly element: ASTv2.ElementNode,
    delegate: Classified,
    readonly state: NormalizationState
  ) {
    this.delegate = delegate;
  }

  toStatement(): Result<mir.Content> {
    return this.prepare().andThen((prepared) => this.delegate.toStatement(this, prepared));
  }

  private attr(attr: ASTv2.HtmlAttr): Result<AttrWithSplat> {
    let name = attr.name;
    let rawValue = attr.value;
    let namespace = getAttrNamespace(name.chars) || undefined;

    if (ASTv2.isLiteral(rawValue, 'string')) {
      return Ok(
        new mir.StaticAttr({
          loc: attr.loc,
          name,
          value: rawValue.toSlice(),
          namespace,
          kind: {
            component: this.delegate.dynamicFeatures,
          },
        })
      );
    }

    return VISIT_EXPRS.visit(rawValue, this.state).mapOk((value) => {
      let isTrusting = attr.trusting;

      return new mir.DynamicAttr({
        loc: attr.loc,
        name,
        value: value,
        namespace,
        kind: {
          trusting: isTrusting,
          component: this.delegate.dynamicFeatures,
        },
      });
    });
  }

  private modifier(modifier: ASTv2.ElementModifier): Result<mir.Modifier> {
    if (isHelperInvocation(modifier)) {
      assertIsValidHelper(modifier, modifier.loc, 'modifier');
    }

    let head = VISIT_EXPRS.visit(modifier.callee, this.state);
    let args = VISIT_EXPRS.Args(modifier.args, this.state);

    return Result.all(head, args).mapOk(
      ([head, args]) =>
        new mir.Modifier({
          loc: modifier.loc,
          callee: head,
          args,
        })
    );
  }

  private attrs<A extends Allow>(): Result<ProcessedAttributes> {
    let attrs = new ResultArray<AttrWithSplat>();
    let args = new ResultArray<mir.NamedArgument>();
    let hasSplat = false;

    let typeAttr: ASTv2.AttrNode | null = null;

    for (let attr of this.element.attrs) {
      if (attr.type === 'SplatAttr') {
        hasSplat = true;
        attrs.add(
          Ok(
            new mir.SplatAttr({
              loc: attr.loc,
              symbol: this.state.scope.allocateBlock('attrs'),
            }) as ValidAttr<A>
          )
        );
      } else if (attr.name.chars === 'type') {
        typeAttr = attr;
      } else {
        attrs.add(this.attr(attr));
      }
    }

    for (let arg of this.element.componentArgs) {
      args.add(this.delegate.arg(arg, this));
    }

    if (typeAttr) {
      attrs.add(this.attr(typeAttr));
    }

    return Result.all(args.toArray(), attrs.toArray()).mapOk(
      ([args, attrs]) =>
        ({
          attrs,
          args: new mir.NamedArguments({
            loc: maybeLoc(args, SourceSpan.NON_EXISTENT),
            entries: OptionalList(args),
          }),
          hasSplat,
        } as ProcessedAttributes)
    );
  }

  private prepare(): Result<PreparedArgs> {
    let attrs = this.attrs();
    let modifiers = new ResultArray(this.element.modifiers.map((m) => this.modifier(m))).toArray();

    return Result.all(attrs, modifiers).mapOk(([result, modifiers]) => {
      if (!result.args.isEmpty()) {
        let elementParams = [...result.attrs, ...modifiers];

        let params = new mir.DynamicElementParameters({
          loc: maybeLoc(elementParams, SourceSpan.NON_EXISTENT),
          body: OptionalList(elementParams),
        });

        return { type: 'component', args: result.args, params };
      } else if (result.hasSplat || isPresent(modifiers)) {
        let elementParams = [...result.attrs, ...modifiers];

        let params = new mir.DynamicElementParameters({
          loc: maybeLoc(elementParams, SourceSpan.NON_EXISTENT),
          body: OptionalList(elementParams as mir.DynamicElementAttr[]),
        });

        return { type: 'dynamic', args: result.args, params };
      } else {
        let params = new mir.ElementAttrs({
          loc: maybeLoc(result.attrs, SourceSpan.NON_EXISTENT),
          body: OptionalList(result.attrs),
        });

        return { type: 'simple', args: result.args, params };
      }
    });
  }
}

export type PreparedComponentArgs = {
  type: 'component';
  args: mir.NamedArguments;
  params: mir.DynamicElementParameters;
};

export type PreparedSimpleArgs = {
  type: 'simple';
  params: mir.ElementAttrs;
};

export type PreparedDynamicArgs = {
  type: 'dynamic';
  params: mir.DynamicElementParameters;
};

export type PreparedElementArgs = PreparedSimpleArgs | PreparedDynamicArgs;
export type PreparedArgs = PreparedComponentArgs | PreparedElementArgs;

export function hasDynamicFeatures({
  attrs,
  modifiers,
}: Pick<ASTv2.ElementNode, 'attrs' | 'modifiers'>): boolean {
  // ElementModifier needs the special ComponentOperations
  if (modifiers.length > 0) {
    return true;
  }

  // Splattributes need the special ComponentOperations to merge into
  return !!attrs.find((attr) => attr.type === 'SplatAttr');
}
