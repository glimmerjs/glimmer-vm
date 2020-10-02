import { WireFormat } from '@glimmer/interfaces';
import { LOCAL_LOGGER, LOGGER } from '@glimmer/util';
import { packed } from '@glimmer/wire-format';

import WireFormatDebugger from '../../wire-format-debug';
import * as mir from '../2-encoding/mir';
import { CONTENT } from './content';

export function visit(template: mir.Template): packed.Template {
  let content = CONTENT.list(template.body);
  let scope = template.scope;

  if (LOCAL_LOGGER) {
    let debug = new WireFormatDebugger(scope);
    LOGGER.log(
      `-> `,
      content.map((s) => debug.formatOpcode(s))
    );
  }

  return {
    symbols: scope.symbols,
    content,
    hasEval: scope.hasEval,
    upvars: scope.upvars,
  };
}
