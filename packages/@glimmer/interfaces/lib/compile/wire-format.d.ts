import { PresentArray } from '../array';
import { Dict, Optional } from '../core';

export type TupleSyntax = Statement | TupleExpression;

type JsonValue = string | number | boolean | JsonObject | JsonArray;

interface JsonObject extends Dict<JsonValue> {}
interface JsonArray extends Array<JsonValue> {}

export type TemplateReference = Optional<SerializedBlock>;
export type YieldTo = number;

/**
 * A VariableResolutionContext explains how a variable name should be resolved.
 */
export const enum VariableResolutionContext {
  Strict = 0,
  AmbiguousAppend = 1,
  AmbiguousAppendInvoke = 2,
  AmbiguousAttr = 3,
  LooseFreeVariable = 4,
  ResolveAsCallHead = 5,
  ResolveAsModifierHead = 6,
  ResolveAsComponentHead = 7,
}

export const enum SexpOpcodes {
  // Statements
  Append = 1,
  TrustingAppend = 2,
  Comment = 3,
  Modifier = 4,
  StrictModifier = 5,
  Block = 6,
  StrictBlock = 7,
  Component = 8,

  OpenElement = 10,
  OpenElementWithSplat = 11,
  FlushElement = 12,
  CloseElement = 13,
  StaticAttr = 14,
  DynamicAttr = 15,
  ComponentAttr = 16,

  AttrSplat = 17,
  Yield = 18,
  Partial = 19,

  DynamicArg = 20,
  StaticArg = 21,
  TrustingDynamicAttr = 22,
  TrustingComponentAttr = 23,
  StaticComponentAttr = 24,

  Debugger = 26,

  // Expressions
  HasBlock = 27,
  HasBlockParams = 28,
  Undefined = 29,
  Call = 30,
  Concat = 31,

  GetPath = 32,

  // Get
  GetSymbol = 33, // GetPath + 0-2,
  GetStrictFree = 34,

  // falls back to `this.` (or locals in the case of partials), but
  // never turns into a component or helper invocation
  GetFreeAsFallback = 35,
  // `{{x}}` in append position (might be a helper or component invocation, otherwise fall back to `this`)
  GetFreeAsComponentOrHelperHeadOrThisFallback = 36,
  // a component or helper (`{{<expr> x}}` in append position)
  GetFreeAsComponentOrHelperHead = 37,
  // a helper or `this` fallback `attr={{x}}`
  GetFreeAsHelperHeadOrThisFallback = 38,
  // a call head `(x)`
  GetFreeAsHelperHead = 39,
  GetFreeAsModifierHead = 40,
  GetFreeAsComponentHead = 41,

  // InElement
  InElement = 42,

  GetStart = GetPath,
  GetEnd = GetFreeAsComponentHead,
  GetLooseFreeStart = GetFreeAsComponentOrHelperHeadOrThisFallback,
  GetLooseFreeEnd = GetFreeAsComponentHead,
  GetContextualFreeStart = GetFreeAsComponentOrHelperHeadOrThisFallback,
}

export type GetContextualFreeOp =
  | SexpOpcodes.GetFreeAsComponentOrHelperHeadOrThisFallback
  | SexpOpcodes.GetFreeAsComponentOrHelperHead
  | SexpOpcodes.GetFreeAsHelperHeadOrThisFallback
  | SexpOpcodes.GetFreeAsHelperHead
  | SexpOpcodes.GetFreeAsModifierHead
  | SexpOpcodes.GetFreeAsComponentHead
  | SexpOpcodes.GetFreeAsFallback
  | SexpOpcodes.GetStrictFree;

export type StatementSexpOpcode = Statement[0];
export type StatementSexpOpcodeMap = {
  [TSexpOpcode in Statement[0]]: Extract<Statement, { 0: TSexpOpcode }>;
};
export type ExpressionSexpOpcode = TupleExpression[0];
export type ExpressionSexpOpcodeMap = {
  [TSexpOpcode in TupleExpression[0]]: Extract<TupleExpression, { 0: TSexpOpcode }>;
};

export interface SexpOpcodeMap extends ExpressionSexpOpcodeMap, StatementSexpOpcodeMap {}
export type SexpOpcode = keyof SexpOpcodeMap;

export namespace Core {
  export type Expression = Expressions.Expression;

