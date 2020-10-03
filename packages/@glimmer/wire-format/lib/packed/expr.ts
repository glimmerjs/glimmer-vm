import { PresentArray } from '@glimmer/interfaces';

export const enum ExprOp {
  // `0` is reserved
  GetSymbol = 1,
  GetThis = 2,
  GetNamespacedFree = 3,
  GetPath = 4,
  Invoke = 5,
  InvokeNamed = 6,
  GetLooseHelper = 8,
  GetLooseHelperOrComponent = 9,
}

export const enum SpecialExpr {
  HasBlock = 'a',
  HasBlockParams = 'b',
  Undefined = 'c',
  Literal = 'd',
  Interpolate = 'e',
}

export const enum VariableNamespace {
  Helper = 0,
  Component = 1,
  Modifier = 2,
  HelperOrComponent = 3,
}

export type ShorthandGetThis = ExprOp.GetThis;
export type LonghandGetThis = [ExprOp.GetThis];
export type GetThis = ShorthandGetThis | LonghandGetThis;

export type GetSymbol = [op: ExprOp.GetSymbol, symbol: number];
export type GetStrictFree = [op: ExprOp.GetNamespacedFree, upvar: number];
export type GetNamespacedFree = [
  op: ExprOp.GetNamespacedFree,
  upvar: number,
  namespace: VariableNamespace
];

export const enum LooseResolution {
  HelperOrComponent = 0,
  Helper = 1,
}

export type GetLooseHelper = [op: ExprOp.GetLooseHelper, upvar: number];
export type GetLooseHelperOrComponent = [op: ExprOp.GetLooseHelperOrComponent, upvar: number];

export type GetPath = [op: ExprOp.GetPath, callee: Expression, tail: string, ...rest: string[]];

export type InvokeOp<O> =
  | [op: O, callee: Expression]
  | [op: O, callee: Expression, positional: PositionalArguments]
  | [op: O, callee: Expression, positional: PositionalArguments, named: NamedArguments];

export type InvokeN = InvokeOp<ExprOp.Invoke>;

export type InvokeNamed = [op: ExprOp.InvokeNamed, callee: Expression, named: NamedArguments];

export type Invoke = InvokeN | InvokeNamed;

export const enum LiteralValue {
  Null = 0,
  Undefined = 1,
  True = 2,
  False = 3,

  /** The amount to subtract from literal numbers that share the LiteralValue space */
  Offset = 4,
}

export type Null = LiteralValue.Null;
export const Null = LiteralValue.Null;
export type LonghandNull = [op: SpecialExpr.Literal, value: LiteralValue.Null];

export type Undefined = LiteralValue.Undefined;
export const Undefined = LiteralValue.Undefined;
export type LonghandUndefined = [op: SpecialExpr.Literal, value: LiteralValue.Undefined];

export type True = LiteralValue.True;
export const True = LiteralValue.True;
export type LonghandTrue = [op: SpecialExpr.Literal, value: LiteralValue.True];

export type False = LiteralValue.False;
export const False = LiteralValue.False;
export type LonghandFalse = [op: SpecialExpr.Literal, value: LiteralValue.False];

export type FullString = [op: SpecialExpr.Literal, string: string];
/* begins with `:` */
export type ShortString = string;
export type String = FullString | ShortString;

export function string(value: string): String {
  if (/^:|["']/.exec(value)) {
    return [SpecialExpr.Literal, value];
  } else {
    return `:${value}`;
  }
}

export type FullNumber = [op: SpecialExpr.Literal, /** subtract 4 */ number: number];
// begins with `|`
export type ShortNumber = string;
export type Number = FullNumber | ShortNumber;

export function number(value: number): Number {
  return `|${value}`;
}

// typeof ShorthandLiteral = 'number' | 'string'
export type ShorthandLiteral = Null | Undefined | True | False | ShortNumber | ShortString;
export type LonghandLiteral =
  | LonghandNull
  | LonghandUndefined
  | LonghandTrue
  | LonghandFalse
  | FullString
  | FullNumber;
export type Literal = ShorthandLiteral | LonghandLiteral;

export type FullHasBlock = [op: SpecialExpr.HasBlock] | [op: SpecialExpr.HasBlock, block: number];
export type ShorthandHasBlock = SpecialExpr.HasBlock;
export type HasBlock = ShorthandHasBlock | FullHasBlock;

export type FullHasBlockParams =
  | [op: SpecialExpr.HasBlockParams]
  | [op: SpecialExpr.HasBlockParams, block: number];
export type ShorthandHasBlockParams = SpecialExpr.HasBlockParams;
export type HasBlockParams = ShorthandHasBlockParams | FullHasBlockParams;

// typeof ShorthandSpecial === 'string'
export type ShorthandSpecial = ShorthandHasBlock | ShorthandHasBlockParams;
export type LonghandSpecial = FullHasBlock | FullHasBlockParams;
export type Special = ShorthandSpecial | LonghandSpecial;

export type Interpolate = [op: SpecialExpr.Interpolate, ...parts: PresentArray<Expression>];

export type PositionalArguments = PresentArray<Expression> | LiteralValue.Null;

export type PresentNamedArguments = [
  /** pipe-separated list of names */
  names: string,
  ...values: Expression[]
];

export type NamedArguments = PresentNamedArguments | LiteralValue.Null;

export type Args = [positional: PositionalArguments, named: NamedArguments];

export type UnambiguousExpression =
  | GetSymbol
  | GetStrictFree
  | GetNamespacedFree
  | GetLooseHelper
  | GetLooseHelperOrComponent
  | GetPath
  | Invoke;

export type LonghandExpression =
  | UnambiguousExpression
  | LonghandSpecial
  | LonghandLiteral
  | LonghandGetThis;

export type Expression =
  | LonghandExpression
  | ShorthandSpecial
  | ShorthandLiteral
  | ShorthandGetThis;
