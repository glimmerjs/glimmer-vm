import { Source } from '@glimmer/syntax';

import * as mir from '../3-encoding/mir';
import { CompilerContext } from './context';
import { EXPRESSIONS } from './expressions';
import * as hir from './hir';
import { INTERNAL } from './internal';
import { STATEMENTS } from './statements';

export function visit(source: Source, root: hir.Template): mir.Template {
  let symbols = root.args.symbols;

  let compilerContext = new CompilerContext(source, symbols, {
    expressions: EXPRESSIONS,
    statements: STATEMENTS,
    internal: INTERNAL,
  });

  let ctx = compilerContext.forLoc(root.loc);
  let statements = ctx.map(root.args.body, (stmt) => ctx.visitStmt(stmt));

  return ctx.template({ symbols, statements }).loc(root);
}
