// Statements
export type AppendOpcode = 1;
export type AppendResolvedOpcode = 100;
export type AppendStaticOpcode = 104;
export type AppendLexicalOpcode = 103;
export type AppendResolvedHelperOpcode = 101;
export type AppendBuiltinHelperOpcode = 102;
export type UnknownAppendOpcode = 2;
export type UnknownTrustingAppendOpcode = 3;
export type AppendTrustedHtmlOpcode = 4;
export type CommentOpcode = 5;
export type LexicalModifierOpcode = 6;
export type ResolvedModifierOpcode = 56;
export type StrictModifierOpcode = 7;
export type ResolvedBlockOpcode = 8;
export type LexicalBlockComponentOpcode = 9;
export type DynamicBlockOpcode = 57;
export type InvokeDynamicComponentOpcode = 58;

export type OpenElementOpcode = 11;
export type OpenElementWithSplatOpcode = 12;
export type FlushElementOpcode = 13;
export type CloseElementOpcode = 14;
export type StaticAttrOpcode = 15;
export type DynamicAttrOpcode = 16;
export type ComponentAttrOpcode = 17;

export type AttrSplatOpcode = 18;
export type YieldOpcode = 19;

export type DynamicArgOpcode = 20;
export type StaticArgOpcode = 21;
export type TrustingDynamicAttrOpcode = 22;
export type TrustingComponentAttrOpcode = 23;
export type StaticComponentAttrOpcode = 24;

export type DebuggerOpcode = 26;

// Expressions
export type UndefinedOpcode = 27;
export type CallResolvedOpcode = 28;
export type CallLexicalOpcode = 29;
export type UnknownInvokeOpcode = 30;
export type ConcatOpcode = 31;

// Get a local value via symbol
export type GetLocalSymbolOpcode = 32; // GetPath + 0-2,
// Lexical symbols are values that are in scope in the template in strict mode
export type GetLexicalSymbolOpcode = 33;
// If a free variable is not a lexical symbol in strict mode, it must be a keyword.
// FIXME: Why does this make it to the wire format in the first place?
export type GetStrictKeywordOpcode = 34;

// a component or helper (`{{<expr> x}}` in append position)
export type ResolveAsComponentOrHelperHeadOpcode = 35;
// a call head `(x)`
export type ResolveAsHelperHeadOpcode = 37;
export type ResolveAsModifierHeadOpcode = 38;
export type ResolveAsComponentHeadOpcode = 39;

// Keyword Statements
export type InElementOpcode = 40;
export type IfOpcode = 41;
export type EachOpcode = 42;
export type LetOpcode = 44;
export type WithDynamicVarsOpcode = 45;
export type InvokeComponentKeywordOpcode = 46;
export type InvokeResolvedComponentOpcode = 47;
export type InvokeLexicalComponentOpcode = 55;

// Keyword Expressions
export type HasBlockOpcode = 48;
export type HasBlockParamsOpcode = 49;
export type CurryOpcode = 50;
export type NotOpcode = 51;
export type IfInlineOpcode = 52;
export type GetDynamicVarOpcode = 53;
export type LogOpcode = 54;

export type GetStartOpcode = GetLocalSymbolOpcode;
export type GetEndOpcode = ResolveAsComponentHeadOpcode;
export type GetLooseFreeEndOpcode = ResolveAsComponentHeadOpcode;

export type GetResolvedOpcode =
  | ResolveAsComponentOrHelperHeadOpcode
  | ResolveAsHelperHeadOpcode
  | ResolveAsModifierHeadOpcode
  | ResolveAsComponentHeadOpcode;

export type GetResolvedOrKeywordOpcode =
  | ResolveAsComponentOrHelperHeadOpcode
  | ResolveAsHelperHeadOpcode
  | ResolveAsModifierHeadOpcode
  | ResolveAsComponentHeadOpcode
  | GetStrictKeywordOpcode;

export type AttrOpcode =
  | StaticAttrOpcode
  | StaticComponentAttrOpcode
  | DynamicAttrOpcode
  | TrustingDynamicAttrOpcode
  | ComponentAttrOpcode
  | TrustingComponentAttrOpcode;
