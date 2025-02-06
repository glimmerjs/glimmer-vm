/* eslint-disable @typescript-eslint/no-namespace */
import type { RequireAtLeastOne, UndefinedOnPartialDeep } from 'type-fest';

import type { PresentArray } from '../../array';
import type { Nullable, Optional } from '../../core';
import type { CurriedType } from '../../curry';
import type {
  AppendBuiltinHelperOpcode,
  AppendLexicalOpcode,
  AppendOpcode,
  AppendResolvedHelperOpcode,
  AppendResolvedOpcode,
  AppendStaticOpcode,
  AppendTrustedHtmlOpcode,
  AttrOpcode,
  AttrSplatOpcode,
  CallLexicalOpcode,
  CallResolvedOpcode,
  CloseElementOpcode,
  CommentOpcode,
  ComponentAttrOpcode,
  ConcatOpcode,
  CurryOpcode,
  DebuggerOpcode,
  DynamicArgOpcode,
  DynamicAttrOpcode,
  DynamicBlockOpcode,
  EachOpcode,
  FlushElementOpcode,
  GetDynamicVarOpcode,
  GetLexicalSymbolOpcode,
  GetLocalSymbolOpcode,
  GetStrictKeywordOpcode,
  HasBlockOpcode,
  HasBlockParamsOpcode,
  IfInlineOpcode,
  IfOpcode,
  InElementOpcode,
  InvokeComponentKeywordOpcode,
  InvokeDynamicComponentOpcode,
  InvokeLexicalComponentOpcode,
  InvokeResolvedComponentOpcode,
  LetOpcode,
  LexicalModifierOpcode,
  LogOpcode,
  NotOpcode,
  OpenElementOpcode,
  OpenElementWithSplatOpcode,
  ResolveAsComponentHeadOpcode,
  ResolveAsComponentOrHelperHeadOpcode,
  ResolveAsHelperHeadOpcode,
  ResolveAsModifierHeadOpcode,
  ResolvedBlockOpcode,
  ResolvedModifierOpcode,
  StaticArgOpcode,
  StaticAttrOpcode,
  StaticComponentAttrOpcode,
  TrustingComponentAttrOpcode,
  TrustingDynamicAttrOpcode,
  UndefinedOpcode,
  UnknownAppendOpcode,
  UnknownTrustingAppendOpcode,
  WithDynamicVarsOpcode,
  YieldOpcode,
} from './opcodes.js';

export type * from './opcodes.js';
export type * from './resolution.js';

export type TupleSyntax = Content | TupleExpression;

export type TemplateReference = Nullable<SerializedBlock>;
export type YieldTo = number;

export type ContentSexpOpcode = Content[0];
export type ContentSexpOpcodeMap = {
  [TSexpOpcode in Content[0]]: Extract<Content, { 0: TSexpOpcode }>;
};
export type ExpressionSexpOpcode = TupleExpression[0];
export type ExpressionSexpOpcodeMap = {
  [TSexpOpcode in TupleExpression[0]]: Extract<TupleExpression, { 0: TSexpOpcode }>;
};

export interface SexpOpcodeMap extends ExpressionSexpOpcodeMap, ContentSexpOpcodeMap {}
export type SexpOpcode = keyof SexpOpcodeMap;

export namespace Core {
  export type Expression = Expressions.Expression;

  export type DebugSymbols = [locals: Record<string, number>, upvars: Record<string, number>];

  export type Path = [string, ...string[]];
  export type Params = PresentArray<Expression>;
  export type ConcatParams = Params;
  export type Hash = [PresentArray<string>, PresentArray<Expression>];
  export type Blocks = [PresentArray<string>, PresentArray<SerializedInlineBlock>];
  export type Args = RequireAtLeastOne<{ params: Params; hash: Hash }>;
  export type CallArgs = Args;
  export type NamedBlock = [string, SerializedInlineBlock];
  export type Splattributes = PresentArray<ElementParameter>;

  export type Syntax = Path | Params | Hash | Blocks | Args;

  export type ComponentArgs = RequireAtLeastOne<{
    splattributes?: Splattributes;
    hash?: Hash;
    blocks?: Blocks;
  }>;

  export type BlockArgs = RequireAtLeastOne<{ params: Params; hash: Hash; blocks: Blocks }>;

  export type SomeArgs = Partial<{
    splattributes?: Splattributes;
    hash?: Hash;
    blocks?: Blocks;
  }>;
}

