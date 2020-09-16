import { PresentArray } from '@glimmer/interfaces';
import { ASTv2 } from '@glimmer/syntax';
import { OptionalList } from '../../../../shared/list';
import { MapIntoResultArray, Ok, Result } from '../../../../shared/result';
// import { Option } from '@glimmer/interfaces';
import * as pass1 from '../../../2-symbol-allocation/hir';
import { VISIT_EXPRS } from '../expressions';
import { VISIT_STMTS } from '../statements';
import { Classified, ClassifiedElement, PreparedArgs } from './classified';

type Body = pass1.NamedBlocks;

export class ClassifiedComponent implements Classified<Body> {
  readonly dynamicFeatures = true;

  constructor(private tag: pass1.Expr, private element: ASTv2.Component) {}

  arg(attr: ASTv2.AttrNode, el: ClassifiedElement<Body>): Result<pass1.NamedArgument> {
    let name = attr.name;
    let nameSlice = el.ctx.utils.slice(name).offsets(null);

    let value = VISIT_EXPRS.visit(attr.value, el.ctx);

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

  body({ ctx }: ClassifiedElement<Body>): Result<Body> {
    let { utils } = ctx;
    if (this.element.blocks === null) {
      return Ok(utils.op(pass1.NamedBlocks, { blocks: OptionalList([]) }).offsets(null));
    } else if (Array.isArray(this.element.blocks)) {
      return new MapIntoResultArray(this.element.blocks)
        .map((block) => VISIT_STMTS.NamedBlock(block, ctx))
        .mapOk((blocks) =>
          utils.op(pass1.NamedBlocks, { blocks: OptionalList(blocks) }).offsets(null)
        );
    } else {
      // blocks is a single block
      return VISIT_STMTS.NamedBlock(this.element.blocks, ctx).mapOk((block) =>
        utils.op(pass1.NamedBlocks, { blocks: OptionalList([block]) }).offsets(null)
      );
    }
  }

  selfClosing(_: unknown, { element, ctx: { utils } }: ClassifiedElement<Body>): Result<Body> {
    return Ok(utils.op(pass1.NamedBlocks, { blocks: OptionalList([]) }).loc(element));
  }

  namedBlock(block: pass1.NamedBlock, { ctx: { utils } }: ClassifiedElement<Body>): Result<Body> {
    return Ok(utils.op(pass1.NamedBlocks, { blocks: OptionalList([block]) }).offsets(block));
  }

  namedBlocks(
    blocks: PresentArray<pass1.NamedBlock>,
    { ctx: { utils } }: ClassifiedElement<Body>
  ): Result<Body> {
    return Ok(utils.op(pass1.NamedBlocks, { blocks: OptionalList(blocks) }).offsets(blocks));
  }
}
