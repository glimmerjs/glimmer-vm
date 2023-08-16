export interface ProgramSymbolTable {
  hasDebug: boolean;
  symbols: string[];
}

export interface BlockSymbolTable {
  parameters: number[];
}

export type SymbolTable = ProgramSymbolTable | BlockSymbolTable;