export type CoreSyntax = Core.Syntax;

export namespace Expressions {
  export type Path = Core.Path;
  export type Params = Core.Params;
  export type Hash = Core.Hash;

  export type GetLocalSymbol = [GetLocalSymbolOpcode, number];
  export type GetLexicalSymbol = [GetLexicalSymbolOpcode, number];
  export type GetStrictKeyword = [GetStrictKeywordOpcode, number];
  export type GetFreeAsComponentOrHelperHead = [ResolveAsComponentOrHelperHeadOpcode, number];
  export type GetFreeAsHelperHead = [ResolveAsHelperHeadOpcode, number];
  export type GetFreeAsModifierHead = [ResolveAsModifierHeadOpcode, number];
  export type GetFreeAsComponentHead = [ResolveAsComponentHeadOpcode, number];

  export type GetUnknownAppend = GetFreeAsComponentOrHelperHead | GetFreeAsHelperHead;

  export type GetResolved =
    | GetFreeAsComponentOrHelperHead
    | GetFreeAsHelperHead
    | GetFreeAsModifierHead
    | GetFreeAsComponentHead;
  export type GetResolvedOrKeyword = GetStrictKeyword | GetResolved;
  export type GetVar = GetLocalSymbol | GetLexicalSymbol | GetResolvedOrKeyword;

  export type GetPathSymbol = [GetLocalSymbolOpcode, number, Path];
  export type GetPathLexicalSymbol = [GetLexicalSymbolOpcode, number, Path];
  export type GetPathFreeAsComponentOrHelperHead = [
    ResolveAsComponentOrHelperHeadOpcode,
    number,
    Path,
  ];
  export type GetPathFreeAsHelperHead = [ResolveAsHelperHeadOpcode, number, Path];
  export type GetPathFreeAsModifierHead = [ResolveAsModifierHeadOpcode, number, Path];
  export type GetPathFreeAsComponentHead = [ResolveAsComponentHeadOpcode, number, Path];

  export type GetPathContextualFree =
    | GetPathFreeAsComponentOrHelperHead
    | GetPathFreeAsHelperHead
    | GetPathFreeAsModifierHead
    | GetPathFreeAsComponentHead;
  export type GetPath = GetPathSymbol | GetPathLexicalSymbol | GetPathContextualFree;

  export type Get = GetVar | GetPath;

  export type StringValue = string;
  export type NumberValue = number;
  export type BooleanValue = boolean;
  export type NullValue = null;
  export type Value = StringValue | NumberValue | BooleanValue | NullValue;
  export type Undefined = [UndefinedOpcode];

  export type TupleExpression =
    | Get
    | GetDynamicVar
    | Concat
    | HasBlock
    | HasBlockParams
    | Curry
    | ResolvedHelper
    | ConstantHelper
    | Undefined
    | IfInline
    | Not
    | Log;

  // TODO get rid of undefined, which is just here to allow trailing undefined in attrs
  // it would be better to handle that as an over-the-wire encoding concern
  export type Expression = TupleExpression | Value | undefined;

  export type Concat = [ConcatOpcode, Core.ConcatParams];
  export type ResolvedHelper = [CallResolvedOpcode, Expression, args?: Optional<Core.Args>];
  export type ConstantHelper = [CallLexicalOpcode, Expression, args?: Optional<Core.Args>];
  export type HasBlock = [HasBlockOpcode, Expression];
  export type HasBlockParams = [HasBlockParamsOpcode, Expression];
  export type Curry = [CurryOpcode, Expression, CurriedType, args?: Optional<Core.Args>];

  export type SomeInvoke = ResolvedHelper | ConstantHelper;

  export type IfInline = [
    op: IfInlineOpcode,
    condition: Expression,
    truthyValue: Expression,
    falsyValue?: Nullable<Expression>,
  ];

  export type Not = [op: NotOpcode, value: Expression];

  export type GetDynamicVar = [op: GetDynamicVarOpcode, value: Expression];

  export type Log = [op: LogOpcode, positional?: Optional<Params>];
}

export type Expression = Expressions.Expression;
export type Get = Expressions.GetVar;

export type TupleExpression = Expressions.TupleExpression;

export type ClassAttr = 0;
export type IdAttr = 1;
export type ValueAttr = 2;
export type NameAttr = 3;
export type TypeAttr = 4;
export type StyleAttr = 5;
export type HrefAttr = 6;

