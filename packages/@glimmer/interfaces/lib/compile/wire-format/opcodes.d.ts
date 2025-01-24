// Statements
export type AppendOpcode = 1;
export type UnknownAppendOpcode = 2;
export type UnknownTrustingAppendOpcode = 3;
export type TrustingAppendOpcode = 4;
export type CommentOpcode = 5;
export type ModifierOpcode = 6;
export type StrictModifierOpcode = 7;
export type BlockOpcode = 8;
export type StrictBlockOpcode = 9;
export type ComponentOpcode = 10;

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
export type GetSymbolOpcode = 32; // GetPath + 0-2,
// Lexical symbols are values that are in scope in the template in strict mode
export type GetLexicalSymbolOpcode = 33;
// If a free variable is not a lexical symbol in strict mode, it must be a keyword.
// FIXME: Why does this make it to the wire format in the first place?
export type GetStrictKeywordOpcode = 34;

// a component or helper (`{{<expr> x}}` in append position)
export type GetFreeAsComponentOrHelperHeadOpcode = 35;
// a call head `(x)`
export type GetFreeAsHelperHeadOpcode = 37;
export type GetFreeAsModifierHeadOpcode = 38;
export type GetFreeAsComponentHeadOpcode = 39;

// Keyword Statements
export type InElementOpcode = 40;
export type IfOpcode = 41;
export type EachOpcode = 42;
export type LetOpcode = 44;
export type WithDynamicVarsOpcode = 45;
export type InvokeComponentOpcode = 46;

// Keyword Expressions
export type HasBlockOpcode = 48;
export type HasBlockParamsOpcode = 49;
export type CurryOpcode = 50;
export type NotOpcode = 51;
export type IfInlineOpcode = 52;
export type GetDynamicVarOpcode = 53;
export type LogOpcode = 54;

export type GetStartOpcode = GetSymbolOpcode;
export type GetEndOpcode = GetFreeAsComponentHeadOpcode;
export type GetLooseFreeEndOpcode = GetFreeAsComponentHeadOpcode;

export type GetContextualFreeOpcode =
  | GetFreeAsComponentOrHelperHeadOpcode
  | GetFreeAsHelperHeadOpcode
  | GetFreeAsModifierHeadOpcode
  | GetFreeAsComponentHeadOpcode
  | GetStrictKeywordOpcode;

export type AttrOpcode =
  | StaticAttrOpcode
  | StaticComponentAttrOpcode
  | DynamicAttrOpcode
  | TrustingDynamicAttrOpcode
  | ComponentAttrOpcode
  | TrustingComponentAttrOpcode;
