import type { ASTv2, SourceSlice } from '@glimmer/syntax';
import { generateSyntaxError } from '@glimmer/syntax';

import type { Result } from '../../../../shared/result';
import type { Classified, ClassifiedElement, PreparedArgs } from './classified';

import { Err } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import { visitContentList } from '../statements';

export class ClassifiedSimpleElement implements Classified {
  constructor(
    private tag: SourceSlice,
    private element: ASTv2.SimpleElementNode,
    readonly dynamicFeatures: boolean
  ) {}

  readonly isComponent = false;

  arg(attr: ASTv2.ComponentArg): Result<mir.ComponentArgument> {
    return Err(
      generateSyntaxError(
        `${attr.name.chars} is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (\`${this.tag.chars}\`) is a regular, non-component HTML element.`,
        attr.loc
      )
    );
  }

  toStatement(classified: ClassifiedElement, { params }: PreparedArgs): Result<mir.Content> {
    const { state, element } = classified;

    let body = visitContentList(this.element.body, state);

    return body.mapOk(
      (body) =>
        new mir.SimpleElement({
          loc: element.loc,
          tag: this.tag,
          params,
          body: body.toArray(),
          dynamicFeatures: this.dynamicFeatures,
        })
    );
  }
}
