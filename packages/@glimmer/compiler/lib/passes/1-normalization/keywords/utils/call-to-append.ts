import type { Result } from '../../../../shared/result';
import type { NormalizationState } from '../../context';
import type { GenericKeywordNode, KeywordDelegate } from '../impl';

import * as mir from '../../../2-encoding/mir';

export function toAppend<T>({
  assert,
  translate,
}: KeywordDelegate<GenericKeywordNode, T, mir.ExpressionNode>): KeywordDelegate<
  GenericKeywordNode,
  T,
  mir.AppendValueCautiously
> {
  return {
    assert,
    translate(
      { node, state }: { node: GenericKeywordNode; state: NormalizationState },
      value: T
    ): Result<mir.AppendValueCautiously> {
      let result = translate({ node, state }, value);

      return result.mapOk((value) => new mir.AppendValueCautiously({ value, loc: node.loc }));
    },
  };
}
