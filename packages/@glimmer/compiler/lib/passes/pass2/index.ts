import { Template } from './blocks';
import { Context } from './context';
import * as pass2 from './ops';

export function visit(
  source: string,
  template: pass2.Template,
  options?: CompileOptions
): Template {
  let ctx = Context.for({ source, template, options });

  for (let op of template.args.ops) {
    console.log(`pass2: visiting`, op);
    let ops = ctx.visit(op);
    ctx.currentBlock.push(...ops);

    if (ops.length) {
      console.log(`-> ops   `, [...ops]);
    }
    console.log(`-> blocks`, [...ctx.blocks.toArray()]);
    console.log(`-> stack `, [...ctx.debugStack]);
  }

  return ctx.template;
}
