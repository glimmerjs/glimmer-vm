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

export const opcodes: {
  readonly Append: AppendOpcode;
  readonly TrustingAppend: TrustingAppendOpcode;
  readonly Comment: CommentOpcode;
  readonly Modifier: ModifierOpcode;
  readonly StrictModifier: StrictModifierOpcode;
  readonly Block: BlockOpcode;
  readonly StrictBlock: StrictBlockOpcode;
  readonly Component: ComponentOpcode;
  readonly OpenElement: OpenElementOpcode;
  readonly OpenElementWithSplat: OpenElementWithSplatOpcode;
  readonly FlushElement: FlushElementOpcode;
  readonly CloseElement: CloseElementOpcode;
  readonly StaticAttr: StaticAttrOpcode;
  readonly DynamicAttr: DynamicAttrOpcode;
  readonly ComponentAttr: ComponentAttrOpcode;
  readonly AttrSplat: AttrSplatOpcode;
  readonly Yield: YieldOpcode;
  readonly DynamicArg: DynamicArgOpcode;
  readonly StaticArg: StaticArgOpcode;
  readonly TrustingDynamicAttr: TrustingDynamicAttrOpcode;
  readonly TrustingComponentAttr: TrustingComponentAttrOpcode;
  readonly StaticComponentAttr: StaticComponentAttrOpcode;
  readonly Debugger: DebuggerOpcode;
  readonly Undefined: UndefinedOpcode;
  readonly Call: CallOpcode;
  readonly Concat: ConcatOpcode;
  readonly GetSymbol: GetSymbolOpcode;
  readonly GetLexicalSymbol: GetLexicalSymbolOpcode;
  readonly GetStrictKeyword: GetStrictKeywordOpcode;
  readonly GetFreeAsComponentOrHelperHead: GetFreeAsComponentOrHelperHeadOpcode;
  readonly GetFreeAsHelperHead: GetFreeAsHelperHeadOpcode;
  readonly GetFreeAsModifierHead: GetFreeAsModifierHeadOpcode;
  readonly GetFreeAsComponentHead: GetFreeAsComponentHeadOpcode;
  readonly InElement: InElementOpcode;
  readonly If: IfOpcode;
  readonly Each: EachOpcode;
  readonly Let: LetOpcode;
  readonly WithDynamicVars: WithDynamicVarsOpcode;
  readonly InvokeComponent: InvokeComponentOpcode;
  readonly HasBlock: HasBlockOpcode;
  readonly HasBlockParams: HasBlockParamsOpcode;
  readonly Curry: CurryOpcode;
  readonly Not: NotOpcode;
  readonly IfInline: IfInlineOpcode;
  readonly GetDynamicVar: GetDynamicVarOpcode;
  readonly Log: LogOpcode;
} = {
  Append: 1,
  TrustingAppend: 2,
  Comment: 3,
  Modifier: 4,
  StrictModifier: 5,
  Block: 6,
  StrictBlock: 7,
  Component: 8,
  OpenElement: 10,
  OpenElementWithSplat: 11,
  FlushElement: 12,
  CloseElement: 13,
  StaticAttr: 14,
  DynamicAttr: 15,
  ComponentAttr: 16,
  AttrSplat: 17,
  Yield: 18,
  DynamicArg: 20,
  StaticArg: 21,
  TrustingDynamicAttr: 22,
  TrustingComponentAttr: 23,
  StaticComponentAttr: 24,
  Debugger: 26,
  Undefined: 27,
  Call: 28,
  Concat: 29,
  GetSymbol: 30,
  GetLexicalSymbol: 32,
  GetStrictKeyword: 31,
  GetFreeAsComponentOrHelperHead: 35,
  GetFreeAsHelperHead: 37,
  GetFreeAsModifierHead: 38,
  GetFreeAsComponentHead: 39,
  InElement: 40,
  If: 41,
  Each: 42,
  Let: 44,
  WithDynamicVars: 45,
  InvokeComponent: 46,
  HasBlock: 48,
  HasBlockParams: 49,
  Curry: 50,
  Not: 51,
  IfInline: 52,
  GetDynamicVar: 53,
  Log: 54,
} as const;