  export type CallArgs = [Params, Hash];
  export type Path = [string, ...string[]];
  export type ConcatParams = PresentArray<Expression>;
  export type Params = Optional<ConcatParams>;
  export type Hash = Optional<[PresentArray<string>, PresentArray<Expression>]>;
  export type Blocks = Optional<[string[], SerializedInlineBlock[]]>;
  export type Args = [Params, Hash];
  export type NamedBlock = [string, SerializedInlineBlock];
  export type EvalInfo = number[];
  export type ElementParameters = Optional<PresentArray<Parameter>>;

  export type Syntax = Path | Params | ConcatParams | Hash | Blocks | Args | EvalInfo;
}

export type CoreSyntax = Core.Syntax;

export namespace Expressions {
  export type Path = Core.Path;
  export type Params = Core.Params;
  export type Hash = Core.Hash;

  export type GetSymbol = [SexpOpcodes.GetSymbol, number];
  export type GetStrictFree = [SexpOpcodes.GetStrictFree, number];
  export type GetFreeAsThisFallback = [SexpOpcodes.GetFreeAsFallback, number];
  export type GetFreeAsComponentOrHelperHeadOrThisFallback = [
    SexpOpcodes.GetFreeAsComponentOrHelperHeadOrThisFallback,
    number
  ];
  export type GetFreeAsComponentOrHelperHead = [SexpOpcodes.GetFreeAsComponentOrHelperHead, number];
  export type GetFreeAsHelperHeadOrThisFallback = [
    SexpOpcodes.GetFreeAsHelperHeadOrThisFallback,
    number
  ];
  export type GetFreeAsCallHead = [SexpOpcodes.GetFreeAsHelperHead, number];
  export type GetFreeAsModifierHead = [SexpOpcodes.GetFreeAsModifierHead, number];
  export type GetFreeAsComponentHead = [SexpOpcodes.GetFreeAsComponentHead, number];

  export type GetContextualFree =
    | GetFreeAsThisFallback
    | GetFreeAsComponentOrHelperHeadOrThisFallback
    | GetFreeAsComponentOrHelperHead
    | GetFreeAsHelperHeadOrThisFallback
    | GetFreeAsCallHead
    | GetFreeAsModifierHead
    | GetFreeAsComponentHead;

  export type GetVar = GetSymbol | GetStrictFree | GetContextualFree;
  export type GetPath = [SexpOpcodes.GetPath, Expression, Path];
  export type Get = GetVar | GetPath;

  export type StringValue = string;
  export type NumberValue = number;
  export type BooleanValue = boolean;
  export type NullValue = null;
  export type Value = StringValue | NumberValue | BooleanValue | NullValue;
  export type Undefined = [SexpOpcodes.Undefined];

  export type TupleExpression = Get | Concat | HasBlock | HasBlockParams | Helper | Undefined;

  // TODO get rid of undefined, which is just here to allow trailing undefined in attrs
  // it would be better to handle that as an over-the-wire encoding concern
  export type Expression = TupleExpression | Value | undefined;

  export type Concat = [SexpOpcodes.Concat, Core.ConcatParams];
  export type Helper = [SexpOpcodes.Call, Expression, Optional<Params>, Hash];
  export type HasBlock = [SexpOpcodes.HasBlock, Expression];
  export type HasBlockParams = [SexpOpcodes.HasBlockParams, Expression];
}

export type Expression = Expressions.Expression;
export type Get = Expressions.GetVar;

export type TupleExpression = Expressions.TupleExpression;

export const enum WellKnownAttrName {
  class = 0,
  id = 1,
  value = 2,
  name = 3,
  type = 4,
  style = 5,
  href = 6,
}

export const enum WellKnownTagName {
  div = 0,
  span = 1,
  p = 2,
  a = 3,
}

export namespace Statements {
  export type Expression = Expressions.Expression | undefined;
  export type Params = Core.Params;
  export type Hash = Core.Hash;
  export type Blocks = Core.Blocks;
  export type Path = Core.Path;

