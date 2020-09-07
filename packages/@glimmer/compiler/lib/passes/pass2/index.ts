import { WireFormat } from '@glimmer/interfaces';
import * as pass2 from './ops';
import { visitStatements } from './statements';

export function visit(template: pass2.Template): WireFormat.SerializedTemplateBlock {
  let statements = visitStatements(template.args.statements);

  let table = template.args.symbols;

  return {
    symbols: table.symbols,
    statements,
    hasEval: table.hasEval,
    upvars: table.freeVariables,
  };
}
