import type { Nullable, VmOp } from '@glimmer/interfaces';

import type { NormalizedMetadata } from './metadata';
import { MetadataBuilder, UNCHANGED, RESERVED } from './utils';

export function opcodeMetadata(op: VmOp): Nullable<NormalizedMetadata> {
  let value = METADATA[op];

  return value || null;
}

const METADATA = MetadataBuilder.build(
  ({ add, stack }) =>
    add(`PushFrame as pushf`, stack(2))
      .add(`PopFrame as popf`, stack(-2))
      .add(`InvokeVirtual as vcall`, stack(-1))
      .add(`InvokeStatic as scall`, ['offset:imm/u32'])
      .add(`Jump as goto`, ['to:imm/u32'])
      .add(`Return as ret`)
      .add(`ReturnTo as setra`, ['offset:imm/pc'])
      .add(`PushTryFrame as try`, ['catch:imm/pc'])
      .add(`PopTryFrame as finally`)
      .add(`UnwindTypeFrame as unwind`)
      .add(RESERVED)
      .add(RESERVED)
      .add(RESERVED)
      .add(RESERVED)
      .add(RESERVED)
      .add(RESERVED)

      .add(`Helper as ncall`, [`helper:handle`])
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
        stack.params(['block:block/handle', 'scope:scope', 'table:block/table?']),
        stack.returns(['bool'])
      )
      .add(
        `Concat as concat`,
        ['count:imm/u32'],
        stack.dynamic(({ op1 }) => -op1)
      )
      .add(`Constant as rconstload`, ['constant:const/any'], stack(+1))
      .add(`ConstantReference as rconstrefload`, ['constant:const/any'], stack(+1))
      .add(`Primitive as pconstload`, ['constant:const/primitive'], stack(+1))
      .add(`PrimitiveReference as ptoref`, [])
      .add(`ReifyU32 as reifyload`, stack(+1))
      .add(`Dup as push_dup`, ['register:register', 'offset:imm/u32'], stack(+1))
      .add(`Pop as pop`, ['count:imm/u32'], stack(-1))
      .add(`Load as stack->store`, ['register:register'], stack(-1))
      .add(`Fetch as load->stack`, ['register:register'], stack(+1))
      .add(`RootScope as rscopepush`, ['size:imm/u32'])
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
      .add(`BindDynamicScope as setdynscope`, ['names:const/str[]'])
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
        stack.params(['args:args', 'table:block/table', 'scope:scope', 'block:block/handle']),
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
        ['target:register/instruction', 'comparison:imm/i32'],
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
        ['register:register/sN'],
        stack.params(['invocation:block/invocation', 'component:component/definition']),
        stack.returns([])
        // @todo characterize loading into $s0
      )
      .add(
        `ContentType as push<-ctype`,
        stack.params(['value:reference/any']),
        stack.returns([UNCHANGED, 'enum/ctype'])
      )
      .add(
        `Curry as v0<-curryref[pop2]`,
        ['type:imm/enum<curry>', 'strict?:const/bool'],
        stack.params(['args:args/captured', 'definition:reference/definition']),
        stack.returns([])
      )
      .add(
        `PushComponentDefinition as push<-def`,
        ['definition:const/definition'],
        stack.params([]),
        stack.returns(['component/instance'])
      )
      .add(
        `PushDynamicComponentInstance as push<-s0(definition)`,
        stack.params(['definition:component/definition']),
        stack.returns(['component/instance'])
      )
      .add(
        `ResolveDynamicComponent as push<-pop_definition`,
        stack.params(['definition:component/%definition']),
        stack.returns(['component/definition'])
      )
      .add(
        `ResolveCurriedComponent as push<-pop_curryref`,
        stack.params(['definition:component/%value']),
        stack.returns(['component/definition'])
      )
      .add(
        `PushArgs as push<-args`,
        ['names:const/str[]', 'block-names:const/str[]', 'flags:imm/u32{todo}'],
        stack.params([]),
        stack.returns(['args'])
      )
      .add(`PushEmptyArgs as push<-args0`, stack.params([]), stack.returns(['args']))
      .add(`PrepareArgs as `)

      .add(`CaptureArgs as push<-args`, stack.params([]), stack.returns(['args']))
      .add(`CreateComponent as s0/component_create`, [
        'flags:imm/i32{todo}',
        'instance:register/sN',
      ])
      .add(`RegisterComponentDestructor as `, ['instance:register/sN'])
      .add(`PutComponentOperations as t0<-new_operations`)
      .add(
        `GetComponentSelf as push<-self`,
        ['instance:register/sN', 'names:const/str[]'],
        stack.params([]),
        stack.returns(['value/dynamic'])
      )
      .add(
        `GetComponentTagName as `,
        ['instance:register/sN'],
        stack.params([]),
        stack.returns(['value/str'])
      )
      .add(
        `GetComponentLayout as push<-layout`,
        ['instance:register/sN'],
        stack.params([]),
        stack.returns(['block/table', 'block/handle'])
      )
      .add(`SetupForEval as scope<-eval`, ['finished-instance:register/sN'])
      .add(
        `PopulateLayout as instance<-block`,
        ['instance:register/sN'],
        stack.params(['table:block/table', 'block:block/handle']),
        stack.returns([])
      )
      .add(`InvokeComponentLayout as pc<-instance/handle`, ['finished-instance:register/sN'])
      // cg means cache group
      // push a block and a cache group
      .add(`BeginComponentTransaction as blocks<-push_cg`, ['instance:register/sN'])
      // pop the cache group
      .add(`CommitComponentTransaction as blocks<-pop_cg`)
      .add(`DidCreateElement as hook(cm_didcreate)`, ['instance:register/sN'])
      // pop the block
      .add(`DidRenderLayout as blocks<-pop`, ['instance:register/sN'])
      .add(`Debugger as hook(debugger)`, ['symbols:const/str[]', 'info:const/i32[]'])
      .add(`StaticComponentAttr as element<-attr<static>`, [
        'name:const/str',
        'value:const/str',
        'namespace:const/str?',
      ])
      .add(
        `DynamicContentType as `,
        stack.params(['value:reference/any']),
        stack.returns(['enum/ctype'])
      )
      .add(
        `DynamicHelper as v0<-helper`,
        stack.params(['args:args', 'ref:reference/any']),
        stack.returns([])
      )
      .add(
        `DynamicModifier as element<-modifier`,
        stack.params(['args:args', 'ref:reference/any']),
        stack.returns([])
      )
      .add(
        `IfInline as push<-if[pop3]`,
        stack.params(['falsy:reference/any', 'truthy:reference/any', 'condition:reference/any']),
        stack.returns(['reference/any'])
      )
      .add(
        `Not as push<-not[pop1]`,
        stack.params(['ref:reference/any']),
        stack.returns(['reference/bool'])
      )
      .add(
        `GetDynamicVar as push<-dynvar[pop1]`,
        stack.params(['name:value/str']),
        stack.returns([])
      )
      .add(`Log as v0<-log_ref[pop1]`, stack.params(['args:args']), stack.returns([]))
      .add(`PushUnwindTarget as push<-unwind`, stack.params([]), stack.returns(['i32']))

  // .add(`InvokeComponentLayout as push<-invoke`, ['instance:register/sN'])
  // .add(`BeginComponentTransaction as push<-begin`, ['instance:register/sN'])
  // .add(`CommitComponentTransaction as push<-commit`, ['instance:register/sN'])
  // .add(`DidCreateElement as push<-create`, ['instance:register/sN'])
  // .add(`DidRenderLayout as push<-render`, ['instance:register/sN'])
  // .add(`ResolveMaybeLocal as push<-resolve`, ['instance:register/sN'])
  // .add(`Debugger as push<-debugger`, ['instance:register/sN'])
  // .add(`GetComponentDefinition as push<-definition`, ['instance:register/sN'])
  // .add(`GetComponentCapabilities as push<-capabilities`, ['instance:register/sN'])
  // .add(`GetComponentManager as push<-manager`, ['instance:register/sN'])
  // .add(`GetComponentState as push<-state`, ['instance:register/sN'])

  // .add(
  //   `PrepareArgs as top/prepare(args)`,
  //   ['instance:register/syscall'],
  //   stack.params(['args:args']),
  //   stack.returns([UNCHANGED])
  // )
);

// const METADATA: Nullable<NormalizedMetadata>[] = [...fillNulls<null>(16), ...METADATA2];
