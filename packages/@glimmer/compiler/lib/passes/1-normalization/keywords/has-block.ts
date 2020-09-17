import { GlimmerSyntaxError, SourceSlice, SYNTHETIC } from '@glimmer/syntax';
import { GenericKeywordNode } from './impl';

export function assertValidHasBlockUsage(type: string, node: GenericKeywordNode): SourceSlice {
  let call = node.type === 'AppendContent' ? node.value : node;

  let named = call.type === 'CallExpression' ? call.args.named : null;
  let positionals = call.type === 'CallExpression' ? call.args.positional : null;

  if (named && !named.isEmpty()) {
    throw new GlimmerSyntaxError(`${type} does not take any named arguments`, call.loc);
  }

  if (!positionals || positionals.isEmpty()) {
    return new SourceSlice({ chars: 'default', loc: SYNTHETIC });
  } else if (positionals.exprs.length === 1) {
    let positional = positionals.exprs[0];
    if (positional.isLiteral('string')) {
      return new SourceSlice({ chars: positional.value, loc: positional.loc });
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
