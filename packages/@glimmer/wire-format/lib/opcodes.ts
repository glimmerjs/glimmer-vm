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
  AttrSplatOpcode,
  BeginCallDynamicOpcode,
  BeginCallOpcode,
  BlocksOpcode,
  CallDynamicHelperOpcode,
  CallDynamicValueOpcode,
  CallHelperOpcode,
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
  GetPropertyOpcode,
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
  PushArgsOpcode,
  PushConstantOpcode,
  PushImmediateOpcode,
  ResolveAsComponentCalleeOpcode,
  ResolveAsCurlyCalleeOpcode,
  ResolveAsHelperCalleeOpcode,
  ResolveAsModifierHeadOpcode,
  ResolvedModifierOpcode,
  StackExpressionOpcode,
  StaticArgOpcode,
  StaticAttrOpcode,
  StaticComponentAttrOpcode,
  TrustingComponentAttrOpcode,
  TrustingDynamicAttrOpcode,
  UndefinedOpcode,
  UnknownInvokeOpcode,
  WithDynamicVarsOpcode,
  YieldOpcode,
} from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';

export const EMPTY_ARGS_OPCODE = 0b000 satisfies EmptyArgsOpcode;
export const NAMED_ARGS_OPCODE = 0b010 satisfies NamedArgsOpcode;
export const POSITIONAL_ARGS_OPCODE = 0b100 satisfies PositionalArgsOpcode;
export const POSITIONAL_AND_NAMED_ARGS_OPCODE = 0b110 satisfies PositionalAndNamedArgsOpcode;
export const POSITIONAL_AND_BLOCKS_OPCODE = 0b101 satisfies PositionalAndBlocksOpcode;
export const NAMED_ARGS_AND_BLOCKS_OPCODE = 0b011 satisfies NamedArgsAndBlocksOpcode;
export const BLOCKS_OPCODE = 0b001 satisfies BlocksOpcode;
export const POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE =
  0b111 satisfies PositionalAndNamedArgsAndBlocksOpcode;

export const opcodes = {
  AppendValueCautiously: 1 satisfies AppendValueCautiouslyOpcode,
  AppendResolvedValueCautiously: 303 satisfies AppendResolvedValueCautiouslyOpcode,
  AppendStatic: 104 satisfies AppendStaticOpcode,
  AppendResolvedInvokableCautiously: 100 satisfies AppendResolvedInvokableCautiouslyOpcode,
  AppendInvokableCautiously: 300 satisfies AppendInvokableCautiouslyOpcode,
  AppendTrustedResolvedInvokable: 200 satisfies AppendTrustedResolvedInvokableOpcode,
  AppendTrustedInvokable: 301 satisfies AppendTrustedInvokableOpcode,

  InvokeDynamicComponent: 58 satisfies InvokeDynamicComponentOpcode,
  InvokeComponentKeyword: 46 satisfies InvokeComponentKeywordOpcode,
  InvokeResolvedComponent: 47 satisfies InvokeResolvedComponentOpcode,
  InvokeLexicalComponent: 55 satisfies InvokeLexicalComponentOpcode,
  InvokeDynamicBlock: 57 satisfies InvokeDynamicBlockOpcode,

  AppendTrustedHtml: 4 satisfies AppendTrustedHtmlOpcode,
  AppendTrustedResolvedHtml: 302 satisfies AppendResolvedTrustedHtmlOpcode,
  AppendHtmlText: 106 satisfies AppendHtmlTextOpcode,
  Comment: 5 satisfies CommentOpcode,
  DynamicModifier: 6 satisfies DynamicModifierOpcode,
  LexicalModifier: 7 satisfies LexicalModifierOpcode,
  ResolvedModifier: 56 satisfies ResolvedModifierOpcode,
  OpenElement: 11 satisfies OpenElementOpcode,
  OpenElementWithSplat: 12 satisfies OpenElementWithSplatOpcode,
  FlushElement: 13 satisfies FlushElementOpcode,
  CloseElement: 14 satisfies CloseElementOpcode,
  StaticAttr: 15 satisfies StaticAttrOpcode,
  DynamicAttr: 16 satisfies DynamicAttrOpcode,
  ComponentAttr: 17 satisfies ComponentAttrOpcode,
  AttrSplat: 18 satisfies AttrSplatOpcode,
  Yield: 19 satisfies YieldOpcode,
  DynamicArg: 20 satisfies DynamicArgOpcode,
  StaticArg: 21 satisfies StaticArgOpcode,
  TrustingDynamicAttr: 22 satisfies TrustingDynamicAttrOpcode,
  TrustingComponentAttr: 23 satisfies TrustingComponentAttrOpcode,
  StaticComponentAttr: 24 satisfies StaticComponentAttrOpcode,
  Debugger: 26 satisfies DebuggerOpcode,
  Undefined: 27 satisfies UndefinedOpcode,
  CallResolved: 28 satisfies CallResolvedOpcode,
  CallDynamicValue: 29 satisfies CallDynamicValueOpcode,
  UnknownInvoke: 30 satisfies UnknownInvokeOpcode,
  Concat: 31 satisfies ConcatOpcode,
  GetPath: 107 satisfies GetPathOpcode,
  GetLocalSymbol: 32 satisfies GetLocalSymbolOpcode,
  GetLexicalSymbol: 33 satisfies GetLexicalSymbolOpcode,
  GetKeyword: 34 satisfies GetKeywordOpcode,
  ResolveAsCurlyCallee: 35 satisfies ResolveAsCurlyCalleeOpcode,
  ResolveAsHelperCallee: 37 satisfies ResolveAsHelperCalleeOpcode,
  ResolveAsModifierCallee: 38 satisfies ResolveAsModifierHeadOpcode,
  ResolveAsComponentCallee: 39 satisfies ResolveAsComponentCalleeOpcode,
  InElement: 40 satisfies InElementOpcode,
  If: 41 satisfies IfOpcode,
  Each: 42 satisfies EachOpcode,
  Let: 44 satisfies LetOpcode,
  WithDynamicVars: 45 satisfies WithDynamicVarsOpcode,
  HasBlock: 48 satisfies HasBlockOpcode,
  HasBlockParams: 49 satisfies HasBlockParamsOpcode,
  Curry: 50 satisfies CurryOpcode,
  Not: 51 satisfies NotOpcode,
  IfInline: 52 satisfies IfInlineOpcode,
  GetDynamicVar: 53 satisfies GetDynamicVarOpcode,
  Log: 54 satisfies LogOpcode,

  // Flat expression opcodes for wire format flattening
  GetProperty: 108 satisfies GetPropertyOpcode,
  StackExpression: 109 satisfies StackExpressionOpcode,
  PushImmediate: 110 satisfies PushImmediateOpcode,
  PushConstant: 111 satisfies PushConstantOpcode,
  PushArgs: 112 satisfies PushArgsOpcode,
  CallHelper: 113 satisfies CallHelperOpcode,
  CallDynamicHelper: 114 satisfies CallDynamicHelperOpcode,
  BeginCall: 115 satisfies BeginCallOpcode,
  BeginCallDynamic: 116 satisfies BeginCallDynamicOpcode,
} as const;

// Export individual flat expression opcodes for easy access
export const Op = opcodes;

if (LOCAL_DEBUG) {
  const seen = new Map<number, string>();

  for (const [name, opcode] of Object.entries(opcodes)) {
    if (seen.has(opcode)) {
      throw new Error(
        `Duplicate opcode: ${opcode} is registered as both ${seen.get(opcode)} and ${name}`
      );
    } else {
      seen.set(opcode, name);
    }
  }
}
