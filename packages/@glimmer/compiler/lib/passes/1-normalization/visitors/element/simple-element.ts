import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { unreachable } from '@glimmer/util';
import { Err, Ok, Result } from '../../../../shared/result';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../../2-symbol-allocation/hir';
import { VISIT_STMTS } from '../statements';
import { Classified, ClassifiedElement, PreparedArgs } from './classified';

type Body = pass1.Statement[];

export class ClassifiedSimpleElement implements Classified<Body> {
  constructor(
    private tag: pass1.SourceSlice,
    private element: ASTv2.SimpleElement,
    readonly dynamicFeatures: boolean
  ) {}

  readonly isComponent = false;

  arg(attr: ASTv2.AttrNode): Result<pass1.NamedArgument> {
    return Err(
      new GlimmerSyntaxError(
        `${
          attr.name
        } is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (\`${this.tag.getString()}\`) is a regular, non-component HTML element.`,
        attr.loc
      )
    );
  }

  toStatement(
    classified: ClassifiedElement<Body>,
    { params, body }: PreparedArgs<Body>
  ): pass1.Statement {
    let {
      ctx: { utils },
      element,
    } = classified;

    return utils
      .op(pass1.SimpleElement, {
        tag: this.tag,
        params,
        body,
        dynamicFeatures: this.dynamicFeatures,
      })
      .loc(element);
  }

  body({ ctx }: ClassifiedElement<Body>): Result<Body> {
    return VISIT_STMTS.visitList(this.element.children, ctx);
  }

  selfClosing(): Result<Body> {
    return Ok([]);
  }

  namedBlock(): Result<Body> {
    throw unreachable();
  }

  namedBlocks(_: unknown, { element }: ClassifiedElement<Body>): Result<Body> {
    return Err(
      new GlimmerSyntaxError(
        `only a component can have named blocks, and this is a ${this.tag}`,
        element.loc
      )
    );
  }
}
