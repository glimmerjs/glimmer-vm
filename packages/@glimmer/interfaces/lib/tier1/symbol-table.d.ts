import { Opaque } from '@glimmer/interfaces';
import { TemplateMeta } from '@glimmer/wire-format';
import { Dict, Option } from '../core';

export interface Symbols {
}

export interface SymbolTable {
  referer: Opaque;
}

export interface ProgramSymbolTable extends SymbolTable {
  hasEval: boolean;
  symbols: string[];
}

export interface BlockSymbolTable extends SymbolTable {
  parameters: number[];
}

export default SymbolTable;
