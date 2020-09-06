import * as pass2 from '../pass2/ops';
import { CompilerContext } from './context';
import { EXPRESSIONS } from './expressions';
import { INTERNAL } from './internal';
import * as pass1 from './ops';
import { STATEMENTS } from './statements';

export function visit(source: string, root: pass1.Template): pass2.Template {
  let symbols = root.args.symbols;

  let compilerContext = new CompilerContext(source, symbols, {
    expressions: EXPRESSIONS,
    statements: STATEMENTS,
    internal: INTERNAL,
  });

  let ctx = compilerContext.forOffsets(root.offsets);
  let statements = ctx.map(root.args.body, (stmt) => {
    console.log(`pass1: visiting`, stmt);
    let result = ctx.visitStmt(stmt);
    console.log(`-> pass1: out`, result);

    return result;
  });

  console.log(`pass1`, symbols);

  return ctx.template({ symbols, statements }).offsets(root.offsets);
}
