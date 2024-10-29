/* This file is generated by build/debug.js */

import type { Nullable, VmMachineOp, VmOp } from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { MachineOp, Op } from '@glimmer/vm';

import type { NormalizedMetadata } from './metadata';

export function opcodeMetadata(
  op: VmMachineOp | VmOp,
  isMachine: 0 | 1
): Nullable<NormalizedMetadata> {
  if (!LOCAL_DEBUG) {
    return null;
  }

  let value = isMachine ? MACHINE_METADATA[op] : METADATA[op];

  return value || null;
}

const METADATA: Nullable<NormalizedMetadata>[] = new Array(Op.Size).fill(null);
const MACHINE_METADATA: Nullable<NormalizedMetadata>[] = new Array(Op.Size).fill(null);

if (LOCAL_DEBUG) {
  MACHINE_METADATA[MachineOp.PushFrame] = {
    name: 'PushFrame',
    mnemonic: 'pushf',
    stackChange: 2,
    ops: [],
    check: true,
  };

  MACHINE_METADATA[MachineOp.PopFrame] = {
    name: 'PopFrame',
    mnemonic: 'popf',
    stackChange: -2,
    ops: [],
    check: false,
  };

  MACHINE_METADATA[MachineOp.InvokeVirtual] = {
    name: 'InvokeVirtual',
    mnemonic: 'vcall',
    stackChange: -1,
    ops: [],
    check: true,
  };

  MACHINE_METADATA[MachineOp.InvokeStatic] = {
    name: 'InvokeStatic',
    mnemonic: 'scall',
    stackChange: 0,
    ops: [
      {
        name: 'offset',
        type: 'inline:u32',
      },
    ],
    check: true,
  };

  MACHINE_METADATA[MachineOp.Jump] = {
    name: 'Jump',
    mnemonic: 'goto',
    stackChange: 0,
    ops: [
      {
        name: 'to',
        type: 'inline:relative-pc',
      },
    ],
    check: true,
  };

  MACHINE_METADATA[MachineOp.Return] = {
    name: 'Return',
    mnemonic: 'ret',
    stackChange: 0,
    ops: [],
    check: false,
  };

  MACHINE_METADATA[MachineOp.ReturnTo] = {
    name: 'ReturnTo',
    mnemonic: 'setra',
    stackChange: 0,
    ops: [
      {
        name: 'offset',
        type: 'inline:relative-pc',
      },
    ],
    check: true,
  };
  METADATA[Op.Helper] = {
    name: 'Helper',
    mnemonic: 'ncall',
    stackChange: null,
    ops: [
      {
        name: 'helper',
        type: 'const:helper',
      },
    ],
    check: true,
  };

  METADATA[Op.DynamicHelper] = {
    name: 'DynamicHelper',
    mnemonic: 'dynamiccall',
    stackChange: null,
    ops: [],
    check: true,
  };

  METADATA[Op.SetNamedVariables] = {
    name: 'SetNamedVariables',
    mnemonic: 'vsargs',
    stackChange: 0,
    ops: [
      {
        name: 'register',
        type: 'register:saved',
      },
    ],
    check: true,
  };

  METADATA[Op.SetBlocks] = {
    name: 'SetBlocks',
    mnemonic: 'vbblocks',
    stackChange: 0,
    ops: [
      {
        name: 'register:saved',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.SetVariable] = {
    name: 'SetVariable',
    mnemonic: 'sbvar',
    stackChange: -1,
    ops: [
      {
        name: 'symbol',
        type: 'symbol',
      },
    ],
    check: true,
  };

  METADATA[Op.SetBlock] = {
    name: 'SetBlock',
    mnemonic: 'sblock',
    stackChange: -3,
    ops: [
      {
        name: 'symbol',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.GetVariable] = {
    name: 'GetVariable',
    mnemonic: 'symload',
    stackChange: 1,
    ops: [
      {
        name: 'symbol',
        type: 'symbol',
      },
    ],
    check: true,
  };

  METADATA[Op.GetProperty] = {
    name: 'GetProperty',
    mnemonic: 'getprop',
    stackChange: 0,
    ops: [
      {
        name: 'property',
        type: 'str',
      },
    ],
    check: true,
  };

  METADATA[Op.GetBlock] = {
    name: 'GetBlock',
    mnemonic: 'blockload',
    stackChange: 1,
    ops: [
      {
        name: 'block',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.SpreadBlock] = {
    name: 'SpreadBlock',
    mnemonic: 'blockspread',
    stackChange: 2,
    ops: [],
    check: true,
  };

  METADATA[Op.HasBlock] = {
    name: 'HasBlock',
    mnemonic: 'hasblockload',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.HasBlockParams] = {
    name: 'HasBlockParams',
    mnemonic: 'hasparamsload',
    stackChange: -2,
    ops: [],
    check: true,
  };

  METADATA[Op.Concat] = {
    name: 'Concat',
    mnemonic: 'concat',
    stackChange: null,
    ops: [
      {
        name: 'count',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.IfInline] = {
    name: 'IfInline',
    mnemonic: 'ifinline',
    stackChange: -2,
    ops: [
      {
        name: 'count',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.Not] = {
    name: 'Not',
    mnemonic: 'not',
    stackChange: 0,
    ops: [
      {
        name: 'count',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.Constant] = {
    name: 'Constant',
    mnemonic: 'rconstload',
    stackChange: 1,
    ops: [
      {
        name: 'constant',
        type: 'unknown',
      },
    ],
    check: true,
  };

  METADATA[Op.ConstantReference] = {
    name: 'ConstantReference',
    mnemonic: 'rconstrefload',
    stackChange: 1,
    ops: [
      {
        name: 'constant',
        type: 'unknown',
      },
    ],
    check: true,
  };

  METADATA[Op.Primitive] = {
    name: 'Primitive',
    mnemonic: 'pconstload',
    stackChange: 1,
    ops: [
      {
        name: 'constant',
        type: 'primitive',
      },
    ],
    check: true,
  };

  METADATA[Op.PrimitiveReference] = {
    name: 'PrimitiveReference',
    mnemonic: 'ptoref',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.ReifyU32] = {
    name: 'ReifyU32',
    mnemonic: 'reifyload',
    stackChange: 1,
    ops: [],
    check: true,
  };

  METADATA[Op.Dup] = {
    name: 'Dup',
    mnemonic: 'dup',
    stackChange: 1,
    ops: [
      {
        name: 'register',
        type: 'u32',
      },
      {
        name: 'offset',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.Pop] = {
    name: 'Pop',
    mnemonic: 'pop',
    stackChange: 0,
    ops: [
      {
        name: 'count',
        type: 'u32',
      },
    ],
    check: false,
  };

  METADATA[Op.Load] = {
    name: 'Load',
    mnemonic: 'put',
    stackChange: -1,
    ops: [
      {
        name: 'register',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.Fetch] = {
    name: 'Fetch',
    mnemonic: 'regload',
    stackChange: 1,
    ops: [
      {
        name: 'register',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.RootScope] = {
    name: 'RootScope',
    mnemonic: 'rscopepush',
    stackChange: 0,
    ops: [
      {
        name: 'symbols',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.VirtualRootScope] = {
    name: 'VirtualRootScope',
    mnemonic: 'vrscopepush',
    stackChange: 0,
    ops: [
      {
        name: 'register',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.ChildScope] = {
    name: 'ChildScope',
    mnemonic: 'cscopepush',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.PopScope] = {
    name: 'PopScope',
    mnemonic: 'scopepop',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.Text] = {
    name: 'Text',
    mnemonic: 'apnd_text',
    stackChange: 0,
    ops: [
      {
        name: 'contents',
        type: 'str',
      },
    ],
    check: true,
  };

  METADATA[Op.Comment] = {
    name: 'Comment',
    mnemonic: 'apnd_comment',
    stackChange: 0,
    ops: [
      {
        name: 'contents',
        type: 'str',
      },
    ],
    check: true,
  };

  METADATA[Op.AppendHTML] = {
    name: 'AppendHTML',
    mnemonic: 'apnd_dynhtml',
    stackChange: -1,
    ops: [],
    check: true,
  };

  METADATA[Op.AppendSafeHTML] = {
    name: 'AppendSafeHTML',
    mnemonic: 'apnd_dynshtml',
    stackChange: -1,
    ops: [],
    check: true,
  };

  METADATA[Op.AppendDocumentFragment] = {
    name: 'AppendDocumentFragment',
    mnemonic: 'apnd_dynfrag',
    stackChange: -1,
    ops: [],
    check: true,
  };

  METADATA[Op.AppendNode] = {
    name: 'AppendNode',
    mnemonic: 'apnd_dynnode',
    stackChange: -1,
    ops: [],
    check: true,
  };

  METADATA[Op.AppendText] = {
    name: 'AppendText',
    mnemonic: 'apnd_dyntext',
    stackChange: -1,
    ops: [],
    check: true,
  };

  METADATA[Op.OpenElement] = {
    name: 'OpenElement',
    mnemonic: 'apnd_tag',
    stackChange: 0,
    ops: [
      {
        name: 'tag',
        type: 'str',
      },
    ],
    check: true,
  };

  METADATA[Op.OpenDynamicElement] = {
    name: 'OpenDynamicElement',
    mnemonic: 'apnd_dyntag',
    stackChange: -1,
    ops: [],
    check: true,
  };

  METADATA[Op.PushRemoteElement] = {
    name: 'PushRemoteElement',
    mnemonic: 'apnd_remotetag',
    stackChange: -3,
    ops: [],
    check: true,
  };

  METADATA[Op.StaticAttr] = {
    name: 'StaticAttr',
    mnemonic: 'apnd_attr',
    stackChange: 0,
    ops: [
      {
        name: 'name',
        type: 'str',
      },
      {
        name: 'value',
        type: 'str',
      },
      {
        name: 'namespace',
        type: 'option-str',
      },
    ],
    check: true,
  };

  METADATA[Op.DynamicAttr] = {
    name: 'DynamicAttr',
    mnemonic: 'apnd_dynattr',
    stackChange: -1,
    ops: [
      {
        name: 'name',
        type: 'str',
      },
      {
        name: 'trusting',
        type: 'bool',
      },
      {
        name: 'namespace',
        type: 'option-str',
      },
    ],
    check: true,
  };

  METADATA[Op.ComponentAttr] = {
    name: 'ComponentAttr',
    mnemonic: 'apnd_cattr',
    stackChange: -1,
    ops: [
      {
        name: 'name',
        type: 'str',
      },
      {
        name: 'trusting',
        type: 'bool',
      },
      {
        name: 'namespace',
        type: 'option-str',
      },
    ],
    check: true,
  };

  METADATA[Op.FlushElement] = {
    name: 'FlushElement',
    mnemonic: 'apnd_flushtag',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.CloseElement] = {
    name: 'CloseElement',
    mnemonic: 'apnd_closetag',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.PopRemoteElement] = {
    name: 'PopRemoteElement',
    mnemonic: 'apnd_closeremotetag',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.Modifier] = {
    name: 'Modifier',
    mnemonic: 'apnd_modifier',
    stackChange: -1,
    ops: [
      {
        name: 'helper',
        type: 'handle',
      },
    ],
    check: true,
  };

  METADATA[Op.BindDynamicScope] = {
    name: 'BindDynamicScope',
    mnemonic: 'setdynscope',
    stackChange: null,
    ops: [
      {
        name: 'names',
        type: 'str-array',
      },
    ],
    check: true,
  };

  METADATA[Op.PushDynamicScope] = {
    name: 'PushDynamicScope',
    mnemonic: 'dynscopepush',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.PopDynamicScope] = {
    name: 'PopDynamicScope',
    mnemonic: 'dynscopepop',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.CompileBlock] = {
    name: 'CompileBlock',
    mnemonic: 'cmpblock',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.PushBlockScope] = {
    name: 'PushBlockScope',
    mnemonic: 'scopeload',
    stackChange: 1,
    ops: [
      {
        name: 'scope',
        type: 'scope',
      },
    ],
    check: true,
  };

  METADATA[Op.PushSymbolTable] = {
    name: 'PushSymbolTable',
    mnemonic: 'dsymload',
    stackChange: 1,
    ops: [
      {
        name: 'table',
        type: 'symbol-table',
      },
    ],
    check: true,
  };

  METADATA[Op.InvokeYield] = {
    name: 'InvokeYield',
    mnemonic: 'invokeyield',
    stackChange: null,
    ops: [],
    check: true,
  };

  METADATA[Op.JumpIf] = {
    name: 'JumpIf',
    mnemonic: 'iftrue',
    stackChange: -1,
    ops: [
      {
        name: 'to',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.JumpUnless] = {
    name: 'JumpUnless',
    mnemonic: 'iffalse',
    stackChange: -1,
    ops: [
      {
        name: 'to',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.JumpEq] = {
    name: 'JumpEq',
    mnemonic: 'ifeq',
    stackChange: 0,
    ops: [
      {
        name: 'to',
        type: 'i32',
      },
      {
        name: 'comparison',
        type: 'i32',
      },
    ],
    check: true,
  };

  METADATA[Op.AssertSame] = {
    name: 'AssertSame',
    mnemonic: 'assert_eq',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.Enter] = {
    name: 'Enter',
    mnemonic: 'blk_start',
    stackChange: 0,
    ops: [
      {
        name: 'args',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.Exit] = {
    name: 'Exit',
    mnemonic: 'blk_end',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.ToBoolean] = {
    name: 'ToBoolean',
    mnemonic: 'anytobool',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.EnterList] = {
    name: 'EnterList',
    mnemonic: 'list_start',
    stackChange: null,
    ops: [
      {
        name: 'address',
        type: 'u32',
      },
      {
        name: 'address',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.ExitList] = {
    name: 'ExitList',
    mnemonic: 'list_end',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.Iterate] = {
    name: 'Iterate',
    mnemonic: 'iter',
    stackChange: 0,
    ops: [
      {
        name: 'end',
        type: 'u32',
      },
    ],
    check: false,
  };

  METADATA[Op.Main] = {
    name: 'Main',
    mnemonic: 'main',
    stackChange: -2,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.ContentType] = {
    name: 'ContentType',
    mnemonic: 'ctload',
    stackChange: 1,
    ops: [],
    check: true,
  };

  METADATA[Op.ResolveCurriedComponent] = {
    name: 'ResolveCurriedComponent',
    mnemonic: 'rslvcc',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.StaticComponentAttr] = {
    name: 'StaticComponentAttr',
    mnemonic: 'scattr',
    stackChange: 0,
    ops: [
      {
        name: 'name',
        type: 'str',
      },
      {
        name: 'value',
        type: 'str',
      },
      {
        name: 'namespace',
        type: 'option-str',
      },
    ],
    check: true,
  };

  METADATA[Op.DynamicContentType] = {
    name: 'DynamicContentType',
    mnemonic: 'dctload',
    stackChange: 1,
    ops: [],
    check: true,
  };

  METADATA[Op.DynamicHelper] = {
    name: 'DynamicHelper',
    mnemonic: 'dhload',
    stackChange: -2,
    ops: [],
    check: true,
  };

  METADATA[Op.DynamicModifier] = {
    name: 'DynamicModifier',
    mnemonic: 'dmload',
    stackChange: -2,
    ops: [],
    check: true,
  };

  METADATA[Op.Curry] = {
    name: 'Curry',
    mnemonic: 'curry',
    stackChange: null,
    ops: [
      {
        name: 'type',
        type: 'u32',
      },
      {
        name: 'is-strict',
        type: 'bool',
      },
    ],
    check: true,
  };

  METADATA[Op.PushComponentDefinition] = {
    name: 'PushComponentDefinition',
    mnemonic: 'cmload',
    stackChange: 1,
    ops: [
      {
        name: 'spec',
        type: 'handle',
      },
    ],
    check: true,
  };

  METADATA[Op.PushDynamicComponentInstance] = {
    name: 'PushDynamicComponentInstance',
    mnemonic: 'dciload',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.ResolveDynamicComponent] = {
    name: 'ResolveDynamicComponent',
    mnemonic: 'cdload',
    stackChange: 0,
    ops: [
      {
        name: 'owner',
        type: 'owner',
      },
    ],
    check: true,
  };

  METADATA[Op.PushArgs] = {
    name: 'PushArgs',
    mnemonic: 'argsload',
    stackChange: null,
    ops: [
      {
        name: 'names',
        type: 'str-array',
      },
      {
        name: 'block-names',
        type: 'str-array',
      },
      {
        name: 'flags',
        type: 'u32',
      },
    ],
    check: true,
  };

  METADATA[Op.PushEmptyArgs] = {
    name: 'PushEmptyArgs',
    mnemonic: 'emptyargsload',
    stackChange: 1,
    ops: [],
    check: true,
  };

  METADATA[Op.PopArgs] = {
    name: 'PopArgs',
    mnemonic: 'argspop',
    stackChange: null,
    ops: [],
    check: true,
  };

  METADATA[Op.PrepareArgs] = {
    name: 'PrepareArgs',
    mnemonic: 'argsprep',
    stackChange: 0,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: false,
  };

  METADATA[Op.CaptureArgs] = {
    name: 'CaptureArgs',
    mnemonic: 'argscapture',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.CreateComponent] = {
    name: 'CreateComponent',
    mnemonic: 'comp_create',
    stackChange: 0,
    ops: [
      {
        name: 'flags',
        type: 'u32',
      },
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.RegisterComponentDestructor] = {
    name: 'RegisterComponentDestructor',
    mnemonic: 'comp_dest',
    stackChange: 0,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.PutComponentOperations] = {
    name: 'PutComponentOperations',
    mnemonic: 'comp_elops',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.GetComponentSelf] = {
    name: 'GetComponentSelf',
    mnemonic: 'comp_selfload',
    stackChange: 1,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.GetComponentTagName] = {
    name: 'GetComponentTagName',
    mnemonic: 'comp_tagload',
    stackChange: 1,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.GetComponentLayout] = {
    name: 'GetComponentLayout',
    mnemonic: 'comp_layoutload',
    stackChange: 2,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.BindEvalScope] = {
    name: 'BindEvalScope',
    mnemonic: 'eval_scope',
    stackChange: 0,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.SetupForEval] = {
    name: 'SetupForEval',
    mnemonic: 'eval_setup',
    stackChange: 0,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.PopulateLayout] = {
    name: 'PopulateLayout',
    mnemonic: 'comp_layoutput',
    stackChange: -2,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.InvokeComponentLayout] = {
    name: 'InvokeComponentLayout',
    mnemonic: 'comp_invokelayout',
    stackChange: 0,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.BeginComponentTransaction] = {
    name: 'BeginComponentTransaction',
    mnemonic: 'comp_begin',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.CommitComponentTransaction] = {
    name: 'CommitComponentTransaction',
    mnemonic: 'comp_commit',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.DidCreateElement] = {
    name: 'DidCreateElement',
    mnemonic: 'comp_created',
    stackChange: 0,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.DidRenderLayout] = {
    name: 'DidRenderLayout',
    mnemonic: 'comp_rendered',
    stackChange: 0,
    ops: [
      {
        name: 'state',
        type: 'register',
      },
    ],
    check: true,
  };

  METADATA[Op.ResolveMaybeLocal] = {
    name: 'ResolveMaybeLocal',
    mnemonic: 'eval_varload',
    stackChange: 1,
    ops: [
      {
        name: 'local',
        type: 'str',
      },
    ],
    check: true,
  };

  METADATA[Op.Debugger] = {
    name: 'Debugger',
    mnemonic: 'debugger',
    stackChange: 0,
    ops: [
      {
        name: 'symbols',
        type: 'str-array',
      },
      {
        name: 'debugInfo',
        type: 'array',
      },
    ],
    check: true,
  };

  METADATA[Op.GetDynamicVar] = {
    name: 'GetDynamicVar',
    mnemonic: 'rslvdvar',
    stackChange: 0,
    ops: [],
    check: true,
  };

  METADATA[Op.Log] = {
    name: 'Log',
    mnemonic: 'log',
    stackChange: -1,
    ops: [],
    check: true,
  };
}
