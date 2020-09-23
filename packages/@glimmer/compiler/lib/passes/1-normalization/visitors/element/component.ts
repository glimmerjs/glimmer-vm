import { ASTv2 } from '@glimmer/syntax';
import { Result } from '../../../../shared/result';
import * as hir from '../../../2-symbol-allocation/hir';
import { NormalizationState } from '../../context';
import { VISIT_EXPRS } from '../expressions';
import { VISIT_STMTS } from '../statements';
import { Classified, ClassifiedElement, PreparedArgs } from './classified';

export class ClassifiedComponent implements Classified {
  readonly dynamicFeatures = true;

  constructor(private tag: hir.Expr, private element: ASTv2.InvokeComponent) {}

  arg(attr: ASTv2.ComponentArg): Result<hir.NamedEntry> {
    let name = attr.name;

    return VISIT_EXPRS.visit(attr.value).mapOk(
      (value) =>
        new hir.NamedEntry(attr.loc, {
          key: name,
          value,
        })
    );
  }

  toStatement(component: ClassifiedElement, { args, params }: PreparedArgs): Result<hir.Statement> {
    let { element, state } = component;

    return this.blocks(state).mapOk(
      (blocks) =>
        new hir.Component(element.loc, {
          tag: this.tag,
          params,
          args,
          blocks,
        })
    );
  }

  private blocks(state: NormalizationState): Result<hir.NamedBlocks> {
    return VISIT_STMTS.NamedBlocks(this.element.blocks, state);
  }
}
