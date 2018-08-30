export enum Opcodes {
  // Statements
  Text,
  Append,
  Comment,
  OpenModifier,
  CloseModifier,
  Block,
  Component,
  DynamicComponent,
  OpenElement,
  OpenSplattedElement,
  FlushElement,
  CloseElement,
  StaticAttr,
  DynamicAttr,
  AttrSplat,
  Yield,
  Partial,

  DynamicArg,
  StaticArg,
  TrustingAttr,
  Debugger,
  ClientSideStatement,

  // Expressions

  Unknown,
  Get,
  MaybeLocal,
  HasBlock,
  HasBlockParams,
  Undefined,
  Helper,
  Concat,
  ClientSideExpression,
}
