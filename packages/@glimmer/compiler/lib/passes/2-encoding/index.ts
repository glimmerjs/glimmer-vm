import type { WireFormat } from '@glimmer/interfaces';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '../../../../util/lib/devmode/logging';

import WireFormatDebugger from '../../wire-format-debug';
import { CONTENT } from './content';
import type * as mir from './mir';

export function visit(template: mir.Template): WireFormat.SerializedTemplateBlock {
  let statements = CONTENT.list(template.body);
  let scope = template.scope;
  let block: WireFormat.SerializedTemplateBlock = [
    statements,
    scope.symbols,
    scope.hasDebug,
    scope.upvars,
  ];

  if (LOCAL_TRACE_LOGGING) {
    let debug = new WireFormatDebugger(block);
    LOCAL_LOGGER.debug(
      `-> `,
      statements.map((s) => debug.formatOpcode(s))
    );
  }

  return block;
}
