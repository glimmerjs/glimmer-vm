import {
  BlockSymbolTable,
  ProgramSymbolTable,
  SymbolTable,
} from '@glimmer/interfaces';
import {
  CompiledDynamicTemplate,
  CompiledStaticTemplate,
} from '../compiled/blocks';

export interface CompilableTemplate<S extends SymbolTable = SymbolTable> {
  symbolTable: S;
  compileStatic(): CompiledStaticTemplate;
  compileDynamic(): CompiledDynamicTemplate<S>;
}

export type Block = CompilableTemplate<BlockSymbolTable>;
export type TopLevelBlock = CompilableTemplate<ProgramSymbolTable>;

export interface ScannableTemplate<S extends SymbolTable> {
  scan(): CompilableTemplate<S>;
}
