import type { Nullable, VmMachineOp, VmOp } from '@glimmer/interfaces';
import type { JustOpNames, MachineOpNames } from '@glimmer/vm';
import { Op } from '@glimmer/vm';

import type { NormalizedMetadata } from './metadata';
import { MetadataBuilder, define, type NormalizedMetadataArray, UNCHANGED } from './utils';

function fillNulls<T>(count: number): T[] {
  let arr = new Array(count);

  for (let i = 0; i < count; i++) {
    arr[i] = null;
  }

  return arr;
}

export function opcodeMetadata(
  op: VmMachineOp | VmOp,
  isMachine: 0 | 1
): Nullable<NormalizedMetadata> {
  let value = isMachine ? MACHINE_METADATA[op] : METADATA[op];

  return value || null;
}

const MACHINE_METADATA: NormalizedMetadataArray<typeof MachineOpNames> = MetadataBuilder.machine(
  ({ add, stack }) =>
    add(`PushFrame as pushf`, stack(2))
      .add(`PopFrame as popf`, stack(-2))
      .add(`InvokeVirtual as vcall`, stack(-1))
      .add(`InvokeStatic as scall`, ['offset:u32'])
      .add(`Jump as goto`, ['to:u32'])
      .add(`Return as ret`)
      .add(`ReturnTo as setra`, ['offset:pc'])
      .add(`PushTryFrame as try`, ['catch:pc'])
      .add(`PopTryFrame as finally`)
      .add(`UnwindTypeFrame as unwind`)
);

