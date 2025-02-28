/* eslint-disable @typescript-eslint/no-namespace */
import type { Simplify } from 'type-fest';

import type { PresentArray } from '../../array';
import type { Nullable, Optional } from '../../core';
import type { CurriedType } from '../../curry';
import type {
  AppendHtmlTextOpcode,
  AppendInvokableCautiouslyOpcode,
  AppendResolvedInvokableCautiouslyOpcode,
  AppendResolvedTrustedHtmlOpcode,
  AppendResolvedValueCautiouslyOpcode,
  AppendStaticOpcode,
  AppendTrustedHtmlOpcode,
  AppendTrustedInvokableOpcode,
  AppendTrustedResolvedInvokableOpcode,
  AppendValueCautiouslyOpcode,
  AttrOpcode,
  AttrSplatOpcode,
  BlocksOpcode,
  CallDynamicValueOpcode,
  CallResolvedOpcode,
  CloseElementOpcode,
  CommentOpcode,
  ComponentAttrOpcode,
  ConcatOpcode,
  CurryOpcode,
  DebuggerOpcode,
  DynamicArgOpcode,
  DynamicAttrOpcode,
  DynamicModifierOpcode,
  EachOpcode,
  EmptyArgsOpcode,
  FlushElementOpcode,
  GetDynamicVarOpcode,
  GetKeywordOpcode,
  GetLexicalSymbolOpcode,
  GetLocalSymbolOpcode,
  GetPathOpcode,
  HasBlockOpcode,
  HasBlockParamsOpcode,
  IfInlineOpcode,
  IfOpcode,
  InElementOpcode,
  InvokeComponentKeywordOpcode,
  InvokeDynamicBlockOpcode,
  InvokeDynamicComponentOpcode,
  InvokeLexicalComponentOpcode,
  InvokeResolvedComponentOpcode,
  LetOpcode,
  LexicalModifierOpcode,
  LogOpcode,
  NamedArgsAndBlocksOpcode,
  NamedArgsOpcode,
  NotOpcode,
  OpenElementOpcode,
  OpenElementWithSplatOpcode,
  PositionalAndBlocksOpcode,
  PositionalAndNamedArgsAndBlocksOpcode,
  PositionalAndNamedArgsOpcode,
  PositionalArgsOpcode,
  ResolveAsComponentCalleeOpcode,
  ResolveAsCurlyCalleeOpcode,
  ResolveAsHelperCalleeOpcode,
  ResolveAsModifierHeadOpcode,
  ResolvedModifierOpcode,
  StaticArgOpcode,
  StaticAttrOpcode,
  StaticComponentAttrOpcode,
  TrustingComponentAttrOpcode,
  TrustingDynamicAttrOpcode,
  UndefinedOpcode,
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

  export type CallArgs = EmptyArgs | PositionalArgs | NamedArgs | PositionalAndNamedArgs;
  export type BlockArgs =
    | CallArgs
    | PositionalAndBlocksArgs
    | NamedArgsAndBlocksArgs
    | PositionalAndNamedArgsAndBlocksArgs
    | BlocksOnlyArgs;

  export type SomeArgs = Core.CallArgs | Core.BlockArgs;

  export type HasPositionalArgs = PositionalArgs | PositionalAndNamedArgs | PositionalAndBlocksArgs;
  export type HasNamedArgs =
    | PositionalAndNamedArgs
    | PositionalAndNamedArgsAndBlocksArgs
    | NamedArgs
    | NamedArgsAndBlocksArgs;
  export type HasBlocks =
    | PositionalAndBlocksArgs
    | NamedArgsAndBlocksArgs
    | PositionalAndNamedArgsAndBlocksArgs
    | BlocksOnlyArgs;

  export type NamedBlock = [string, SerializedInlineBlock];
  export type Splattributes = PresentArray<ElementParameter>;

  export type EmptyArgs = [EmptyArgsOpcode];
  export type PositionalArgs = [PositionalArgsOpcode, PresentArray<Expression>];
  export type NamedArgs = [NamedArgsOpcode, Hash];
  export type PositionalAndNamedArgs = [
    PositionalAndNamedArgsOpcode,
    PresentArray<Expression>,
    Hash,
  ];

  export type PositionalAndBlocksArgs = [
    PositionalAndBlocksOpcode,
    positional: PresentArray<Expression>,
    blocks: Blocks,
  ];
  export type NamedArgsAndBlocksArgs = [NamedArgsAndBlocksOpcode, named: Hash, blocks: Blocks];
  export type PositionalAndNamedArgsAndBlocksArgs = [
    PositionalAndNamedArgsAndBlocksOpcode,
    positional: PresentArray<Expression>,
    named: Hash,
    blocks: Blocks,
  ];
  export type BlocksOnlyArgs = [BlocksOpcode, blocks: Blocks];

  // export function SimpleArgs(
  //   encode: EncodeOp,
  //   args: Optional<WireFormat.Core.Args>,
  //   atNames: boolean
  // ): void {
  //   if (!args) {
  //     return EmptyArgs(encode);
  //   }

  //   const count = CompilePositional(encode, args.params);

  //   if (args.hash) {
  //     const [names, vals] = args.hash;

  //     for (const val of vals) {
  //       expr(encode, val);
  //     }

  //     return atNames ? CallArgsWithAtNames(encode, count, names) : CallArgs(encode, count, names);
  //   } else {
  //     return CallArgs(encode, count, EMPTY_STRING_ARRAY);
  //   }
  // }
  export type Syntax = Path | Params | Hash | Blocks | CallArgs;
}

