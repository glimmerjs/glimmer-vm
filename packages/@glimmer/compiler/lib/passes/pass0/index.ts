import { LOCAL_SHOULD_LOG } from '@glimmer/local-debug-flags';
import { AST } from '@glimmer/syntax';
import { LOCAL_LOGGER } from '@glimmer/util';
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

  if (LOCAL_SHOULD_LOG) {
    LOCAL_LOGGER.groupCollapsed(`pass0: visiting`);
    LOCAL_LOGGER.log('symbols', symbols);
    LOCAL_LOGGER.log('source', source);
    LOCAL_LOGGER.groupEnd();
  }

  // TODO this is using the same infrastructure as ElementNode for implementation convenience, but it's unnecessarily involved and should be simplied
  let body = ctx.withBlock(root, () => {
    return ctx.visitStmts(root.body);
  });

  if (LOCAL_SHOULD_LOG) {
    LOCAL_LOGGER.log('-> pass0: out', body);
  }

  return body.mapOk((body) => ctx.template({ symbols, body }).loc(root.loc));
}
