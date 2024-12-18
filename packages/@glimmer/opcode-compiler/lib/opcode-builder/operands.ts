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
  SerializedBlock,
  SerializedInlineBlock,
  StdLibOperand,
  StdLibOperandType,
  SymbolTable,
  SymbolTableOperand,
  SymbolTableOperandType,
} from '@glimmer/interfaces';
import { isSmallInt } from '@glimmer/constants';
import { assert } from '@glimmer/debug-util';

export const HighLevelOperands: {
  readonly Label: LabelOperandType;
  readonly IsStrictMode: IsStrictModeOperandType;
  readonly DebugSymbols: DebugSymbolsOperandType;
  readonly Block: BlockOperandType;
  readonly StdLib: StdLibOperandType;
  readonly NonSmallInt: NonSmallIntOperandType;
  readonly SymbolTable: SymbolTableOperandType;
  readonly Layout: LayoutOperandType;
} = {
  Label: 1,
  IsStrictMode: 2,
  DebugSymbols: 3,
  Block: 4,
  StdLib: 5,
  NonSmallInt: 6,
  SymbolTable: 7,
  Layout: 8,
} as const;

export function labelOperand(value: string): LabelOperand {
  return { type: HighLevelOperands.Label, value };
}

export function debugSymbolsOperand(
  locals: Record<string, number>,
  upvars: Record<string, number>,
  lexical: Record<string, number>
): DebugSymbolsOperand {
  return { type: HighLevelOperands.DebugSymbols, value: { locals, upvars, lexical } };
}

export function isStrictMode(): IsStrictModeOperand {
  return { type: HighLevelOperands.IsStrictMode, value: undefined };
}

export function blockOperand(value: SerializedInlineBlock | SerializedBlock): BlockOperand {
  return { type: HighLevelOperands.Block, value };
}

export function stdlibOperand(
  value:
    | 'main'
    | 'trusting-append'
    | 'cautious-append'
    | 'trusting-non-dynamic-append'
    | 'cautious-non-dynamic-append'
): StdLibOperand {
  return { type: HighLevelOperands.StdLib, value };
}

export function nonSmallIntOperand(value: number): NonSmallIntOperand {
  assert(
    !isSmallInt(value),
    'Attempted to make a operand for an int that was not a small int, you should encode this as an immediate'
  );
  return { type: HighLevelOperands.NonSmallInt, value };
}

export function symbolTableOperand(value: SymbolTable): SymbolTableOperand {
  return { type: HighLevelOperands.SymbolTable, value };
}

export function layoutOperand(value: CompilableTemplate): LayoutOperand {
  return { type: HighLevelOperands.Layout, value };
}
