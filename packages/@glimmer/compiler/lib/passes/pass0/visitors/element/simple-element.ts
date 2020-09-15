import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../../pass1/hir';
import { Err, Ok, Result } from '../../../../shared/result';
import { ClassifiedElement, Classified, PreparedArgs } from './classified';
import { TemporaryNamedBlock } from './temporary-block';

type Body = pass1.NamedBlock;

export class ClassifiedSimpleElement implements Classified<Body> {
  constructor(
    private tag: pass1.SourceSlice,
    private element: ASTv2.SimpleElementNode,
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

  body({ ctx: { utils } }: ClassifiedElement<Body>): Result<Body> {
    return utils.visitStmts(this.element.children).andThen((body) =>
      new TemporaryNamedBlock(
        {
          name: utils.slice('default').offsets(null),
          table: this.element.symbols,
          body,
        },
        utils.source.maybeOffsetsFor(this.element)
      ).tryNamedBlock(utils.source)
    );
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
        `only a component can have named blocks, and this is a ${this.tag}`,
        element.loc
      )
    );
  }
}
