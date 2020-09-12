import { PresentArray } from '@glimmer/interfaces';
import { ASTv2 } from '@glimmer/syntax';
import { assertPresent } from '@glimmer/util';
import { Ok, Result } from '../../../../shared/result';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../../pass1/hir';
import { Classified, ClassifiedElement, PreparedArgs } from './classified';
import { dynamicAttrValue } from './element-node';

type Body = pass1.AnyNamedBlocks;

export class ClassifiedComponent implements Classified<Body> {
  readonly dynamicFeatures = true;

  constructor(private tag: pass1.Expr, private element: ASTv2.ComponentNode) {}

  arg(attr: ASTv2.AttrNode, el: ClassifiedElement<Body>): Result<pass1.NamedArgument> {
    let name = attr.name;
    let nameSlice = el.ctx.utils.slice(name).offsets(null);

    let value = dynamicAttrValue(el.ctx, attr.value);

    return Ok(
      el.ctx.utils
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
    let {
      element,
      ctx: { utils },
    } = component;

    return utils
      .op(pass1.Component, {
        tag: this.tag,
        params,
        args,
        blocks,
      })
      .loc(element);
  }

  body({ ctx: { utils } }: ClassifiedElement<Body>): Result<Body> {
    if (this.element.blocks === null) {
      return Ok(utils.op(pass1.EmptyNamedBlocks).offsets(null));
    } else if (Array.isArray(this.element.blocks)) {
      return utils
        .visitStmts(this.element.blocks, { allowNamedBlock: true })
        .mapOk((blocks) =>
          utils.op(pass1.NamedBlocks, { blocks: assertPresent(blocks) }).offsets(null)
        );
    } else {
      // blocks is a single block
      return utils
        .visitStmt(this.element.blocks, { allowNamedBlock: true })
        .mapOk((block) => utils.op(pass1.NamedBlocks, { blocks: [block] }).offsets(null));
    }
  }

  selfClosing(_: unknown, { element, ctx: { utils } }: ClassifiedElement<Body>): Result<Body> {
    return Ok(utils.op(pass1.EmptyNamedBlocks).loc(element));
  }

  namedBlock(block: pass1.NamedBlock, { ctx: { utils } }: ClassifiedElement<Body>): Result<Body> {
    return Ok(utils.op(pass1.NamedBlocks, { blocks: [block] }).offsets(block));
  }

  namedBlocks(
    blocks: PresentArray<pass1.NamedBlock>,
    { ctx: { utils } }: ClassifiedElement<Body>
  ): Result<Body> {
    return Ok(utils.op(pass1.NamedBlocks, { blocks }).offsets(blocks));
  }
}
