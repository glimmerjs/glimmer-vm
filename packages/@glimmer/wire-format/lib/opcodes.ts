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
  GetFreeAsHelperHeadOpcode,
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
  YieldOpcode,
} from '@glimmer/interfaces';

export const WF_APPEND_OPCODE: AppendOpcode = 1;
export const WF_TRUSTING_APPEND_OPCODE: TrustingAppendOpcode = 2;
export const WF_COMMENT_OPCODE: CommentOpcode = 3;
export const WF_MODIFIER_OPCODE: ModifierOpcode = 4;
export const WF_STRICT_MODIFIER_OPCODE: StrictModifierOpcode = 5;
export const WF_BLOCK_OPCODE: BlockOpcode = 6;
export const WF_STRICT_BLOCK_OPCODE: StrictBlockOpcode = 7;
export const WF_COMPONENT_OPCODE: ComponentOpcode = 8;
export const WF_OPEN_ELEMENT_OPCODE: OpenElementOpcode = 10;
export const WF_OPEN_ELEMENT_WITH_SPLAT_OPCODE: OpenElementWithSplatOpcode = 11;
export const WF_FLUSH_ELEMENT_OPCODE: FlushElementOpcode = 12;
export const WF_CLOSE_ELEMENT_OPCODE: CloseElementOpcode = 13;
export const WF_STATIC_ATTR_OPCODE: StaticAttrOpcode = 14;
export const WF_DYNAMIC_ATTR_OPCODE: DynamicAttrOpcode = 15;
export const WF_COMPONENT_ATTR_OPCODE: ComponentAttrOpcode = 16;
export const WF_ATTR_SPLAT_OPCODE: AttrSplatOpcode = 17;
export const WF_YIELD_OPCODE: YieldOpcode = 18;
export const WF_DYNAMIC_ARG_OPCODE: DynamicArgOpcode = 20;
export const WF_STATIC_ARG_OPCODE: StaticArgOpcode = 21;
export const WF_TRUSTING_DYNAMIC_ATTR_OPCODE: TrustingDynamicAttrOpcode = 22;
export const WF_TRUSTING_COMPONENT_ATTR_OPCODE: TrustingComponentAttrOpcode = 23;
export const WF_STATIC_COMPONENT_ATTR_OPCODE: StaticComponentAttrOpcode = 24;
export const WF_DEBUGGER_OPCODE: DebuggerOpcode = 26;
export const WF_UNDEFINED_OPCODE: UndefinedOpcode = 27;
export const WF_CALL_OPCODE: CallOpcode = 28;
export const WF_CONCAT_OPCODE: ConcatOpcode = 29;
export const WF_GET_SYMBOL_OPCODE: GetSymbolOpcode = 30;
export const WF_GET_LEXICAL_SYMBOL_OPCODE: GetLexicalSymbolOpcode = 32;
export const WF_GET_STRICT_KEYWORD_OPCODE: GetStrictKeywordOpcode = 31;
export const WF_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OPCODE: GetFreeAsComponentOrHelperHeadOpcode = 35;
export const WF_GET_FREE_AS_HELPER_HEAD_OPCODE: GetFreeAsHelperHeadOpcode = 37;
export const WF_GET_FREE_AS_MODIFIER_HEAD_OPCODE: GetFreeAsModifierHeadOpcode = 38;
export const WF_GET_FREE_AS_COMPONENT_HEAD_OPCODE: GetFreeAsComponentHeadOpcode = 39;
export const WF_IN_ELEMENT_OPCODE: InElementOpcode = 40;
export const WF_IF_OPCODE: IfOpcode = 41;
export const WF_EACH_OPCODE: EachOpcode = 42;
export const WF_LET_OPCODE: LetOpcode = 44;
export const WF_WITH_DYNAMIC_VARS_OPCODE: WithDynamicVarsOpcode = 45;
export const WF_INVOKE_COMPONENT_OPCODE: InvokeComponentOpcode = 46;
export const WF_HAS_BLOCK_OPCODE: HasBlockOpcode = 48;
export const WF_HAS_BLOCK_PARAMS_OPCODE: HasBlockParamsOpcode = 49;
export const WF_CURRY_OPCODE: CurryOpcode = 50;
export const WF_NOT_OPCODE: NotOpcode = 51;
export const WF_IF_INLINE_OPCODE: IfInlineOpcode = 52;
export const WF_GET_DYNAMIC_VAR_OPCODE: GetDynamicVarOpcode = 53;
export const WF_LOG_OPCODE: LogOpcode = 54;
