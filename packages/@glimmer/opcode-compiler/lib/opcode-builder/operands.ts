import type {
  BlockOperand,
  BlockOperandType,
  CompilableTemplate,
  DebugSymbolsOperand,
  DebugSymbolsOperandType,
  IsStrictModeOperand,
  IsStrictModeOperandType,
  LabelOperand,
  LabelOperandType,
  LayoutOperand,
  LayoutOperandType,
  NonSmallIntOperand,
  NonSmallIntOperandType,
  STDLibraryOpcode,
  SerializedBlock,
  SerializedInlineBlock,
  StdLibraryOperand,
  StdLibraryOperandType,
  SymbolTable,
  SymbolTableOperand,
  SymbolTableOperandType,
} from '@glimmer/interfaces';
import { assert, isSmallInt } from '@glimmer/util';

export const LABEL_OPERAND: LabelOperandType = 1;
export const IS_STRICT_MODE_OPERAND: IsStrictModeOperandType = 2;
export const DEBUG_SYMBOLS_OPERAND: DebugSymbolsOperandType = 3;
export const BLOCK_OPERAND: BlockOperandType = 4;
export const STD_LIB_OPERAND: StdLibraryOperandType = 5;
export const NON_SMALL_INT_OPERAND: NonSmallIntOperandType = 6;
export const SYMBOL_TABLE_OPERAND: SymbolTableOperandType = 7;
export const LAYOUT_OPERAND: LayoutOperandType = 8;

export function labelOperand(value: string): LabelOperand {
  return { type: LABEL_OPERAND, value };
}

export function debugSymbolsOperand(): DebugSymbolsOperand {
  return { type: DEBUG_SYMBOLS_OPERAND, value: undefined };
}

export function isStrictMode(): IsStrictModeOperand {
  return { type: IS_STRICT_MODE_OPERAND, value: undefined };
}

export function blockOperand(value: SerializedInlineBlock | SerializedBlock): BlockOperand {
  return { type: BLOCK_OPERAND, value };
}

export function stdlibOperand(value: STDLibraryOpcode): StdLibraryOperand {
  return { type: STD_LIB_OPERAND, value };
}

export function nonSmallIntOperand(value: number): NonSmallIntOperand {
  assert(
    !isSmallInt(value),
    'Attempted to make a operand for an int that was not a small int, you should encode this as an immediate'
  );
  return { type: NON_SMALL_INT_OPERAND, value };
}

export function symbolTableOperand(value: SymbolTable): SymbolTableOperand {
  return { type: SYMBOL_TABLE_OPERAND, value };
}

export function layoutOperand(value: CompilableTemplate): LayoutOperand {
  return { type: LAYOUT_OPERAND, value };
}