export type CoreSyntax = Core.Syntax;

export namespace Expressions {
  export type Path = Core.Path;
  export type Params = Core.Params;
  export type Hash = Core.Hash;

  // export type GetPath

  export type GetLocalSymbol = [GetLocalSymbolOpcode, number];
  export type GetLexicalSymbol = [GetLexicalSymbolOpcode, number];
  export type GetKeyword = [GetKeywordOpcode, number];
  export type ResolveAsCurlyCallee = [ResolveAsCurlyCalleeOpcode, number];
  export type ResolveAsModifierCallee = [ResolveAsModifierHeadOpcode, number];
  export type ResolveAsComponentCallee = [ResolveAsComponentCalleeOpcode, number];

  export type GetUnknownAppend = [ResolveAsCurlyCalleeOpcode, number];

  export type GetResolved =
    | ResolveAsCurlyCallee
    | ResolveAsModifierCallee
    | ResolveAsComponentCallee;
  export type GetResolvedOrKeyword = GetKeyword | GetResolved;
  export type GetVar = GetLocalSymbol | GetLexicalSymbol;

  export type GetPathSymbol = [opcode: GetPathOpcode, ...GetLocalSymbol, path: Path];
  export type GetPathLexicalSymbol = [opcode: GetPathOpcode, ...GetLexicalSymbol, path: Path];

  export type GetPathFreeAsHelperHead = [ResolveAsHelperCalleeOpcode, number, Path];
  export type GetPathFreeAsModifierHead = [ResolveAsModifierHeadOpcode, number, Path];
  export type GetPathFreeAsComponentHead = [ResolveAsComponentCalleeOpcode, number, Path];

  export type GetPath = GetPathSymbol | GetPathLexicalSymbol;

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
    | GetKeyword
    | Concat
    | HasBlock
    | HasBlockParams
    | Curry
    | CallResolvedHelper
    | CallDynamicValue
    | Undefined
    | IfInline
    | Not
    | Log;

  export type StaticValue = Value | Undefined;
  export type Expression = TupleExpression | Value;

  export type Concat = [ConcatOpcode, Core.ConcatParams];
  export type CallResolvedHelper = [
    CallResolvedOpcode,
    /** upvar */
    callee: number,
    args: Core.CallArgs,
  ];
  export type CallDynamicValue = [CallDynamicValueOpcode, Expression, args: Core.CallArgs];
  export type HasBlock = [HasBlockOpcode, Expression];
  export type HasBlockParams = [HasBlockParamsOpcode, Expression];
  export type Curry = [CurryOpcode, Expression, CurriedType, args?: Optional<Core.CallArgs>];

  export type SomeCallHelper = CallResolvedHelper | CallDynamicValue;

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
  export type Expression = Expressions.Expression;
  export type Params = Core.Params;
  export type Hash = Core.Hash;
  export type Blocks = Core.Blocks;
  export type Path = Core.Path;

  export type SomeModifier = DynamicModifier | ResolvedModifier | LexicalModifier;
  export type SomeInvokeComponent =
    | InvokeComponentKeyword
    | InvokeLexicalComponent
    | InvokeDynamicComponent
    | InvokeResolvedComponent;
  export type SomeBlock = InvokeResolvedComponent | InvokeDynamicBlock | InvokeLexicalComponent;

  export type AppendValueCautiously = [AppendValueCautiouslyOpcode, Expression];
  export type AppendResolvedValueCautiously = [AppendResolvedValueCautiouslyOpcode, upvar: number];

