import { Optional } from '@glimmer/interfaces';
import { ASTv2 } from '@glimmer/syntax';
import { OptionalList } from '../../../../shared/list';
import { Ok, Result, ResultArray } from '../../../../shared/result';
import { getAttrNamespace } from '../../../../utils';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../../2-symbol-allocation/hir';
import { VisitorContext } from '../../context';
import { assertIsValidHelper, isHelperInvocation } from '../../utils/is-node';
import { VISIT_EXPRS } from '../expressions';

export type ValidAttr = pass1.Attr | pass1.AttrSplat;

type ProcessedAttributes = {
  attrs: ValidAttr[];
  args: pass1.NamedArguments;
};

export interface Classified<Body> {
  readonly dynamicFeatures: boolean;

  arg(attr: ASTv2.AttrNode, classified: ClassifiedElement<Body>): Result<pass1.NamedArgument>;
  toStatement(classified: ClassifiedElement<Body>, prepared: PreparedArgs<Body>): pass1.Statement;
  body(classified: ClassifiedElement<Body>): Result<Body>;
}

export class ClassifiedElement<Body> {
  readonly delegate: Classified<Body>;

  constructor(
    readonly element: ASTv2.ElementNode,
    delegate: Classified<Body>,
    readonly ctx: VisitorContext
  ) {
    this.delegate = delegate;
  }

  toStatement(): Result<pass1.Statement> {
    return this.prepare().mapOk((prepared) => this.delegate.toStatement(this, prepared));
  }

  private attr(attr: ASTv2.AttrNode): Result<ValidAttr> {
    let name = attr.name;
    let rawValue = attr.value;

    let namespace = getAttrNamespace(name) || undefined;
    let value = VISIT_EXPRS.visit(rawValue, this.ctx);

    let isTrusting = attr.trusting;

    // splattributes
    // this is grouped together with attributes because its position matters
    if (name === '...attributes') {
      return Ok(this.ctx.utils.op(pass1.AttrSplat).loc(attr));
    }

    return Ok(
      this.ctx.utils
        .op(pass1.Attr, {
          name: this.ctx.utils.slice(name).offsets(null),
          value: value,
          namespace,
          kind: {
            trusting: isTrusting,
            component: this.delegate.dynamicFeatures,
          },
        })
        .loc(attr)
    );
  }

  private modifier(modifier: ASTv2.ElementModifierStatement): pass1.Modifier {
    if (isHelperInvocation(modifier)) {
      assertIsValidHelper(modifier, modifier.loc, 'modifier');
    }

    return this.ctx.utils
      .op(pass1.Modifier, {
        head: VISIT_EXPRS.visit(modifier.func, this.ctx),
        params: this.ctx.utils.params({ func: modifier.func, params: modifier.params }),
        hash: this.ctx.utils.hash(modifier.hash),
      })
      .loc(modifier);
  }

  private attrs(): Result<ProcessedAttributes> {
    let attrs = new ResultArray<ValidAttr>();
    let args = new ResultArray<pass1.NamedArgument>();

    let typeAttr: Optional<ASTv2.AttrNode> = null;

    for (let attr of this.element.attributes) {
      if (attr.name === 'type') {
        typeAttr = attr;
      } else if (attr.name[0] === '@') {
        args.add(this.delegate.arg(attr, this));
      } else {
        attrs.add(this.attr(attr));
      }
    }

    if (typeAttr) {
      attrs.add(this.attr(typeAttr));
    }

    return Result.all(args.toArray(), attrs.toArray()).mapOk(([args, attrs]) => ({
      attrs,
      args: this.ctx.utils.op(pass1.NamedArguments, { pairs: OptionalList(args) }).offsets(null),
    }));
  }

  private prepare(): Result<PreparedArgs<Body>> {
    let result = this.attrs();

    return result.andThen((result) => {
      let { attrs, args } = result;

      let modifiers = this.element.modifiers.map((m) => this.modifier(m));
      let params = this.ctx.utils
        .op(pass1.ElementParameters, {
          body: OptionalList([...attrs, ...modifiers]),
        })
        .offsets(null);

      return this.delegate.body(this).mapOk((body) => ({ args, params, body }));
    });
  }
}

export interface PreparedArgs<Body> {
  args: pass1.NamedArguments;
  params: pass1.ElementParameters;
  body: Body;
}

export function hasDynamicFeatures({
  attributes,
  modifiers,
}: Pick<ASTv2.ElementNode, 'attributes' | 'modifiers'>): boolean {
  // ElementModifier needs the special ComponentOperations
  if (modifiers.length > 0) {
    return true;
  }

  // Splattributes need the special ComponentOperations to merge into
  return !!attributes.find((attr) => attr.name === '...attributes');
}
