import { ASTv2, GlimmerSyntaxError } from '@glimmer/syntax';
import { Source } from '../../../source/source';
import * as hir from '../../2-symbol-allocation/hir';
import { GenericKeywordNode } from './impl';

export function assertValidHasBlockUsage(
  type: string,
  node: GenericKeywordNode,
  source: Source
): hir.SourceSlice {
  let call = node.type === 'AppendStatement' ? node.value : node;

  let hash = call.type === 'SubExpression' ? call.hash : null;
  let params = call.type === 'SubExpression' ? call.params : [];

  if (hash && hash.pairs.length > 0) {
    throw new GlimmerSyntaxError(`${type} does not take any named arguments`, call.loc);
  }

  if (params.length === 0) {
    return new hir.SourceSlice(null, { value: 'default' });
  } else if (params.length === 1) {
    let param = params[0];
    if (ASTv2.isLiteral(param, 'string')) {
      return new hir.SourceSlice(source.offsetsFor(param), { value: param.value });
    } else {
      throw new GlimmerSyntaxError(
        `you can only yield to a literal value (on line ${call.loc.start.line})`,
        call.loc
      );
    }
  } else {
    throw new GlimmerSyntaxError(
      `${type} only takes a single positional argument (on line ${call.loc.start.line})`,
      call.loc
    );
  }
}