const METADATA2: NormalizedMetadataArray<typeof JustOpNames> = MetadataBuilder.syscall(
  ({ add, stack }) =>
    add(`Helper as ncall`, [`helper:handle`])
      .add(`SetNamedVariables as vsargs`, [`register:register`])
      .add(`SetBlocks as vbblocks`, [`register:register`])
      .add(`SetVariable as sbvar`, [`symbol:variable`], stack(-1))
      .add(`SetBlock as sbblock`, [`symbol:variable`], stack(-3))
      .add(`GetVariable as symload`, [`symbol:variable`], stack(+1))

      .add(`GetProperty as replace<-prop`, [`property:const/str`])
      .add(`GetBlock as push<-scope`, [`block:variable`], stack(+1))
      .add(`SpreadBlock as push2<-block`, stack(+2))
      .add(`HasBlock as store<-hasblock`)
      .add(
        `HasBlockParams as pop2->hasparam`,
        stack.params(['block:block/handle', 'scope:scope', 'table:table?']),
        stack.returns(['bool'])
      )
      .add(
        `Concat as concat`,
        ['count:u32'],
        stack.dynamic(({ op1 }) => -op1)
      )
      .add(`Constant as rconstload`, ['constant:const/any'], stack(+1))
      .add(`ConstantReference as rconstrefload`, ['constant:const/any'], stack(+1))
      .add(`Primitive as pconstload`, ['constant:const/primitive'], stack(+1))
      .add(`PrimitiveReference as ptoref`, [])
      .add(`ReifyU32 as reifyload`, stack(+1))
      .add(`Dup as push_dup`, ['register:register', 'offset:u32'], stack(+1))
      .add(`Pop as pop`, ['count:u32'], stack(-1))
      .add(`Load as stack->store`, ['register:register'], stack(-1))
      .add(`Fetch as load->stack`, ['register:register'], stack(+1))
      .add(`RootScope as rscopepush`, ['size:u32'])
      .add(`VirtualRootScope as vrscopepush`, ['register:register'])
      .add(`ChildScope as cscopepush`, [])
      .add(`PopScope as popscope`)

      // apnd_* get the values from a register (and therefore leave the stack untouched)
      // apnd_dyn* get the values from the stack (and therefore decrement the stack)

      .add(`Text as apnd_text`, ['contents:const/str'])
      .add(`Comment as apend_comment`, ['contents:const/str'])
      .add(`AppendHTML as apnd_dynhtml`, stack(-1))
      .add(`AppendSafeHTML as apnd_dynshtml`, stack(-1))
      .add(`AppendDocumentFragment as apnd_dynfrag`, stack(-1))
      .add(`AppendNode as apnd_dynnode`, [], stack(-1))
      .add(`AppendText as apnd_dyntext`, [], stack(-1))
      .add(`OpenElement as apnd_tag`, ['tag:const/str'])
      .add(`OpenDynamicElement as apnd_dyntag`, [], stack(-1))
      .add(`PushRemoteElement as apnd_remotetag`, stack(-3))
      .add(`StaticAttr as apnd_attr`, ['name:const/str', 'value:const/str', 'namespace:const/str?'])
      .add(`DynamicAttr as apnd_dynattr`, ['name:const/str', 'value:const/str'])
      .add(`ComponentAttr as apnd_compattr`, ['name:const/str', 'value:const/str'])
      .add(`FlushElement as apnd_flush`, [])
      .add(`CloseElement as apnd_close`, [])
      .add(`PopRemoteElement as apnd_remoteclose`, [])
      // @audit what's this parameter?
      .add(`Modifier as apnd_modifier`, ['helper:const/fn'], stack(-1))
      .add(`BindDynamicScope as setdynscope`, ['names:const/array/str'])
      .add(`PushDynamicScope as dynscopepush`)
      .add(`PopDynamicScope as dynscopepop`)
      .add(
        `CompileBlock as cmpblock`,
        stack.params(['template:block/template']),
        stack.returns(['block/handle'])
      )
      .add(`PushBlockScope as push<-scope`, stack.params([]), stack.returns(['scope']))
      .add(`PushSymbolTable as push<-table`, stack.params([]), stack.returns(['table']))
      .add(
        `InvokeYield as invoke`,
        stack.params(['args:args', 'table:table/block', 'scope:scope', 'block:block/handle']),
        stack.returns(['register/instruction', 'register/stack', 'scope'])
      )
      .add(
        `JumpIf as pop->cgoto`,
        ['target:register/instruction'],
        stack.params(['condition:reference/bool']),
        stack.returns([])
      )
      .add(
        `JumpUnless as pop->cngoto`,
        ['target:register/instruction'],
        stack.params(['condition:reference/bool']),
        stack.returns([])
      )
      .add(
        `JumpEq as gotoeq`,
        ['target:register/instruction', 'comparison:i32'],
        stack.params(['other:i32']),
        stack.returns([UNCHANGED])
      )
      .add(
        `AssertSame as assert_eq`,
        stack.params(['reference:reference/any']),
        stack.returns([UNCHANGED])
      )
      .add(`Enter as enter1`)
      .add(`Exit as exit1`)
      .add(
        `ToBoolean as tobool(top)`,
        stack.params(['value:reference/any']),
        stack.returns(['reference/bool'])
      )
      .add(
        `EnterList as list/start`,
        ['start:instruction/relative', 'else:instruction/absolute'],
        stack.params(['list:reference/any', 'key:reference/fn']),
        // @todo find a way to characterize the difference (the stack only
        // changes if the iterate is non-empty)
        stack.dynamic()
      )
      .add(`ExitList as list/done`)
      .add(
        `Iterate as list/item`,
        ['breaks:instruction/absolute'],
        stack.params(['iterator:glimmer/iterator']),
        stack.returns([UNCHANGED])
      )
      .add(
        `Main as call/main`,
        ['register:register/syscall'],
        stack.params(['invocation:block/invocation', 'component:component/definition'])
        // @todo characterize loading into $s0
      )
      .add(
        `ContentType as push<-ctype`,
        stack.params(['value:reference/any']),
        stack.returns([UNCHANGED, 'i32/ctype'])
      )
);

const METADATA: Nullable<NormalizedMetadata>[] = fillNulls(Op.Size);

