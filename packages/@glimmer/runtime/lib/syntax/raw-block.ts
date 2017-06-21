import { BlockSymbolTable, CompilationMeta } from '@glimmer/interfaces';
import { Statement } from '@glimmer/wire-format';
import CompilableTemplate, { CompilationOptions } from './compilable-template';
import { Block, ScannableTemplate } from './interfaces';

export default class RawInlineBlock implements ScannableTemplate<BlockSymbolTable> {
  constructor(
    private statements: Statement[],
    private parameters: number[],
    private meta: CompilationMeta,
    private options: CompilationOptions
  ) {
  }

  scan(): Block {
    return new CompilableTemplate(this.statements, { parameters: this.parameters, meta: this.meta }, this.options);
  }
}
