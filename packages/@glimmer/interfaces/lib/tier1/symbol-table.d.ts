export interface ProgramSymbolTable {
  readonly hasDebug: boolean;
  readonly symbols: string[];
}

export interface BlockSymbolTable {
  parameters: number[];
}

export type SymbolTable = ProgramSymbolTable | BlockSymbolTable;
