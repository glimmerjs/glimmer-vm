import { ASTv2 } from '@glimmer/syntax';
import { Result } from '../../../../shared/result';
import * as hir from '../../../2-symbol-allocation/hir';
import { NormalizationUtilities } from '../../context';
import { VISIT_EXPRS } from '../expressions';
import { VISIT_STMTS } from '../statements';
import { Classified, ClassifiedElement, PreparedArgs } from './classified';

export class ClassifiedComponent implements Classified {
  readonly dynamicFeatures = true;

  constructor(private tag: hir.Expr, private element: ASTv2.InvokeComponent) {}

  arg(attr: ASTv2.ComponentArg, el: ClassifiedElement): Result<hir.NamedEntry> {
    let name = attr.name;

    return VISIT_EXPRS.visit(attr.value, el.utils).mapOk((value) =>
      el.utils
        .op(hir.NamedEntry, {
          key: name,
          value,
        })
        .loc(attr)
    );
  }

  toStatement(component: ClassifiedElement, { args, params }: PreparedArgs): Result<hir.Statement> {
    let { element, utils } = component;

    return this.blocks(utils).mapOk((blocks) =>
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

  private blocks(utils: NormalizationUtilities): Result<hir.NamedBlocks> {
    return VISIT_STMTS.NamedBlocks(this.element.blocks, utils);
  }
}
