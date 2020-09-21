import { ASTv2 } from '@glimmer/syntax';
import { OptionalList } from '../../../../shared/list';
import { Ok, Result, ResultArray } from '../../../../shared/result';
import { getAttrNamespace } from '../../../../utils';
import * as hir from '../../../2-symbol-allocation/hir';
import { NormalizationUtilities } from '../../context';
import { assertIsValidHelper, isHelperInvocation } from '../../utils/is-node';
import { VISIT_EXPRS } from '../expressions';

export type ValidAttr = hir.Attr | hir.AttrSplat;

type ProcessedAttributes = {
  attrs: ValidAttr[];
  args: hir.Named;
};

export interface Classified {
  readonly dynamicFeatures: boolean;

  arg(attr: ASTv2.AttrNode, classified: ClassifiedElement): Result<hir.NamedEntry>;
  toStatement(classified: ClassifiedElement, prepared: PreparedArgs): Result<hir.Statement>;
}

export class ClassifiedElement {
  readonly delegate: Classified;

  constructor(
    readonly element: ASTv2.ElementNode,
    delegate: Classified,
    readonly utils: NormalizationUtilities
  ) {
    this.delegate = delegate;
  }

  toStatement(): Result<hir.Statement> {
    return this.prepare().andThen((prepared) => this.delegate.toStatement(this, prepared));
  }

  private splatAttr(attr: ASTv2.SplatAttr): Result<ValidAttr> {
    return Ok(this.utils.op(hir.AttrSplat).loc(attr));
  }

  private attr(attr: ASTv2.HtmlAttr): Result<ValidAttr> {
    let name = attr.name;
    let rawValue = attr.value;

    let namespace = getAttrNamespace(name.chars) || undefined;
    return VISIT_EXPRS.visit(rawValue, this.utils).mapOk((value) => {
      let isTrusting = attr.trusting;

      return this.utils
        .op(hir.Attr, {
          name,
          value: value,
          namespace,
          kind: {
            trusting: isTrusting,
            component: this.delegate.dynamicFeatures,
          },
        })
        .loc(attr);
    });
  }

  private modifier(modifier: ASTv2.ElementModifier): Result<hir.Modifier> {
    if (isHelperInvocation(modifier)) {
      assertIsValidHelper(modifier, modifier.loc, 'modifier');
    }

    let head = VISIT_EXPRS.visit(modifier.callee, this.utils);
    let args = VISIT_EXPRS.Args(modifier.args, this.utils);

    return Result.all(head, args).mapOk(([head, args]) =>
      this.utils
        .op(hir.Modifier, {
          head,
          args,
        })
        .loc(modifier)
    );
  }

  private attrs(): Result<ProcessedAttributes> {
    let attrs = new ResultArray<ValidAttr>();
    let args = new ResultArray<hir.NamedEntry>();

    let typeAttr: ASTv2.AttrNode | null = null;

    for (let attr of this.element.attrs) {
      if (attr.type === 'SplatAttr') {
        attrs.add(this.splatAttr(attr));
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

    return Result.all(args.toArray(), attrs.toArray()).mapOk(([args, attrs]) => ({
      attrs,
      args: this.utils
        .op(hir.Named, { pairs: OptionalList(args) })
        .maybeLoc(args, this.utils.source.NON_EXISTENT),
    }));
  }

  private prepare(): Result<PreparedArgs> {
    let attrs = this.attrs();
    let modifiers = new ResultArray(this.element.modifiers.map((m) => this.modifier(m))).toArray();

    return Result.all(attrs, modifiers).mapOk(([result, modifiers]) => {
      let { attrs, args } = result;

      let elementParams = [...attrs, ...modifiers];

      let params = this.utils
        .op(hir.ElementParameters, {
          body: OptionalList(elementParams),
        })
        .maybeLoc(elementParams, this.utils.source.NON_EXISTENT);

      return { args, params };
    });
  }
}

export interface PreparedArgs {
  args: hir.Named;
  params: hir.ElementParameters;
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
  return !!attrs.find((attr) => attr.type === 'SplatAttr');
}
