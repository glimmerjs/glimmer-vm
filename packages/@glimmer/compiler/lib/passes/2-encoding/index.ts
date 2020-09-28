import { WireFormat } from '@glimmer/interfaces';
import { LOCAL_LOGGER, LOGGER } from '@glimmer/util';

import WireFormatDebugger from '../../wire-format-debug';
import { CONTENT } from './content';
import * as mir from './mir';

export function visit(template: mir.Template): WireFormat.SerializedTemplateBlock {
  let statements = CONTENT.list(template.body);
  let scope = template.scope;

  if (LOCAL_LOGGER) {
    let debug = new WireFormatDebugger(scope);
    LOGGER.log(
      `-> `,
      statements.map((s) => debug.formatOpcode(s))
    );
  }

  return {
    symbols: scope.symbols,
    statements,
    hasEval: scope.hasEval,
    upvars: scope.upvars,
  };
}
