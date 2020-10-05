import { LOCAL_LOGGER, LOGGER } from '@glimmer/util';
import { packed } from '@glimmer/wire-format';

import * as mir from '../2-encoding/mir';
import { CONTENT } from './content';

export function visit(input: mir.Template): packed.Template {
  let content = CONTENT.list(input.body);
  let scope = input.scope;

  let output = {
    symbols: scope.symbols,
    content,
    hasEval: scope.hasEval,
    upvars: scope.upvars,
  };

  if (LOCAL_LOGGER) {
    let debug = packed.debugPacked(output);
    LOGGER.log(`-> `, debug);
  }

  return {
    symbols: scope.symbols,
    content,
    hasEval: scope.hasEval,
    upvars: scope.upvars,
  };
}
