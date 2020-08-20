import * as pass2 from '../pass2/ops';
import { CompilerContext, Context } from './context';
import { EXPRESSIONS } from './expressions';
import * as pass1 from './ops';
import { STATEMENTS } from './statements';

export function visit(source: string, root: pass1.Template): pass2.Template {
  let symbols = root.args.symbols;

  let compilerContext = new CompilerContext(source, symbols, {
    expressions: EXPRESSIONS,
    statements: STATEMENTS,
  });

  let ctx = compilerContext.forOffsets(root.offsets);
  let statements = ctx.map(root.args.body, stmt => {
    console.log(`pass1: visiting`, stmt);
    return ctx.visitStmt(stmt);
  });

  let ops = ctx.ops(ctx.op(pass2.StartProgram), statements, ctx.op(pass2.EndProgram));
  console.log(`pass1`, symbols);

  return ctx.template({ symbols, ops }).offsets(root.offsets);
}

/**
 * All state in this object must be readonly, and this object is just for
 * convenience.
 *
 * It is possible to implement pieces of the compilation as functions that
 * take the compiler context, but since that's so common, we group those
 * function here. (and in fact, that's how keywords work)
 */
export class CompilerHelper {
  readonly ctx: Context;

  constructor(context: Context) {
    this.ctx = context;
  }

  visitExpr(node: pass1.Expr): pass2.Op[] {
    return this.ctx.visitExpr(node);
  }

  visitStmt<T extends pass1.Statement>(node: T): pass2.Op[] {
    return this.ctx.visitStmt(node);
  }

  args({ params, hash }: { params: pass1.Params; hash: pass1.Hash }): pass2.Op[] {
    return this.ctx.ops(this.visitExpr(hash), this.visitExpr(params));
  }
}
