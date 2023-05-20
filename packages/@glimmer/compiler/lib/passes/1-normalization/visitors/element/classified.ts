import { ASTv2, maybeLoc, src } from '@glimmer/syntax';

import { OptionalList } from '../../../../shared/list';
import { Ok, Result, ResultArray } from '../../../../shared/result';
import { getAttrNamespace as getAttributeNamespace } from '../../../../utils';
import * as mir from '../../../2-encoding/mir';
import type { NormalizationState } from '../../context';
import { MODIFIER_KEYWORDS } from '../../keywords';
import { assertIsValidModifier, isHelperInvocation } from '../../utils/is-node';
import { convertPathToCallIfKeyword, VISIT_EXPRS } from '../expressions';

export type ValidAttr = mir.StaticAttr | mir.DynamicAttr | mir.SplatAttr;

type ProcessedAttributes = {
  attrs: ValidAttr[];
  args: mir.NamedArguments;
};

export interface Classified {
  readonly dynamicFeatures: boolean;

  arg(attribute: ASTv2.AttrNode, classified: ClassifiedElement): Result<mir.NamedArgument>;
  toStatement(classified: ClassifiedElement, prepared: PreparedArgs): Result<mir.Statement>;
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

  toStatement(): Result<mir.Statement> {
    return this.prepare().andThen((prepared) => this.delegate.toStatement(this, prepared));
  }

  private attr(attribute: ASTv2.HtmlAttr): Result<ValidAttr> {
    let name = attribute.name;
    let rawValue = attribute.value;
    let namespace = getAttributeNamespace(name.chars) || undefined;

    if (ASTv2.isLiteral(rawValue, 'string')) {
      return Ok(
        new mir.StaticAttr({
          loc: attribute.loc,
          name,
          value: rawValue.toSlice(),
          namespace,
          kind: {
            component: this.delegate.dynamicFeatures,
          },
        })
      );
    }

    return VISIT_EXPRS.visit(convertPathToCallIfKeyword(rawValue), this.state).mapOk((value) => {
      let isTrusting = attribute.trusting;

      return new mir.DynamicAttr({
        loc: attribute.loc,
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
      assertIsValidModifier(modifier);
    }

    let translated = MODIFIER_KEYWORDS.translate(modifier, this.state);

    if (translated !== null) {
      return translated;
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

  private attrs(): Result<ProcessedAttributes> {
    let attributes = new ResultArray<ValidAttr>();
    let args = new ResultArray<mir.NamedArgument>();

    // Unlike most attributes, the `type` attribute can change how
    // subsequent attributes are interpreted by the browser. To address
    // this, in simple cases, we special case the `type` attribute to be set
    // last. For elements with splattributes, where attribute order affects
    // precedence, this re-ordering happens at runtime instead.
    // See https://github.com/glimmerjs/glimmer-vm/pull/726
    let typeAttribute: ASTv2.AttrNode | null = null;
    let simple = this.element.attrs.filter((attribute) => attribute.type === 'SplatAttr').length === 0;

    for (let attribute of this.element.attrs) {
      if (attribute.type === 'SplatAttr') {
        attributes.add(
          Ok(new mir.SplatAttr({ loc: attribute.loc, symbol: this.state.scope.allocateBlock('attrs') }))
        );
      } else if (attribute.name.chars === 'type' && simple) {
        typeAttribute = attribute;
      } else {
        attributes.add(this.attr(attribute));
      }
    }

    for (let argument of this.element.componentArgs) {
      args.add(this.delegate.arg(argument, this));
    }

    if (typeAttribute) {
      attributes.add(this.attr(typeAttribute));
    }

    return Result.all(args.toArray(), attributes.toArray()).mapOk(([args, attributes]) => ({
      attrs: attributes,
      args: new mir.NamedArguments({
        loc: maybeLoc(args, src.SourceSpan.NON_EXISTENT),
        entries: OptionalList(args),
      }),
    }));
  }

  private prepare(): Result<PreparedArgs> {
    let attributes = this.attrs();
    let modifiers = new ResultArray(this.element.modifiers.map((m) => this.modifier(m))).toArray();

    return Result.all(attributes, modifiers).mapOk(([result, modifiers]) => {
      let { attrs, args } = result;

      let elementParameters = [...attrs, ...modifiers];

      let parameters = new mir.ElementParameters({
        loc: maybeLoc(elementParameters, src.SourceSpan.NON_EXISTENT),
        body: OptionalList(elementParameters),
      });

      return { args, params: parameters };
    });
  }
}

export interface PreparedArgs {
  args: mir.NamedArguments;
  params: mir.ElementParameters;
}

export function hasDynamicFeatures({
  attrs,
  modifiers,
}: Pick<ASTv2.ElementNode, 'attrs' | 'modifiers'>): boolean {
  // ElementModifier needs the special ComponentOperations
  if (modifiers.length > 0) {
    return true;
  }

  // Splattributes need the special ComponentOperations to merge into
  return !!attrs.find((attribute) => attribute.type === 'SplatAttr');
}
