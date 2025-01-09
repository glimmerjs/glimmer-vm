import type { DebugOperandTypeName } from '@glimmer/interfaces';

export type NonNullableOperandType = Exclude<DebugOperandTypeName, `${string}?`>;
export type NullableOperandType = Extract<DebugOperandTypeName, `${string}?`> extends `${infer S}?`
  ? S
  : never;
export type OperandType = NonNullableOperandType | NullableOperandType;

export interface NormalizedOperand {
  type: OperandType;
  name: string;
}

export type ShorthandOperandList =
  | []
  | [ShorthandOperand]
  | [ShorthandOperand, ShorthandOperand]
  | [ShorthandOperand, ShorthandOperand, ShorthandOperand];

type AllOperandNames = NonNullableOperandType | NullableOperandType | `${NullableOperandType}?`;
export type ShorthandOperand = `${string}:${AllOperandNames}`;
