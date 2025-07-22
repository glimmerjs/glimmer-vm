// Statements
export type AppendValueCautiouslyOpcode = 1;
export type AppendResolvedValueCautiouslyOpcode = 303;
export type AppendResolvedInvokableCautiouslyOpcode = 100;
export type AppendInvokableCautiouslyOpcode = 300;
export type AppendTrustedResolvedInvokableOpcode = 200;
export type AppendTrustedInvokableOpcode = 301;
export type AppendStaticOpcode = 104;
export type AppendDynamicInvokableOpcode = 103;
export type AppendTrustedHtmlOpcode = 4;
export type AppendResolvedTrustedHtmlOpcode = 302;
export type AppendHtmlTextOpcode = 106;
export type CommentOpcode = 5;
export type DynamicModifierOpcode = 6;
export type LexicalModifierOpcode = 7;
export type ResolvedModifierOpcode = 56;
export type InvokeDynamicBlockOpcode = 57;
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
export type CallDynamicValueOpcode = 29;
export type UnknownInvokeOpcode = 30;
export type ConcatOpcode = 31;

// Get a local value via symbol
export type GetLocalSymbolOpcode = 32; // GetPath + 0-2,
// Lexical symbols are values that are in scope in the template in strict mode
export type GetLexicalSymbolOpcode = 33;
// If a free variable is not a lexical symbol in strict mode, it must be a keyword.
// Since strict mode embedding environments are allowed to define resolved runtime keywords, this
// opcode propagates a name that is not in scope to runtime. When keywords are passed to the
// precompile step, specified keywords also get this opcode.
export type GetKeywordOpcode = 34;

export type GetPathOpcode = 107;

// Flat expression opcodes for wire format flattening
export type GetPropertyOpcode = 108;
export type StackExpressionOpcode = 109;
export type PushImmediateOpcode = 110;
export type PushConstantOpcode = 111;
export type PushArgsOpcode = 112;
export type CallHelperOpcode = 113;
export type CallDynamicHelperOpcode = 114;
export type BeginCallOpcode = 115;
export type BeginCallDynamicOpcode = 116;

export type EmptyArgsOpcode = 0b000;
export type PositionalArgsOpcode = 0b100;
export type NamedArgsOpcode = 0b010;
export type PositionalAndNamedArgsOpcode = 0b110;
export type PositionalAndBlocksOpcode = 0b101;
export type NamedArgsAndBlocksOpcode = 0b011;
export type PositionalAndNamedArgsAndBlocksOpcode = 0b111;
export type BlocksOpcode = 0b001;

export type HasPositionalArgsFlag = 0b100;
export type HasNamedArgsFlag = 0b010;
export type HasBlocksFlag = 0b001;

// a component or helper (`{{<expr> x}}` in append position)
export type ResolveAsCurlyCalleeOpcode = 35;
// a call head `(x)`
export type ResolveAsHelperCalleeOpcode = 37;
export type ResolveAsModifierHeadOpcode = 38;
export type ResolveAsComponentCalleeOpcode = 39;

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
export type GetEndOpcode = ResolveAsComponentCalleeOpcode;
export type GetLooseFreeEndOpcode = ResolveAsComponentCalleeOpcode;

export type GetResolvedOpcode =
  | ResolveAsCurlyCalleeOpcode
  | ResolveAsHelperCalleeOpcode
  | ResolveAsModifierHeadOpcode
  | ResolveAsComponentCalleeOpcode;

export type GetResolvedOrKeywordOpcode =
  | ResolveAsCurlyCalleeOpcode
  | ResolveAsHelperCalleeOpcode
  | ResolveAsModifierHeadOpcode
  | ResolveAsComponentCalleeOpcode
  | GetKeywordOpcode;

export type AttrOpcode =
  | StaticAttrOpcode
  | StaticComponentAttrOpcode
  | DynamicAttrOpcode
  | TrustingDynamicAttrOpcode
  | ComponentAttrOpcode
  | TrustingComponentAttrOpcode;
