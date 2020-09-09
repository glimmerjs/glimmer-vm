import { AST, GlimmerSyntaxError } from '@glimmer/syntax';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../../pass1/ops';
import { Err, Ok, Result } from '../../../../shared/result';
import { ClassifiedElement, Classified, PreparedArgs } from './classified';

type Body = pass1.NamedBlock;

export class ClassifiedSimpleElement implements Classified<Body> {
  constructor(private tag: pass1.SourceSlice, readonly dynamicFeatures: boolean) {}

  readonly isComponent = false;

  arg(attr: AST.AttrNode, { element }: ClassifiedElement<Body>): Result<pass1.NamedArgument> {
    return Err(
      new GlimmerSyntaxError(
        `${attr.name} is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (\`${element.tag}\`) is a regular, non-component HTML element.`,
        attr.loc
      )
    );
  }

  toStatement(
    classified: ClassifiedElement<Body>,
    { params, body }: PreparedArgs<Body>
  ): pass1.Statement {
    let { ctx, element } = classified;

    return ctx
      .op(pass1.SimpleElement, {
        tag: this.tag,
        params,
        body,
        dynamicFeatures: this.dynamicFeatures,
      })
      .loc(element);
  }

  selfClosing(block: pass1.NamedBlock): Result<Body> {
    return Ok(block);
  }

  namedBlock(block: pass1.NamedBlock): Result<Body> {
    return Ok(block);
  }

  namedBlocks(_: unknown, { element }: ClassifiedElement<Body>): Result<Body> {
    return Err(
      new GlimmerSyntaxError(
        `only a component can have named blocks, and this is a ${element.tag}`,
        element.loc
      )
    );
  }
}