  export type Append = [SexpOpcodes.Append, Expression];
  export type TrustingAppend = [SexpOpcodes.TrustingAppend, Expression];
  export type Comment = [SexpOpcodes.Comment, string];
  export type Modifier = [SexpOpcodes.Modifier, Expression, Params, Hash];
  export type Block = [SexpOpcodes.Block, Expression, Optional<Params>, Hash, Blocks];
  export type Component = [
    op: SexpOpcodes.Component,
    tag: Expression,
    parameters: Core.ElementParameters,
    args: Hash,
    blocks: Blocks
  ];
  export type OpenElement = [SexpOpcodes.OpenElement, string | WellKnownTagName];
  export type OpenElementWithSplat = [SexpOpcodes.OpenElementWithSplat, string | WellKnownTagName];
  export type FlushElement = [SexpOpcodes.FlushElement];
  export type CloseElement = [SexpOpcodes.CloseElement];
  export type StaticAttr = [
    SexpOpcodes.StaticAttr,
    string | WellKnownAttrName,
    Expression,
    string?
  ];
  export type StaticComponentAttr = [
    SexpOpcodes.StaticComponentAttr,
    string | WellKnownAttrName,
    Expression,
    string?
  ];
  export type DynamicAttr = [
    SexpOpcodes.DynamicAttr,
    string | WellKnownAttrName,
    Expression,
    string?
  ];
  export type ComponentAttr = [
    SexpOpcodes.ComponentAttr,
    string | WellKnownAttrName,
    Expression,
    string?
  ];
  export type AttrSplat = [SexpOpcodes.AttrSplat, YieldTo];
  export type Yield = [SexpOpcodes.Yield, YieldTo, Optional<Params>];
  export type Partial = [SexpOpcodes.Partial, Expression, Core.EvalInfo];
  export type DynamicArg = [SexpOpcodes.DynamicArg, string, Expression];
  export type StaticArg = [SexpOpcodes.StaticArg, string, Expression];

  export type TrustingDynamicAttr = [
    SexpOpcodes.TrustingDynamicAttr,
    string | WellKnownAttrName,
    Expression,
    string?
  ];
  export type TrustingComponentAttr = [
    SexpOpcodes.TrustingComponentAttr,
    string | WellKnownAttrName,
    Expression,
    string?
  ];
  export type Debugger = [SexpOpcodes.Debugger, Core.EvalInfo];
  export type InElement = [
    op: SexpOpcodes.InElement,
    block: SerializedInlineBlock,
    guid: string,
    destination: Expression,
    insertBefore?: Expression
  ];

  /**
   * A Handlebars statement
   */
  export type Statement =
    | Append
    | TrustingAppend
    | Comment
    | Modifier
    | Block
    | Component
    | OpenElement
    | OpenElementWithSplat
    | FlushElement
    | CloseElement
    | StaticAttr
    | StaticComponentAttr
    | DynamicAttr
    | ComponentAttr
    | AttrSplat
    | Yield
    | Partial
    | StaticArg
    | DynamicArg
    | TrustingDynamicAttr
    | TrustingComponentAttr
    | Debugger
    | InElement;

  export type Attribute =
    | Statements.StaticAttr
    | Statements.StaticComponentAttr
    | Statements.DynamicAttr
    | Statements.TrustingDynamicAttr
    | Statements.ComponentAttr
    | Statements.TrustingComponentAttr;

  export type ComponentFeature = Statements.Modifier | Statements.AttrSplat;
  export type Argument = Statements.StaticArg | Statements.DynamicArg;

  export type Parameter = Attribute | Argument | ComponentFeature;
}

/** A Handlebars statement */
export type Statement = Statements.Statement;
export type Attribute = Statements.Attribute;
export type Argument = Statements.Argument;
export type Parameter = Statements.Parameter;

export type SexpSyntax = Statement | TupleExpression;
// TODO this undefined is related to the other TODO in this file
export type Syntax = SexpSyntax | Expressions.Value | undefined;

export type SyntaxWithInternal =
  | Syntax
  | CoreSyntax
  | SerializedTemplateBlock
  | Core.CallArgs
  | Core.NamedBlock
  | Core.ElementParameters;

/**
 * A JSON object that the Block was serialized into.
 */
export interface SerializedBlock {
  statements: Statements.Statement[];
}

export interface SerializedInlineBlock extends SerializedBlock {
  parameters: number[];
}

/**
 * A JSON object that the compiled TemplateBlock was serialized into.
 */
export interface SerializedTemplateBlock extends SerializedBlock {
  symbols: string[];
  hasEval: boolean;
  upvars: string[];
}

/**
 * A JSON object that the compiled Template was serialized into.
 */
export interface SerializedTemplate<T> {
  block: SerializedTemplateBlock;
  id?: Optional<string>;
  meta: T;
}

/**
 * A string of JSON containing a SerializedTemplateBlock
 */
export type SerializedTemplateBlockJSON = string;

/**
 * A JSON object containing the SerializedTemplateBlock as JSON and TemplateMeta.
 */
export interface SerializedTemplateWithLazyBlock<M> {
  id?: Optional<string>;
  block: SerializedTemplateBlockJSON;
  meta: M;
}

/**
 * A string of Javascript containing a SerializedTemplateWithLazyBlock to be
 * concatenated into a Javascript module.
 */
export type TemplateJavascript = string;
