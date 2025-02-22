import type { ASTv2 } from '@glimmer/syntax';

import type { Result } from '../../../../shared/result';
import type { NormalizationState } from '../../context';
import type { Classified, ClassifiedElement, PreparedArgs } from './classified';

import * as mir from '../../../2-encoding/mir';
import { convertPathToCallIfKeyword, visitExpr } from '../expressions';
import { visitNamedBlocks } from '../statements';

export class ClassifiedComponent implements Classified {
  readonly dynamicFeatures = true;

  constructor(
    private tag: mir.BlockCallee | ASTv2.ResolvedName,
    private element: ASTv2.InvokeAngleBracketComponent | ASTv2.InvokeResolvedAngleBracketComponent
  ) {}

  arg(attr: ASTv2.ComponentArg, { state }: ClassifiedElement): Result<mir.NamedArgument> {
    let name = attr.name;

    return visitExpr(convertPathToCallIfKeyword(attr.value), state).mapOk(
      (value) =>
        new mir.NamedArgument({
          loc: attr.loc,
          key: name,
          value,
        })
    );
  }

  toStatement(component: ClassifiedElement, { args, params }: PreparedArgs): Result<mir.Content> {
    let { element, state } = component;

    return this.blocks(state).mapOk((blocks) => {
      if (this.tag.type === 'ResolvedName') {
        return new mir.ResolvedAngleBracketComponent({
          loc: element.loc,
          tag: this.tag,
          params,
          args,
          blocks,
        });
      } else {
        return new mir.AngleBracketComponent({
          loc: element.loc,
          tag: this.tag,
          params,
          args,
          blocks,
        });
      }
    });
  }

  private blocks(state: NormalizationState): Result<mir.NamedBlocks> {
    return visitNamedBlocks(this.element.blocks, state);
  }
}
