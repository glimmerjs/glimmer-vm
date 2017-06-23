import {
  Option,
  SymbolTable,
  Resolver
} from '@glimmer/interfaces';
import { Statement } from '@glimmer/wire-format';
import { CompiledDynamicTemplate, CompiledStaticTemplate } from '../compiled/blocks';
import { Program } from '../environment';
import { debugSlice } from '../opcodes';
import { compileStatements } from './functions';
import { DEBUG } from '@glimmer/local-debug-flags';
import { CompilableTemplate as ICompilableTemplate } from './interfaces';
import { Macros } from '../syntax/macros';

export interface CompilationOptions {
  resolver: Resolver;
  program: Program;
  macros: Macros;
}

export interface InputCompilationOptions {
  resolver: Resolver<any>;
  program: Program;
  macros: Macros;
}

export default class CompilableTemplate<S extends SymbolTable> implements ICompilableTemplate<S> {
  private compiledStatic: Option<CompiledStaticTemplate> = null;
  private compiledDynamic: Option<CompiledDynamicTemplate<S>> = null;

  constructor(public statements: Statement[], public symbolTable: S, private options: CompilationOptions) {}

  compileStatic(): CompiledStaticTemplate {
    let { compiledStatic, options } = this;

    if (!compiledStatic) {
      let builder = compileStatements(this.statements, this.symbolTable.meta, options);
      let handle = builder.finalize();
      if (DEBUG) {
        let { program, program: { heap } } = options;
        let start = heap.getaddr(handle);
        let end = start + heap.sizeof(handle);
        debugSlice(program, start, end);
      }
      compiledStatic = this.compiledStatic = new CompiledStaticTemplate(handle);
    }

    return compiledStatic;
  }

  compileDynamic(): CompiledDynamicTemplate<S> {
    let { compiledDynamic } = this;
    if (!compiledDynamic) {
      let staticBlock = this.compileStatic();
      compiledDynamic = new CompiledDynamicTemplate(staticBlock.handle, this.symbolTable);
    }

    return compiledDynamic;
  }
}
