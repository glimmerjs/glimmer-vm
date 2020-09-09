import { PresentArray } from '@glimmer/interfaces';
import { AST, GlimmerSyntaxError } from '@glimmer/syntax';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../../pass1/ops';
import { Err, Ok, Result } from '../../../../shared/result';
import { Classified, ClassifiedElement, PreparedArgs } from './classified';
import { dynamicAttrValue } from './element-node';
import { TemporaryNamedBlock } from './temporary-block';

type Body = pass1.AnyNamedBlocks;

export class ClassifiedComponent implements Classified<Body> {
  readonly dynamicFeatures = true;

  constructor(private tag: pass1.Expr) {}

  arg(attr: AST.AttrNode, { ctx }: ClassifiedElement<Body>): Result<pass1.NamedArgument> {
    let name = attr.name;
    let nameSlice = ctx.slice(name).offsets(null);

    let value = dynamicAttrValue(ctx, attr.value);

    return Ok(
      ctx
        .op(pass1.NamedArgument, {
          key: nameSlice,
          value,
        })
        .loc(attr)
    );
  }

  toStatement(
    component: ClassifiedElement<Body>,
    { args, params, body: blocks }: PreparedArgs<Body>
  ): pass1.Statement {
    let { element, ctx } = component;

    return ctx
      .op(pass1.Component, {
        tag: this.tag,
        params,
        args,
        blocks,
      })
      .loc(element);
  }

  selfClosing(_: unknown, { element, ctx }: ClassifiedElement<Body>): Result<Body> {
    return Ok(ctx.op(pass1.EmptyNamedBlocks).loc(element));
  }

  namedBlock(block: pass1.NamedBlock, { ctx }: ClassifiedElement<Body>): Result<Body> {
    return Ok(ctx.op(pass1.NamedBlocks, { blocks: [block] }).offsets(block));
  }

  namedBlocks(
    blocks: PresentArray<pass1.NamedBlock>,
    { ctx }: ClassifiedElement<Body>
  ): Result<Body> {
    return Ok(ctx.op(pass1.NamedBlocks, { blocks }).offsets(blocks));
  }

  body(block: TemporaryNamedBlock, classified: ClassifiedElement<Body>): Result<Body> {
    if (classified.element.selfClosing) {
      return Ok(classified.ctx.op(pass1.EmptyNamedBlocks).loc(classified.element));
    }

    if (block.isValidNamedBlock()) {
      return Ok(
        classified.ctx.op(pass1.NamedBlocks, { blocks: [block.asNamedBlock()] }).offsets(block)
      );
    } else if (block.hasValidNamedBlocks()) {
      let children = block.asNamedBlocks(classified.ctx.source);

      return children.mapOk((blocks) =>
        classified.ctx.op(pass1.NamedBlocks, { blocks }).offsets(blocks)
      );
    } else {
      // there were semantic children and named blocks
      return Err(
        new GlimmerSyntaxError(
          `a component cannot have semantic content and named blocks`,
          classified.element.loc
        )
      );
    }
  }
}
