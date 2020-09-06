import { Context } from './context';
import * as pass2 from './ops';
import * as out from './out';

export function visit(
  source: string,
  template: pass2.Template,
  options?: CompileOptions
): out.Template {
  let ctx = Context.for({ source, template, options });

  let statements: out.Statement[] = [];

  for (let op of template.args.statements) {
    console.log(`pass2: visiting`, op);

    let result = ctx.visit(op);

    statements.push(result);

    console.log(`-> pass2: out`, statements);
  }

  let table = template.args.symbols;

  return ctx.op(out.Template, {
    table,
    statements,
  });
}
