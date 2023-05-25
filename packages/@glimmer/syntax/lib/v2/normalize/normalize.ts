import {
  preprocess,
  type PrecompileOptionsWithLexicalScope,
} from '../../parser/tokenizer-event-handlers';
import type { Source } from '../../source/source';
import type * as ASTv2 from '../api';
import { SymbolTable } from '../../symbol-table';
import { BlockContext, TemplateChildren } from './children';
import { StatementNormalizer } from './v1-to-v2';

export function normalize(
  source: Source,
  options?: PrecompileOptionsWithLexicalScope
): [ast: ASTv2.Template, locals: string[]] {
  let ast = preprocess(source, options);

  let normalizeOptions = {
    strictMode: false,
    locals: [],
    ...options,
  };

  let top = SymbolTable.top(
    normalizeOptions.locals,

    {
      customizeComponentName: options?.customizeComponentName ?? ((name) => name),
      lexicalScope: options?.lexicalScope ?? (() => false),
    }
  );
  let block = new BlockContext(source, normalizeOptions, top);
  let normalizer = new StatementNormalizer(block);

  let astV2 = new TemplateChildren(
    block.span(ast.loc),
    ast.body.map((b) => normalizer.normalize(b)),
    block
  ).assertTemplate(top);

  let locals = top.getUsedTemplateLocals();

  return [astV2, locals];
}
