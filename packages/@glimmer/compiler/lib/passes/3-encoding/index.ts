import { WireFormat } from '@glimmer/interfaces';

import * as mir from './mir';
import { visitStatements } from './statements';

export function visit(template: mir.Template): WireFormat.SerializedTemplateBlock {
  let statements = visitStatements(template.args.statements);

  let table = template.args.symbols;

  return {
    symbols: table.symbols,
    statements,
    hasEval: table.hasEval,
    upvars: table.freeVariables,
  };
}
