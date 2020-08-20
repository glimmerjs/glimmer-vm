import { AST } from '@glimmer/syntax';
import * as pass1 from '../pass1/ops';
import { ProgramSymbolTable } from '../shared/symbol-table';
import { Context } from './context';
import { EXPRESSIONS } from './visitors/expressions';
import { STATEMENTS } from './visitors/statements';

export function visit(source: string, root: AST.Template, options: CompileOptions): pass1.Template {
  let ctx = new Context(source, options, {
    expressions: EXPRESSIONS,
    statements: STATEMENTS,
  });

  let symbols = ctx.symbols.current as ProgramSymbolTable;
  let body = ctx.mapIntoStatements(root.body, stmt => ctx.visitStmt(stmt));

  console.groupCollapsed(`pass0: visiting`);
  console.log('symbols', symbols);
  console.log('source', source);
  console.groupEnd();

  return ctx.template({ symbols, body }).loc(root.loc);
}
