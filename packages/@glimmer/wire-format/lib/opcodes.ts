import type {
  AppendDynamicInvokableOpcode,
  AppendHtmlTextOpcode,
  AppendResolvedInvokableOpcode,
  AppendStaticOpcode,
  AppendTrustedHtmlOpcode,
  AppendValueCautiouslyOpcode,
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
  GetLexicalSymbolOpcode,
  GetLocalSymbolOpcode,
  GetPathOpcode,
  GetStrictKeywordOpcode,
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
  ResolveAsAppendableCalleeOpcode,
  ResolveAsComponentCalleeOpcode,
  ResolveAsHelperCalleeOpcode,
  ResolveAsModifierHeadOpcode,
  ResolvedModifierOpcode,
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
  AppendStatic: 104 satisfies AppendStaticOpcode,
  AppendResolvedInvokable: 100 satisfies AppendResolvedInvokableOpcode,
  AppendDynamicInvokable: 103 satisfies AppendDynamicInvokableOpcode,

  InvokeDynamicComponent: 58 satisfies InvokeDynamicComponentOpcode,
  InvokeComponentKeyword: 46 satisfies InvokeComponentKeywordOpcode,
  InvokeResolvedComponent: 47 satisfies InvokeResolvedComponentOpcode,
  InvokeLexicalComponent: 55 satisfies InvokeLexicalComponentOpcode,
  InvokeDynamicBlock: 57 satisfies InvokeDynamicBlockOpcode,

  AppendTrustedHtml: 4 satisfies AppendTrustedHtmlOpcode,
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
  GetStrictKeyword: 34 satisfies GetStrictKeywordOpcode,
  ResolveAsAppendableCallee: 35 satisfies ResolveAsAppendableCalleeOpcode,
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
} as const;

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
