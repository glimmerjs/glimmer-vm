import type {
  AppendOpcode,
  AttrSplatOpcode,
  BlockOpcode,
  CallOpcode,
  CloseElementOpcode,
  CommentOpcode,
  ComponentAttrOpcode,
  ComponentOpcode,
  ConcatOpcode,
  CurryOpcode,
  DebuggerOpcode,
  DynamicArgOpcode,
  DynamicAttrOpcode,
  EachOpcode,
  FlushElementOpcode,
  GetDynamicVarOpcode,
  GetFreeAsComponentHeadOpcode,
  GetFreeAsComponentOrHelperHeadOpcode,
  GetFreeAsComponentOrHelperHeadOrThisFallbackOpcode,
  GetFreeAsDeprecatedHelperHeadOrThisFallbackOpcode,
  GetFreeAsHelperHeadOpcode,
  GetFreeAsHelperHeadOrThisFallbackOpcode,
  GetFreeAsModifierHeadOpcode,
  GetLexicalSymbolOpcode,
  GetStrictKeywordOpcode,
  GetSymbolOpcode,
  HasBlockOpcode,
  HasBlockParamsOpcode,
  IfInlineOpcode,
  IfOpcode,
  InElementOpcode,
  InvokeComponentOpcode,
  LetOpcode,
  LogOpcode,
  ModifierOpcode,
  NotOpcode,
  OpenElementOpcode,
  OpenElementWithSplatOpcode,
  StaticArgOpcode,
  StaticAttrOpcode,
  StaticComponentAttrOpcode,
  StrictBlockOpcode,
  StrictModifierOpcode,
  TrustingAppendOpcode,
  TrustingComponentAttrOpcode,
  TrustingDynamicAttrOpcode,
  UndefinedOpcode,
  WithDynamicVarsOpcode,
  WithOpcode,
  YieldOpcode,
} from '@glimmer/interfaces';

export const WIRE_APPEND: AppendOpcode = 1;
export const WIRE_TRUSTING_APPEND: TrustingAppendOpcode = 2;
export const WIRE_COMMENT: CommentOpcode = 3;
export const WIRE_MODIFIER: ModifierOpcode = 4;
export const WIRE_STRICT_MODIFIER: StrictModifierOpcode = 5;
export const WIRE_BLOCK: BlockOpcode = 6;
export const WIRE_STRICT_BLOCK: StrictBlockOpcode = 7;
export const WIRE_COMPONENT: ComponentOpcode = 8;
export const WIRE_OPEN_ELEMENT: OpenElementOpcode = 10;
export const WIRE_OPEN_ELEMENT_WITH_SPLAT: OpenElementWithSplatOpcode = 11;
export const WIRE_FLUSH_ELEMENT: FlushElementOpcode = 12;
export const WIRE_CLOSE_ELEMENT: CloseElementOpcode = 13;
export const WIRE_STATIC_ATTR: StaticAttrOpcode = 14;
export const WIRE_DYNAMIC_ATTR: DynamicAttrOpcode = 15;
export const WIRE_COMPONENT_ATTR: ComponentAttrOpcode = 16;
export const WIRE_ATTR_SPLAT: AttrSplatOpcode = 17;
export const WIRE_YIELD: YieldOpcode = 18;
export const WIRE_DYNAMIC_ARG: DynamicArgOpcode = 20;
export const WIRE_STATIC_ARG: StaticArgOpcode = 21;
export const WIRE_TRUSTING_DYNAMIC_ATTR: TrustingDynamicAttrOpcode = 22;
export const WIRE_TRUSTING_COMPONENT_ATTR: TrustingComponentAttrOpcode = 23;
export const WIRE_STATIC_COMPONENT_ATTR: StaticComponentAttrOpcode = 24;
export const WIRE_DEBUGGER: DebuggerOpcode = 26;
export const WIRE_UNDEFINED: UndefinedOpcode = 27;
export const WIRE_CALL: CallOpcode = 28;
export const WIRE_CONCAT: ConcatOpcode = 29;
export const WIRE_GET_SYMBOL: GetSymbolOpcode = 30;
export const WIRE_GET_LEXICAL_SYMBOL: GetLexicalSymbolOpcode = 32;
export const WIRE_GET_STRICT_KEYWORD: GetStrictKeywordOpcode = 31;
export const WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OR_THIS_FALLBACK: GetFreeAsComponentOrHelperHeadOrThisFallbackOpcode = 34;
export const WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD: GetFreeAsComponentOrHelperHeadOpcode = 35;
export const WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK: GetFreeAsHelperHeadOrThisFallbackOpcode = 36;
export const WIRE_GET_FREE_AS_DEPRECATED_HELPER_HEAD_OR_THIS_FALLBACK: GetFreeAsDeprecatedHelperHeadOrThisFallbackOpcode = 99;
export const WIRE_GET_FREE_AS_HELPER_HEAD: GetFreeAsHelperHeadOpcode = 37;
export const WIRE_GET_FREE_AS_MODIFIER_HEAD: GetFreeAsModifierHeadOpcode = 38;
export const WIRE_GET_FREE_AS_COMPONENT_HEAD: GetFreeAsComponentHeadOpcode = 39;
export const WIRE_IN_ELEMENT: InElementOpcode = 40;
export const WIRE_IF: IfOpcode = 41;
export const WIRE_EACH: EachOpcode = 42;
export const WIRE_WITH: WithOpcode = 43;
export const WIRE_LET: LetOpcode = 44;
export const WIRE_WITH_DYNAMIC_VARS: WithDynamicVarsOpcode = 45;
export const WIRE_INVOKE_COMPONENT: InvokeComponentOpcode = 46;
export const WIRE_HAS_BLOCK: HasBlockOpcode = 48;
export const WIRE_HAS_BLOCK_PARAMS: HasBlockParamsOpcode = 49;
export const WIRE_CURRY: CurryOpcode = 50;
export const WIRE_NOT: NotOpcode = 51;
export const WIRE_IF_INLINE: IfInlineOpcode = 52;
export const WIRE_GET_DYNAMIC_VAR: GetDynamicVarOpcode = 53;
export const WIRE_LOG: LogOpcode = 54;