export type WellKnownAttrName =
  | ClassAttr
  | IdAttr
  | ValueAttr
  | NameAttr
  | TypeAttr
  | StyleAttr
  | HrefAttr;

export type DivTag = 0;
export type SpanTag = 1;
export type PTag = 2;
export type ATag = 3;

export type WellKnownTagName = DivTag | SpanTag | PTag | ATag;

export namespace Content {
  export type Expression = Expressions.Expression | undefined;
  export type Params = Core.Params;
  export type Hash = Core.Hash;
  export type Blocks = Core.Blocks;
  export type Path = Core.Path;

  export type SomeAppend =
    | AppendValue
    | AppendStatic
    | AppendResolvedComponent
    | AppendLexical
    | AppendResolved
    | AppendBuiltinHelper
    | AppendTrustedHtml
    | UnknownAppend
    | UnknownTrustingAppend;
  export type SomeModifier = LexicalModifier | ResolvedModifier;
  export type SomeInvokeComponent =
    | InvokeComponentKeyword
    | InvokeLexicalComponent
    | InvokeDynamicComponent
    | InvokeResolvedComponent;
  export type SomeBlock = ResolvedBlock | DynamicBlock | InvokeLexicalComponent;

  export type UnknownAppend = [UnknownAppendOpcode, Expressions.GetUnknownAppend];
  export type UnknownTrustingAppend = [UnknownTrustingAppendOpcode, Expressions.GetUnknownAppend];
  export type AppendValue = [AppendOpcode, TupleExpression];
  export type AppendResolvedComponent = [AppendResolvedOpcode, target: Expressions.SomeInvoke];
  export type AppendLexical = [AppendLexicalOpcode, target: Expressions.SomeInvoke];
  export type AppendResolved = [AppendResolvedHelperOpcode, target: Expressions.SomeInvoke];
  export type AppendBuiltinHelper = [AppendBuiltinHelperOpcode, target: Expressions.SomeInvoke];
  export type AppendStatic = [
    AppendStaticOpcode,
    target: string | number | boolean | null | undefined,
  ];

  export type AppendTrustedHtml = [AppendTrustedHtmlOpcode, Expression];
  export type AppendHtmlComment = [CommentOpcode, string];
  export type LexicalModifier = [LexicalModifierOpcode, Expression, args?: Optional<Core.Args>];
  export type ResolvedModifier = [ResolvedModifierOpcode, Expression, args?: Optional<Core.Args>];
  export type ResolvedBlock = [
    ResolvedBlockOpcode,
    path: Expressions.GetVar,
    args?: Optional<Core.BlockArgs>,
  ];
  export type DynamicBlock = [
    DynamicBlockOpcode,
    path: Expressions.Get,
    args?: Optional<Core.BlockArgs>,
  ];

  export type OpenElement = [OpenElementOpcode, string | WellKnownTagName];
  export type OpenElementWithSplat = [OpenElementWithSplatOpcode, string | WellKnownTagName];
  export type FlushElement = [FlushElementOpcode];
  export type CloseElement = [CloseElementOpcode];

  type Attr<Op extends AttrOpcode> = [
    op: Op,
    name: string | WellKnownAttrName,
    value: Expression,
    namespace?: string | undefined,
  ];

  export type StaticAttr = Attr<StaticAttrOpcode>;
  export type StaticComponentAttr = Attr<StaticComponentAttrOpcode>;

  export type AnyStaticAttr = StaticAttr | StaticComponentAttr;

  export type AttrSplat = [AttrSplatOpcode, YieldTo];
  export type Yield = [YieldOpcode, YieldTo, params?: Optional<Params>];
  export type DynamicArg = [DynamicArgOpcode, string, Expression];
  export type StaticArg = [StaticArgOpcode, string, Expression];

  export type DynamicAttr = Attr<DynamicAttrOpcode>;
  export type ComponentAttr = Attr<ComponentAttrOpcode>;
  export type TrustingDynamicAttr = Attr<TrustingDynamicAttrOpcode>;
  export type TrustingComponentAttr = Attr<TrustingComponentAttrOpcode>;

  export type AnyDynamicAttr =
    | DynamicAttr
    | ComponentAttr
    | TrustingDynamicAttr
    | TrustingComponentAttr;

  export type Debugger = [
    op: DebuggerOpcode,
    locals: Record<string, number>,
    upvars: Record<string, number>,
    lexical: Record<string, number>,
  ];
  export type InElement = [
    op: InElementOpcode,
    block: SerializedInlineBlock,
    guid: string,
    destination: Expression,
    insertBefore?: Expression,
  ];