METADATA[Op.Helper] = {
  name: 'Helper',
  mnemonic: 'ncall',
  before: null,
  stackChange: null,
  ops: [
    {
      name: 'helper',
      type: 'handle',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.DynamicHelper] = {
  name: 'DynamicHelper',
  mnemonic: 'dynamiccall',
  before: null,
  stackChange: null,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.SetNamedVariables] = {
  name: 'SetNamedVariables',
  mnemonic: 'vsargs',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'register',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.SetBlocks] = {
  name: 'SetBlocks',
  mnemonic: 'vbblocks',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'register',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.SetVariable] = {
  name: 'SetVariable',
  mnemonic: 'sbvar',
  before: null,
  stackChange: -1,
  ops: [
    {
      name: 'symbol',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.SetBlock] = {
  name: 'SetBlock',
  mnemonic: 'sblock',
  before: null,
  stackChange: -3,
  ops: [
    {
      name: 'symbol',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.GetVariable] = {
  name: 'GetVariable',
  mnemonic: 'symload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'symbol',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.GetProperty] = {
  name: 'GetProperty',
  mnemonic: 'getprop',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'property',
      type: 'str',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.GetBlock] = {
  name: 'GetBlock',
  mnemonic: 'blockload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'block',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.SpreadBlock] = {
  name: 'SpreadBlock',
  mnemonic: 'blockspread',
  before: null,
  stackChange: 2,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.HasBlock] = {
  name: 'HasBlock',
  mnemonic: 'hasblockload',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.HasBlockParams] = {
  name: 'HasBlockParams',
  mnemonic: 'hasparamsload',
  before: null,
  stackChange: -2,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.Concat] = {
  name: 'Concat',
  mnemonic: 'concat',
  before: null,
  stackChange: null,
  ops: [
    {
      name: 'count',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.IfInline] = {
  name: 'IfInline',
  mnemonic: 'ifinline',
  before: null,
  stackChange: -2,
  ops: [
    {
      name: 'count',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.Not] = {
  name: 'Not',
  mnemonic: 'not',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'count',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.Constant] = {
  name: 'Constant',
  mnemonic: 'rconstload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'constant',
      type: 'unknown',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.ConstantReference] = {
  name: 'ConstantReference',
  mnemonic: 'rconstrefload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'constant',
      type: 'unknown',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.Primitive] = {
  name: 'Primitive',
  mnemonic: 'pconstload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'constant',
      type: 'primitive',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.PrimitiveReference] = {
  name: 'PrimitiveReference',
  mnemonic: 'ptoref',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.ReifyU32] = {
  name: 'ReifyU32',
  mnemonic: 'reifyload',
  before: null,
  stackChange: 1,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.Dup] = {
  name: 'Dup',
  mnemonic: 'dup',
  before: null,
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
  operands: 2,
  check: true,
};

METADATA[Op.Pop] = {
  name: 'Pop',
  mnemonic: 'pop',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'count',
      type: 'u32',
    },
  ],
  operands: 1,
  check: false,
};

METADATA[Op.Load] = {
  name: 'Load',
  mnemonic: 'put',
  before: null,
  stackChange: -1,
  ops: [
    {
      name: 'register',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.Fetch] = {
  name: 'Fetch',
  mnemonic: 'regload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'register',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.RootScope] = {
  name: 'RootScope',
  mnemonic: 'rscopepush',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'symbols',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.VirtualRootScope] = {
  name: 'VirtualRootScope',
  mnemonic: 'vrscopepush',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'register',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.ChildScope] = {
  name: 'ChildScope',
  mnemonic: 'cscopepush',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.PopScope] = {
  name: 'PopScope',
  mnemonic: 'scopepop',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.Text] = {
  name: 'Text',
  mnemonic: 'apnd_text',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'contents',
      type: 'str',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.Comment] = {
  name: 'Comment',
  mnemonic: 'apnd_comment',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'contents',
      type: 'str',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.AppendHTML] = {
  name: 'AppendHTML',
  mnemonic: 'apnd_dynhtml',
  before: null,
  stackChange: -1,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.AppendSafeHTML] = {
  name: 'AppendSafeHTML',
  mnemonic: 'apnd_dynshtml',
  before: null,
  stackChange: -1,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.AppendDocumentFragment] = {
  name: 'AppendDocumentFragment',
  mnemonic: 'apnd_dynfrag',
  before: null,
  stackChange: -1,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.AppendNode] = {
  name: 'AppendNode',
  mnemonic: 'apnd_dynnode',
  before: null,
  stackChange: -1,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.AppendText] = {
  name: 'AppendText',
  mnemonic: 'apnd_dyntext',
  before: null,
  stackChange: -1,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.OpenElement] = {
  name: 'OpenElement',
  mnemonic: 'apnd_tag',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'tag',
      type: 'str',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.OpenDynamicElement] = {
  name: 'OpenDynamicElement',
  mnemonic: 'apnd_dyntag',
  before: null,
  stackChange: -1,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.PushRemoteElement] = {
  name: 'PushRemoteElement',
  mnemonic: 'apnd_remotetag',
  before: null,
  stackChange: -3,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.StaticAttr] = {
  name: 'StaticAttr',
  mnemonic: 'apnd_attr',
  before: null,
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
  operands: 3,
  check: true,
};

METADATA[Op.DynamicAttr] = {
  name: 'DynamicAttr',
  mnemonic: 'apnd_dynattr',
  before: null,
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
  operands: 3,
  check: true,
};

METADATA[Op.ComponentAttr] = {
  name: 'ComponentAttr',
  mnemonic: 'apnd_cattr',
  before: null,
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
  operands: 3,
  check: true,
};

METADATA[Op.FlushElement] = {
  name: 'FlushElement',
  mnemonic: 'apnd_flushtag',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.CloseElement] = {
  name: 'CloseElement',
  mnemonic: 'apnd_closetag',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.PopRemoteElement] = {
  name: 'PopRemoteElement',
  mnemonic: 'apnd_closeremotetag',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.Modifier] = {
  name: 'Modifier',
  mnemonic: 'apnd_modifier',
  before: null,
  stackChange: -1,
  ops: [
    {
      name: 'helper',
      type: 'handle',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.BindDynamicScope] = {
  name: 'BindDynamicScope',
  mnemonic: 'setdynscope',
  before: null,
  stackChange: null,
  ops: [
    {
      name: 'names',
      type: 'str-array',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.PushDynamicScope] = {
  name: 'PushDynamicScope',
  mnemonic: 'dynscopepush',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.PopDynamicScope] = {
  name: 'PopDynamicScope',
  mnemonic: 'dynscopepop',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.CompileBlock] = {
  name: 'CompileBlock',
  mnemonic: 'cmpblock',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.PushBlockScope] = {
  name: 'PushBlockScope',
  mnemonic: 'scopeload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'scope',
      type: 'scope',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.PushSymbolTable] = {
  name: 'PushSymbolTable',
  mnemonic: 'dsymload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'table',
      type: 'symbol-table',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.InvokeYield] = {
  name: 'InvokeYield',
  mnemonic: 'invokeyield',
  before: null,
  stackChange: null,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.JumpIf] = {
  name: 'JumpIf',
  mnemonic: 'iftrue',
  before: null,
  stackChange: -1,
  ops: [
    {
      name: 'to',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.JumpUnless] = {
  name: 'JumpUnless',
  mnemonic: 'iffalse',
  before: null,
  stackChange: -1,
  ops: [
    {
      name: 'to',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.JumpEq] = {
  name: 'JumpEq',
  mnemonic: 'ifeq',
  before: null,
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
  operands: 2,
  check: true,
};

METADATA[Op.AssertSame] = {
  name: 'AssertSame',
  mnemonic: 'assert_eq',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.Enter] = {
  name: 'Enter',
  mnemonic: 'blk_start',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'args',
      type: 'u32',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.Exit] = {
  name: 'Exit',
  mnemonic: 'blk_end',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.ToBoolean] = {
  name: 'ToBoolean',
  mnemonic: 'anytobool',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.EnterList] = {
  name: 'EnterList',
  mnemonic: 'list_start',
  before: null,
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
  operands: 2,
  check: true,
};

METADATA[Op.ExitList] = {
  name: 'ExitList',
  mnemonic: 'list_end',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.Iterate] = {
  name: 'Iterate',
  mnemonic: 'iter',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'end',
      type: 'u32',
    },
  ],
  operands: 1,
  check: false,
};

METADATA[Op.Main] = {
  name: 'Main',
  mnemonic: 'main',
  before: null,
  stackChange: -2,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.ContentType] = {
  name: 'ContentType',
  mnemonic: 'ctload',
  before: null,
  stackChange: 1,
  ops: [],
  operands: 0,
  check: false,
};

METADATA[Op.DynamicContentType] = {
  name: 'DynamicContentType',
  mnemonic: 'dctload',
  before: null,
  stackChange: 1,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.Curry] = {
  name: 'Curry',
  mnemonic: 'curry',
  before: null,
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
  operands: 2,
  check: true,
};

METADATA[Op.PushComponentDefinition] = {
  name: 'PushComponentDefinition',
  mnemonic: 'cmload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'spec',
      type: 'handle',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.PushDynamicComponentInstance] = {
  name: 'PushDynamicComponentInstance',
  mnemonic: 'dciload',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.ResolveDynamicComponent] = {
  name: 'ResolveDynamicComponent',
  mnemonic: 'cdload',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'owner',
      type: 'owner',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.ResolveCurriedComponent] = {
  name: 'VmResolveCurriedComponent',
  mnemonic: 'vmcdload',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: false,
};

METADATA[Op.PushArgs] = {
  name: 'PushArgs',
  mnemonic: 'argsload',
  before: null,
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
  operands: 3,
  check: true,
};

METADATA[Op.PushEmptyArgs] = {
  name: 'PushEmptyArgs',
  mnemonic: 'emptyargsload',
  before: null,
  stackChange: 1,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.PopArgs] = {
  name: 'PopArgs',
  mnemonic: 'argspop',
  before: null,
  stackChange: null,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.PrepareArgs] = {
  name: 'PrepareArgs',
  mnemonic: 'argsprep',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: false,
};

METADATA[Op.CaptureArgs] = {
  name: 'CaptureArgs',
  mnemonic: 'argscapture',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.CreateComponent] = {
  name: 'CreateComponent',
  mnemonic: 'comp_create',
  before: null,
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
  operands: 2,
  check: true,
};

METADATA[Op.RegisterComponentDestructor] = {
  name: 'RegisterComponentDestructor',
  mnemonic: 'comp_dest',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.PutComponentOperations] = {
  name: 'PutComponentOperations',
  mnemonic: 'comp_elops',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.GetComponentSelf] = {
  name: 'GetComponentSelf',
  mnemonic: 'comp_selfload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.GetComponentTagName] = {
  name: 'GetComponentTagName',
  mnemonic: 'comp_tagload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.GetComponentLayout] = {
  name: 'GetComponentLayout',
  mnemonic: 'comp_layoutload',
  before: null,
  stackChange: 2,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.BindEvalScope] = {
  name: 'BindEvalScope',
  mnemonic: 'eval_scope',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.SetupForEval] = {
  name: 'SetupForEval',
  mnemonic: 'eval_setup',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.PopulateLayout] = {
  name: 'PopulateLayout',
  mnemonic: 'comp_layoutput',
  before: null,
  stackChange: -2,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.InvokeComponentLayout] = {
  name: 'InvokeComponentLayout',
  mnemonic: 'comp_invokelayout',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.BeginComponentTransaction] = {
  name: 'BeginComponentTransaction',
  mnemonic: 'comp_begin',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.CommitComponentTransaction] = {
  name: 'CommitComponentTransaction',
  mnemonic: 'comp_commit',
  before: null,
  stackChange: 0,
  ops: [],
  operands: 0,
  check: true,
};

METADATA[Op.DidCreateElement] = {
  name: 'DidCreateElement',
  mnemonic: 'comp_created',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.DidRenderLayout] = {
  name: 'DidRenderLayout',
  mnemonic: 'comp_rendered',
  before: null,
  stackChange: 0,
  ops: [
    {
      name: 'state',
      type: 'register',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.ResolveMaybeLocal] = {
  name: 'ResolveMaybeLocal',
  mnemonic: 'eval_varload',
  before: null,
  stackChange: 1,
  ops: [
    {
      name: 'local',
      type: 'str',
    },
  ],
  operands: 1,
  check: true,
};

METADATA[Op.Debugger] = {
  name: 'Debugger',
  mnemonic: 'debugger',
  before: null,
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
  operands: 2,
  check: true,
};

METADATA[Op.StaticComponentAttr] = {
  name: 'StaticComponentAttr',
  mnemonic: 'comp_attr',
  before: null,
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
  operands: 3,
  check: true,
};

METADATA[Op.PushUnwindTarget] = define(`PushUnwindTarget as pushut`, [], {
  stackChange: +1,
});
