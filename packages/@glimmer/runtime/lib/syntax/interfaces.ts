import { CompilationOptions } from './compilable-template';
import {
  BlockSymbolTable,
  ProgramSymbolTable,
  SymbolTable,
} from '@glimmer/interfaces';
import {
  CompiledDynamicTemplate,
  CompiledStaticTemplate,
} from '../compiled/blocks';

export interface CompilableTemplate<S extends SymbolTable> {
  symbolTable: S;
  compileStatic(env: CompilationOptions): CompiledStaticTemplate;
  compileDynamic(env: CompilationOptions): CompiledDynamicTemplate<S>;
}

export type Block = CompilableTemplate<BlockSymbolTable>;
export type TopLevelBlock = CompilableTemplate<ProgramSymbolTable>;

export interface ScannableTemplate<S extends SymbolTable> {
  scan(): CompilableTemplate<S>;
}