  export type If = [
    op: IfOpcode,
    condition: Expression,
    block: SerializedInlineBlock,
    inverse: Nullable<SerializedInlineBlock>,
  ];

  export type Each = [
    op: EachOpcode,
    condition: Expression,
    key: Nullable<Expression>,
    block: SerializedInlineBlock,
    inverse: Nullable<SerializedInlineBlock>,
  ];

  export type Let = [
    op: LetOpcode,
    positional: Optional<Core.Params>,
    block: SerializedInlineBlock,
  ];

  export type WithDynamicVars = [
    op: WithDynamicVarsOpcode,
    args: Optional<Core.Hash>,
    block: SerializedInlineBlock,
  ];

  export type InvokeComponentKeyword = [
    op: InvokeComponentKeywordOpcode,
    definition: Expression,
    args?: Optional<Core.BlockArgs>,
  ];

  export type InvokeLexicalComponent = [
    op: InvokeLexicalComponentOpcode,
    definition: Expression,
    args?: Optional<Core.ComponentArgs>,
  ];

  export type InvokeResolvedComponent = [
    op: InvokeResolvedComponentOpcode,
    // A resolved component is, by definition, not a dot-separated path
    tag: Expressions.GetVar,
    args?: Optional<Core.ComponentArgs>,
  ];

  export type InvokeDynamicComponent = [
    op: InvokeDynamicComponentOpcode,
    tag: Expression,
    args?: Optional<Core.ComponentArgs>,
  ];

  /**
   * A Handlebars statement
   */
  export type Content =
    | SomeAppend
    | SomeModifier
    | SomeInvokeComponent
    | SomeBlock
    | AppendHtmlComment
    | InvokeResolvedComponent
    | InvokeDynamicComponent
    | OpenElement
    | OpenElementWithSplat
    | FlushElement
    | CloseElement
    | Attribute
    | AttrSplat
    | Yield
    | StaticArg
    | DynamicArg
    | Debugger
    | InElement
    | If
    | Each
    | Let
    | WithDynamicVars;

  export type Attribute =
    | StaticAttr
    | StaticComponentAttr
    | DynamicAttr
    | TrustingDynamicAttr
    | ComponentAttr
    | TrustingComponentAttr;

  export type ComponentFeature = SomeModifier | AttrSplat;
  export type Argument = StaticArg | DynamicArg;

  export type ElementParameter = Attribute | Argument | ComponentFeature;
}

/** Appends content (`{{}}`, `<>`, or block) */
export type Content = Content.Content;
export type Attribute = Content.Attribute;
export type Argument = Content.Argument;
export type ElementParameter = Content.ElementParameter;

export type SexpSyntax = Content | TupleExpression;
// TODO this undefined is related to the other TODO in this file
export type Syntax = SexpSyntax | Expressions.Value | undefined;

export type SyntaxWithInternal =
  | Syntax
  | CoreSyntax
  | SerializedTemplateBlock
  | Core.CallArgs
  | Core.NamedBlock
  | Core.Splattributes;

/**
 * A JSON object that the Block was serialized into.
 */
export type SerializedBlock = [statements: Content.Content[]];

export type SerializedInlineBlock = [statements: Content.Content[], parameters: number[]];

/**
 * A JSON object that the compiled TemplateBlock was serialized into.
 */
export type SerializedTemplateBlock = [
  statements: Content.Content[],
  locals: string[],
  upvars: string[],
  lexicalSymbols?: string[],
];

/**
 * A JSON object that the compiled Template was serialized into.
 */
export interface SerializedTemplate {
  block: SerializedTemplateBlock;
  id?: Nullable<string>;
  moduleName: string;
}

/**
 * A string of JSON containing a SerializedTemplateBlock
 */
export type SerializedTemplateBlockJSON = string;

/**
 * A JSON object containing the SerializedTemplateBlock as JSON and TemplateMeta.
 */
export interface SerializedTemplateWithLazyBlock {
  id?: Nullable<string>;
  block: SerializedTemplateBlockJSON;
  moduleName: string;
  scope?: (() => unknown[]) | undefined | null;
  isStrictMode: boolean;
}

/**
 * A string of Javascript containing a SerializedTemplateWithLazyBlock to be
 * concatenated into a Javascript module.
 */
export type TemplateJavascript = string;

export type Buildable<T extends unknown[]> = UndefinedOnPartialDeep<T>;
