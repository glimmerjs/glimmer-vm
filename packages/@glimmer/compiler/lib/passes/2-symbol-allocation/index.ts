import * as mir from '../pass2/mir';
import { Source } from '../../source/source';
import { CompilerContext } from './context';
import { EXPRESSIONS } from './expressions';
import { INTERNAL } from './internal';
import * as pass1 from './hir';
import { STATEMENTS } from './statements';

export function visit(source: Source, root: pass1.Template): mir.Template {
  let symbols = root.args.symbols;

  let compilerContext = new CompilerContext(source, symbols, {
    expressions: EXPRESSIONS,
    statements: STATEMENTS,
    internal: INTERNAL,
  });

  let ctx = compilerContext.forOffsets(root.offsets);
  let statements = ctx.map(root.args.body, (stmt) => ctx.visitStmt(stmt));

  return ctx.template({ symbols, statements }).offsets(root.offsets);
}
