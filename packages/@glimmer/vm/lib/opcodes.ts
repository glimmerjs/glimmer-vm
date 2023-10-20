import type {
  VmMachineOp,
  VmMachineOpMap,
  VmMachineOpName,
  VmOp,
  VmOpMap,
  VmOpName,
} from '@glimmer/interfaces';
import { array } from '@glimmer/util';
import type { FixedArray } from '@glimmer/util';

export const MachineOpNames = [
  'PushFrame',
  'PopFrame',
  'InvokeVirtual',
  'InvokeStatic',
  'Jump',
  'Return',
  'ReturnTo',
  'PushTryFrame',
  'PopTryFrame',
  'UnwindTypeFrame',
] as const satisfies readonly VmMachineOpName[];

export const MachineOpSize = MachineOpNames.length;

export const MachineOp = MachineOpNames.reduce(
  (acc, name, i) => {
    acc[name] = i;
    return acc;
  },
  {} as Record<VmMachineOpName, number>
) as VmMachineOpMap;

export const JustOpNames = [
  'Helper',
  'SetNamedVariables',
  'SetBlocks',
  'SetVariable',
  'SetBlock',
  'GetVariable',
  'GetProperty',
  'GetBlock',
  'SpreadBlock',
  'HasBlock',
  'HasBlockParams',
  'Concat',
  'Constant',
  'ConstantReference',
  'Primitive',
  'PrimitiveReference',
  'ReifyU32',
  'Dup',
  'Pop',
  'Load',
  'Fetch',
  'RootScope',
  'VirtualRootScope',
  'ChildScope',
  'PopScope',
  'Text',
  'Comment',
  'AppendHTML',
  'AppendSafeHTML',
  'AppendDocumentFragment',
  'AppendNode',
  'AppendText',
  'OpenElement',
  'OpenDynamicElement',
  'PushRemoteElement',
  'StaticAttr',
  'DynamicAttr',
  'ComponentAttr',
  'FlushElement',
  'CloseElement',
  'PopRemoteElement',
  'Modifier',
  'BindDynamicScope',
  'PushDynamicScope',
  'PopDynamicScope',
  'CompileBlock',
  'PushBlockScope',
  'PushSymbolTable',
  'InvokeYield',
  'JumpIf',
  'JumpUnless',
  'JumpEq',
  'AssertSame',
  'Enter',
  'Exit',
  'ToBoolean',
  'EnterList',
  'ExitList',
  'Iterate',
  'Main',
  'ContentType',
  'Curry',
  'PushComponentDefinition',
  'PushDynamicComponentInstance',
  'ResolveDynamicComponent',
  'ResolveCurriedComponent',
  'PushArgs',
  'PushEmptyArgs',
  'PopArgs',
  'PrepareArgs',
  'CaptureArgs',
  'CreateComponent',
  'RegisterComponentDestructor',
  'PutComponentOperations',
  'GetComponentSelf',
  'GetComponentTagName',
  'GetComponentLayout',
  'BindEvalScope',
  'SetupForEval',
  'PopulateLayout',
  'InvokeComponentLayout',
  'BeginComponentTransaction',
  'CommitComponentTransaction',
  'DidCreateElement',
  'DidRenderLayout',
  'ResolveMaybeLocal',
  'Debugger',
  'StaticComponentAttr',
  'DynamicContentType',
  'DynamicHelper',
  'DynamicModifier',
  'IfInline',
  'Not',
  'GetDynamicVar',
  'Log',
  'PushUnwindTarget',
] as const;

export const OpNames = [...array<null>().allocate(16), ...JustOpNames] as const satisfies readonly [
  ...FixedArray<null, 16>,
  ...VmOpName[],
];
export const OpSize = OpNames.length;

export const Op = JustOpNames.reduce(
  (acc, name, i) => {
    acc[name] = i + 16;
    return acc;
  },
  {} as Record<VmOpName, number>
) as VmOpMap;

export function isMachineOp(value: number): value is VmMachineOp {
  return value >= 0 && value <= 15;
}

export function isOp(value: number): value is VmOp {
  return value >= 16;
}
