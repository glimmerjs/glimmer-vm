import type { NormalizationState } from '../../context';
import type { AppendKeywordCandidate, KeywordDelegate } from '../impl';

import * as mir from '../../../2-encoding/mir';

export function toAppend<T>({
  assert,
  translate,
}: KeywordDelegate<AppendKeywordCandidate, T, mir.ExpressionValueNode>): KeywordDelegate<
  AppendKeywordCandidate,
  T,
  mir.AppendValueCautiously | mir.AppendStaticContent
> {
  return {
    assert,
    translate(
      { node, state }: { node: AppendKeywordCandidate; state: NormalizationState },
      value: T
    ) {
      let result = translate({ node, state }, value);

      return result.mapOk((value) => {
        if (value.type === 'Literal') {
          return new mir.AppendStaticContent({ value, loc: node.loc });
        } else {
          return new mir.AppendValueCautiously({ value, loc: node.loc });
        }
      });
    },
  };
}
