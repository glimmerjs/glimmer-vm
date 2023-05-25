import { type ASTv2, generateSyntaxError, type SourceSlice } from '@glimmer/syntax';

import { Err as Error_, type Result } from '../../../../shared/result';
import * as mir from '../../../2-encoding/mir';
import { VISIT_STMTS } from '../statements';
import type { Classified, ClassifiedElement, PreparedArgs } from './classified';

export class ClassifiedSimpleElement implements Classified {
  constructor(
    private tag: SourceSlice,
    private element: ASTv2.SimpleElement,
    readonly dynamicFeatures: boolean
  ) {}

  readonly isComponent = false;

  arg(attribute: ASTv2.ComponentArg): Result<mir.NamedArgument> {
    return Error_(
      generateSyntaxError(
        `${attribute.name.chars} is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (\`${this.tag.chars}\`) is a regular, non-component HTML element.`,
        attribute.loc
      )
    );
  }

  toStatement(classified: ClassifiedElement, { params }: PreparedArgs): Result<mir.Statement> {
    let { state, element } = classified;

    let body = VISIT_STMTS.visitList(this.element.body, state);

    return body.mapOk(
      (body) =>
        mir.SimpleElement.of({
          loc: element.loc,
          tag: this.tag,
          params,
          body: body.toArray(),
          dynamicFeatures: this.dynamicFeatures,
        })
    );
  }
}