  export type AppendResolvedInvokableCautiously = [
    AppendResolvedInvokableCautiouslyOpcode,
    upvar: number,
    args: Core.CallArgs,
  ];

  export type AppendInvokableCautiously = [
    AppendInvokableCautiouslyOpcode,
    callee: Expression,
    args: Core.CallArgs,
  ];

  export type AppendTrustedResolvedInvokable = [
    AppendTrustedResolvedInvokableOpcode,
    upvar: number,
    args: Core.CallArgs,
  ];

  export type AppendTrustedInvokable = [
    AppendTrustedInvokableOpcode,
    callee: Expression,
    args: Core.CallArgs,
  ];

  export type AppendStatic = [AppendStaticOpcode, value: Expressions.StaticValue];

  // Corresponds to `{{{...}}}`
  export type AppendTrustedHtml = [AppendTrustedHtmlOpcode, Expression];
  export type AppendTrustedResolvedHtml = [AppendResolvedTrustedHtmlOpcode, upvar: number];

  export type AppendHtmlComment = [CommentOpcode, string];
  export type AppendHtmlText = [AppendHtmlTextOpcode, string];
  export type DynamicModifier = [DynamicModifierOpcode, Expression, args: Core.CallArgs];
  export type LexicalModifier = [LexicalModifierOpcode, callee: number, args: Core.CallArgs];
  export type ResolvedModifier = [ResolvedModifierOpcode, callee: number, args: Core.CallArgs];

  export type InvokeDynamicBlock = [
    InvokeDynamicBlockOpcode,
    path: Expressions.Get,
    args: Core.BlockArgs,
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
    inverse?: SerializedInlineBlock,
  ];

  export type Each = [
    op: EachOpcode,
    condition: Expression,
    key: Nullable<Expression>,
    block: SerializedInlineBlock,
    inverse?: SerializedInlineBlock,
  ];

  export type Let = [op: LetOpcode, positional: Core.Params, block: SerializedInlineBlock];

  export type WithDynamicVars = [
    op: WithDynamicVarsOpcode,
    args: Core.Hash,
    block: SerializedInlineBlock,
  ];

  export type InvokeComponentKeyword = [
    op: InvokeComponentKeywordOpcode,
    definition: Expression,
    args: Core.BlockArgs,
  ];

  export type InvokeLexicalComponent = [
    op: InvokeLexicalComponentOpcode,
    callee: number,
    args: Core.BlockArgs,
  ];

  export type InvokeResolvedComponent = [
    op: InvokeResolvedComponentOpcode,
    // A resolved component is, by definition, not a dot-separated path
    symbol: number,
    args: Core.BlockArgs,
  ];

  export type InvokeDynamicComponent = [
    op: InvokeDynamicComponentOpcode,
    tag: Expression,
    args: Core.BlockArgs,
  ];

  export type ControlFlow = Debugger | InElement | If | Each | Let | WithDynamicVars | Yield;

  export type StaticHtmlContent =
    | AppendHtmlComment
    | AppendHtmlText
    | OpenElement
    | FlushElement
    | CloseElement;

  export type DynamicHtmlContent =
    | OpenElementWithSplat
    | Attribute
    | AttrSplat
    | StaticArg
    | DynamicArg;

  /**
   * A Handlebars statement
   */
  export type Content =
    | AppendStatic
    | AppendValueCautiously
    | AppendResolvedValueCautiously
    | AppendInvokableCautiously
    | AppendResolvedInvokableCautiously
    | AppendTrustedInvokable
    | AppendTrustedResolvedInvokable
    | AppendTrustedHtml
    | AppendTrustedResolvedHtml
    | StaticHtmlContent
    | DynamicHtmlContent
    | SomeModifier
    | SomeInvokeComponent
    | SomeBlock
    | ControlFlow;

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

// Helper to get the keys of T that are optional in a tuple T.
type OptionalIndices<T extends readonly unknown[]> = {
  [K in keyof T]-?: object extends Pick<T, K> ? K : never;
}[number];

// Main type: for required indices keep the type as-is; for optional indices make the element optional and widen its type by | undefined.
export type Buildable<T extends readonly unknown[]> = Simplify<
  T extends infer Sexp extends readonly unknown[]
    ? // Intersect two mapped types: one for required elements, one for optional.
      { [K in Exclude<keyof Sexp, OptionalIndices<Sexp>>]: Sexp[K] } & {
        [K in OptionalIndices<Sexp>]?: Sexp[K] | undefined;
      } extends infer O
      ? // Reconstruct the tuple type from the intersection.
        { [K in keyof Sexp]: K extends keyof O ? O[K] : never }
      : never
    : never
>;
