import { AST } from '@glimmer/syntax';
import * as pass1 from '../pass1/ops';
import { ProgramSymbolTable } from '../shared/symbol-table';
import { Context, GlimmerCompileOptions } from './context';
import { Result } from './visitors/element';
import { EXPRESSIONS } from './visitors/expressions';
import { STATEMENTS } from './visitors/statements';

export function visit(
  source: string,
  root: AST.Template,
  options: GlimmerCompileOptions
): Result<pass1.Template> {
  let ctx = new Context(source, options, {
    expressions: EXPRESSIONS,
    statements: STATEMENTS,
  });

  let symbols = ctx.symbols.current as ProgramSymbolTable;

  console.groupCollapsed(`pass0: visiting`);
  console.log('symbols', symbols);
  console.log('source', source);
  console.groupEnd();

  // TODO this is using the same infrastructure as ElementNode for implementation convenience, but it's unnecessarily involved and should be simplied
  let body = ctx.withBlock(root, () => {
    return ctx.visitStmts(root.body);
  });

  console.log('-> pass0: out', body);

  return body.mapOk((body) => ctx.template({ symbols, body }).loc(root.loc));
}
