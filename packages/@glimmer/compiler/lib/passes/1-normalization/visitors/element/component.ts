import { ASTv2 } from '@glimmer/syntax';
import { OptionalList } from '../../../../shared/list';
import { MapIntoResultArray, Ok, Result } from '../../../../shared/result';
import * as hir from '../../../2-symbol-allocation/hir';
import { VisitorContext } from '../../context';
import { VISIT_EXPRS } from '../expressions';
import { VISIT_STMTS } from '../statements';
import { Classified, ClassifiedElement, PreparedArgs } from './classified';

export class ClassifiedComponent implements Classified {
  readonly dynamicFeatures = true;

  constructor(private tag: hir.Expr, private element: ASTv2.InvokeComponent) {}

  arg(attr: ASTv2.AttrNode, el: ClassifiedElement): Result<hir.NamedArgument> {
    let name = attr.name;

    let value = VISIT_EXPRS.visit(attr.value, el.ctx);

    return Ok(
      el.ctx.utils
        .op(hir.NamedArgument, {
          key: name,
          value,
        })
        .loc(attr)
    );
  }

  toStatement(component: ClassifiedElement, { args, params }: PreparedArgs): Result<hir.Statement> {
    let { element, ctx } = component;
    let { utils } = ctx;

    return this.blocks(ctx).mapOk((blocks) =>
      utils
        .op(hir.Component, {
          tag: this.tag,
          params,
          args,
          blocks,
        })
        .loc(element)
    );
  }

  private blocks(ctx: VisitorContext): Result<hir.NamedBlocks> {
    let { utils } = ctx;

    let blocks = Array.isArray(this.element.blocks) ? this.element.blocks : [this.element.blocks];

    return new MapIntoResultArray(blocks)
      .map((block) => VISIT_STMTS.NamedBlock(block, ctx))
      .mapOk((blocks) => utils.op(hir.NamedBlocks, { blocks: OptionalList(blocks) }).offsets(null));
  }
}
