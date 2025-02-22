import type { AppendKeywordMatch, KeywordDelegate, KeywordInfo } from '../impl';

import * as mir from '../../../2-encoding/mir';

export function toAppend<T>({
  assert,
  translate,
}: KeywordDelegate<AppendKeywordMatch, T, mir.ExpressionValueNode>): KeywordDelegate<
  AppendKeywordMatch,
  T,
  mir.AppendValueCautiously | mir.AppendStaticContent
> {
  return {
    assert,
    translate(info: KeywordInfo<AppendKeywordMatch>, value: T) {
      let result = translate(info, value);

      return result.mapOk((value) => {
        if (value.type === 'Literal') {
          return new mir.AppendStaticContent({ value, loc: info.loc });
        } else {
          return new mir.AppendValueCautiously({ value, loc: info.loc });
        }
      });
    },
  };
}
