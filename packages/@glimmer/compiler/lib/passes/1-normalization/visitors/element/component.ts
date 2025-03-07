import type { ASTv2 } from '@glimmer/syntax';

import type { Result } from '../../../../shared/result';
import type { NormalizationState } from '../../context';
import type { Classified, ClassifiedElement, PreparedArgs } from './classified';

import * as mir from '../../../2-encoding/mir';
import { visitAttrValue } from '../expressions';
import { visitNamedBlocks } from '../statements';

export class ClassifiedComponent implements Classified {
  readonly dynamicFeatures = true;

  constructor(
    private tag: mir.BlockCallee | ASTv2.ResolvedName,
    private element: ASTv2.InvokeAngleBracketComponent | ASTv2.InvokeResolvedAngleBracketComponent
  ) {}

  arg(attr: ASTv2.ComponentArg, { state }: ClassifiedElement): Result<mir.ComponentArgument> {
    let name = attr.name;

    return visitAttrValue(attr.value, state).mapOk(
      (value) =>
        new mir.ComponentArgument({
          loc: attr.loc,
          name: name,
          value,
        })
    );
  }

  toStatement(
    component: ClassifiedElement,
    { args, params }: PreparedArgs
  ): Result<mir.ResolvedAngleBracketComponent | mir.AngleBracketComponent> {
    const { element, state } = component;
    const { error } = this.element;

    return this.blocks(state).mapOk((blocks) => {
      if (this.tag.type === 'ResolvedName') {
        return new mir.ResolvedAngleBracketComponent({
          loc: element.loc,
          tag: this.tag,
          params,
          args,
          blocks,
          error,
        });
      } else {
        return new mir.AngleBracketComponent({
          loc: element.loc,
          tag: this.tag,
          params,
          args,
          blocks,
          error,
        });
      }
    });
  }

  private blocks(state: NormalizationState): Result<mir.NamedBlocks> {
    return visitNamedBlocks(this.element.blocks, state);
  }
}
