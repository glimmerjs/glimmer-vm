import type { VmOp } from '@glimmer/interfaces';

import type { OpcodeMetadata } from './metadata';
import { MetadataBuilder, RESERVED } from './utils';
import { UNCHANGED } from './stack/params';
import { define } from './stack/define-metadata';

export function opcodeMetadata(op: VmOp): OpcodeMetadata {
  return METADATA[op];
}

export const PushFrame = define('PushFrame', (d) =>
  d.ops().pushes('register/ra', 'register/fp').reads('$fp', '$sp').changes('$fp')
);

export const PopFrame = define('PopFrame', (d) =>
  d
    .peeks('ra', 'register/ra', { from: '$fp' })
    .peeks('fp', 'register/fp', { from: '$fp' })
    .changesFrame()
    .reads('$fp')
    .changes('$ra', '$sp', '$fp')
);

export const Jump = define('Jump', (d) =>
  d.ops(['to', 'instruction/relative']).unchanged().reads('$pc').changes('$pc')
);

export const ReturnTo = define('ReturnTo', (d) =>
  d.ops(['to', 'instruction/relative']).unchanged().reads('$pc').changes('$ra')
);

export const PopTryFrame = define('PopTryFrame', (d) =>
  d
    .ops(['catchPc', 'instruction/relative'])
    .pops('handler', 'ref/function?')
    .reads('$pc', '$sp', '$fp')
    .changes('$up')
);

export const PushTryFrame = define.throws('PushTryFrame', (d) =>
  d
    .ops(['catchPc', 'instruction/relative'])
    .pops('handler', 'ref/function?')
    .reads('$pc', '$sp', '$fp')
    .changes('$up')
);

export const InvokeVirtual = define('InvokeVirtual', (d) =>
  d.pops('block', 'handle/block').reads('$pc').changes('$ra', '$pc')
);

export const InvokeStatic = define('InvokeStatic', (d) =>
  d.ops(['handle', 'handle/block']).unchanged().reads('$pc').changes('$ra', '$pc')
);

export const Return = define('Return', (d) => d.unchanged().reads('$ra').changes('$pc'));

export const Helper = define.throws('Helper', (d) =>
  d
    .ops(['helper', 'const/function'])
    .pops('args', 'args')
    .peeks('args', 'stack/args')
    .reads('owner', 'dynamic-scope/value')
    .changes('destroyable', ['$v0', 'ref/any'])
);

export const GetVariable = define('GetVariable', (d) =>
  d.ops(['symbol', 'variable']).pushes('ref/any').reads(['lexical-scope/value', 'variable'])
);

export const SetVariable = define('SetVariable', (d) =>
  d.ops(['symbol', 'variable']).pops('expr', 'ref/any').changes(['lexical-scope/value', 'variable'])
);

export const SetBlock = define('SetBlock', (d) =>
  d
    .ops(['symbol', 'variable/block'])
    .pops('handle', 'block/compilable')
    .pops('scope', 'scope')
    .pops('table', 'table/block')
    .changes(['lexical-scope/block', 'variable/block'])
);

export const PushRootScope = define('RootScope', (d) =>
  d.ops(['symbols', 'unsigned']).reads('owner').changes('scope')
);

export const GetProperty = define('GetProperty', (d) =>
  d.ops(['key', 'const/string']).pops('expr', 'ref/any').pushes('ref/any')
);

export const GetBlock = define('GetBlock', (d) =>
  d
    .ops(['block', 'variable/block'])
    .pushes('block/scope?')
    .reads(['lexical-scope/block', 'block/scope?'])
);

export const SpreadBlock = define('SpreadBlock', (d) =>
  // @todo this could be an undefined reference
  d.pops('block', 'block/scope?').pushes('table/block?', 'block/scope?', 'block/compilable?')
);

export const HasBlock = define('HasBlock', (d) =>
  d.pops('block', 'block/scope?').pushes('ref/boolean')
);

export const HasBlockParams = define('HasBlockParams', (d) =>
  d
    .pops('block', 'block/compilable?')
    .pops('scope', 'block/scope?')
    .pops('table', 'table/block?')
    .pushes('ref/boolean')
);

// @active
const METADATA = MetadataBuilder.build(({ add, stack }) =>
  add(`PushFrame as pushf`, stack.params([]).returns(['register/instruction', 'register/stack']))
    .add(
      `PopFrame as popf`,
      stack.dynamic({ reason: 'frames pop an arbitrary number of stack elements' })
    )
    .add(`Jump as goto`, ['to:imm/u32'])
    .add(`ReturnTo as setra`, ['offset:imm/pc'])
    .add(`PopTryFrame as finally`)
    .add(`UnwindTypeFrame as unwind`)
    .add(RESERVED)
    .add(RESERVED)
    .add(RESERVED)
    .add(RESERVED)
    .add(RESERVED)
    .add(RESERVED)
    .add(RESERVED)
    .add(RESERVED)
    .add(RESERVED)
    .add(RESERVED)

    .add(
      `PushTryFrame as try`,
      ['catch:imm/pc'],
      stack.params(['handler:reference/any']).returns([])
    )
    .add(`InvokeVirtual as vcall`, stack.delta(-1))
    .add(`InvokeStatic as scall`, ['offset:imm/u32'])
    .add(`Return as ret`)
    .add(`Helper as ncall`, [`helper:handle`], stack.params(['args:args']).returns([]))
    .add(`SetNamedVariables as vsargs`, [`register:register`])
    .add(`SetBlocks as vbblocks`, [`register:register`])
    .add(`SetVariable as sbvar`, [`symbol:variable`], stack.delta(-1))
    .add(`SetBlock as sbblock`, [`symbol:variable`], stack.delta(-3))
    .add(`GetVariable as symload`, [`symbol:variable`], stack.params([]).returns(['reference/any']))

    .add(
      `GetProperty as replace<-prop`,
      [`property:const/str`],
      stack.params(['obj:reference/any']).returns(['reference/any'])
    )
    .add(`GetBlock as push<-scope`, [`block:variable`], stack.delta(+1))
    .add(`SpreadBlock as push2<-block`, stack.delta(+2))
    .add(`HasBlock as store<-hasblock`)
    .add(
      `HasBlockParams as pop2->hasparam`,
      stack.params(['block:block/handle', 'scope:scope', 'table:block/table?']).returns(['bool'])
    )
    .add(
      `Concat as concat`,
      ['count:imm/u32'],
      stack.dynamic(({ op1 }) => ({
        type: 'operations',
        peek: 0,
        pop: op1,
        push: 1,
        delta: -op1 + 1,
      }))
    )
    .add(`Constant as rconstload`, ['constant:const/any'], stack.delta(+1))
    .add(`ConstantReference as rconstrefload`, ['constant:const/any'], stack.delta(+1))
    .add(`Primitive as pconstload`, ['constant:const/primitive'], stack.delta(+1))
    .add(`PrimitiveReference as ptoref`, [])
    .add(`ReifyU32 as reifyload`, stack.delta(+1))
    .add(`Dup as push_dup`, ['register:register', 'offset:imm/u32'], stack.delta(+1))
    .add(
      `Pop as pop`,
      ['count:imm/u32'],
      stack.dynamic(({ op1 }) => ({ type: 'operations', pop: op1, push: 0, peek: 0, delta: -op1 }))
    )
    .add(`Load as stack->store`, ['register:register'], stack.delta(-1))
    .add(`Fetch as load->stack`, ['register:register'], stack.delta(+1))
    .add(`RootScope as rscopepush`, ['size:imm/u32'])
    .add(`VirtualRootScope as vrscopepush`, ['register:register'])
    .add(`ChildScope as cscopepush`, [])
    .add(`PopScope as popscope`)

    // apnd_* get the values from a register (and therefore leave the stack untouched)
    // apnd_dyn* get the values from the stack (and therefore decrement the stack)

    .add(`Text as apnd_text`, ['contents:const/str'])
    .add(`Comment as apend_comment`, ['contents:const/str'])
    .add(`AppendHTML as apnd_dynhtml`, stack.delta(-1))
    .add(`AppendSafeHTML as apnd_dynshtml`, stack.delta(-1))
    .add(`AppendDocumentFragment as apnd_dynfrag`, stack.delta(-1))
    .add(`AppendNode as apnd_dynnode`, [], stack.delta(-1))
    .add(`AppendText as apnd_dyntext`, [], stack.delta(-1))
    .add(`OpenElement as apnd_tag`, ['tag:const/str'])
    .add(`OpenDynamicElement as apnd_dyntag`, [], stack.delta(-1))
    .add(`PushRemoteElement as apnd_remotetag`, stack.delta(-3))
    .add(`StaticAttr as apnd_attr`, ['name:const/str', 'value:const/str', 'namespace:const/str?'])
    .add(
      `DynamicAttr as apnd_dynattr`,
      ['name:const/str', 'value:const/str'],
      stack.params(['value:reference/any']).returns([])
    )
    .add(
      `ComponentAttr as apnd_compattr`,
      ['name:const/str', 'value:const/str'],
      stack.params(['value:reference/any']).returns([])
    )
    .add(`FlushElement as apnd_flush`, [])
    .add(`CloseElement as apnd_close`, [])
    .add(`PopRemoteElement as apnd_remoteclose`, [])
    // @audit what's this parameter?
    .add(`Modifier as apnd_modifier`, ['helper:const/fn'], stack.delta(-1))
    .add(
      `BindDynamicScope as setdynscope`,
      ['names:const/str[]'],
      stack.dynamic(({ op1 }, state) => {
        const names = state.constant.constants.getArray<string[]>(op1);
        return { type: 'operations', pop: names.length, push: 0, peek: 0, delta: -names.length };
      })
    )
    .add(`PushDynamicScope as dynscopepush`)
    .add(`PopDynamicScope as dynscopepop`)
    .add(
      `CompileBlock as cmpblock`,
      stack.params(['template:block/template']).returns(['block/handle'])
    )
    .add(`PushBlockScope as push<-scope`, stack.params([]).returns(['scope']))
    .add(`PushSymbolTable as push<-table`, stack.params([]).returns(['table']))
    .add(
      `InvokeYield as invoke`,
      stack
        .params(['table:block/table', 'scope:scope', 'block:block/handle?', 'args:args'])
        // ra, fp
        .returns(['register/stack', 'register/stack'])
    )
    .add(
      `JumpIf as pop->cgoto`,
      ['target:register/instruction'],
      stack.params(['condition:reference/bool']).returns([])
    )
    .add(
      `JumpUnless as pop->cngoto`,
      ['target:register/instruction'],
      stack.params(['condition:reference/bool']).returns([])
    )
    .add(
      `JumpEq as gotoeq`,
      ['target:register/instruction', 'comparison:instruction/relative'],
      stack.peeks(['other:i32'])
    )
    .add(`AssertSame as assert_eq`, stack.params(['reference:reference/any']).returns(UNCHANGED))
    .add(`Enter as enter1`)
    .add(`Exit as exit1`)
    .add(
      `ToBoolean as tobool(top)`,
      stack.params(['value:reference/any']).returns(['reference/bool'])
    )
    .add(
      `EnterList as list/start`,
      ['start:instruction/relative', 'else:instruction/absolute'],
      stack
        .params(['key:reference/fn', 'list:reference/any'])
        .dynamic({ reason: 'the stack only changes if the iterator is non-empty' })
    )
    .add(`ExitList as list/done`)
    .add(
      `Iterate as list/item`,
      ['breaks:instruction/absolute'],
      stack.params(['iterator:glimmer/iterator']).dynamic({
        reason: 'the behavior is different depending on the result of iterating the iterator',
      })
    )
    .add(
      `Main as call/main`,
      ['register:register/sN'],
      stack.params(['invocation:block/invocation', 'component:component/definition']).returns([])
      // @todo characterize loading into $s0
    )
    .add(`ContentType as push<-ctype`, stack.peeks(['value:reference/any']).pushes(['enum/ctype']))
    .add(
      `Curry as v0<-curryref[pop2]`,
      ['type:imm/enum<curry>', 'strict?:const/bool'],
      stack.params(['args:args/captured', 'definition:reference/definition']).returns([])
    )
    .add(
      `PushComponentDefinition as push<-def`,
      ['definition:const/definition'],
      stack.params([]).returns(['component/instance'])
    )
    .add(
      `PushDynamicComponentInstance as push<-s0(definition)`,
      stack.params(['definition:component/definition']).returns(['component/instance'])
    )
    .add(
      `ResolveDynamicComponent as push<-pop_definition`,
      stack.params(['definition:component/%definition']).returns(['component/definition'])
    )
    .add(
      `ResolveCurriedComponent as push<-pop_curryref`,
      stack.params(['definition:component/%value']).returns(['component/definition'])
    )
    .add(
      `PushArgs as push<-args`,
      ['names:const/str[]', 'block-names:const/str[]', 'flags:imm/u32{todo}'],
      stack.params([]).returns(['args'])
    )
    .add(`PushEmptyArgs as push<-args0`, stack.params([]).returns(['args']))
    .add(
      `PrepareArgs as prepare<-args0`,
      stack.dynamic({
        reason:
          "The behavior of PrepareArgs is highly dynamic. It may be useful to verify it, but it's not worth the effort at the moment.",
      })
    )

    .add(`CaptureArgs as push<-args0`, stack.params(['args:args']).returns(['args/captured']))
    .add(`CreateComponent as s0/component_create`, ['flags:imm/i32{todo}', 'instance:register/sN'])
    .add(`RegisterComponentDestructor as `, ['instance:register/sN'])
    .add(`PutComponentOperations as t0<-new_operations`)
    .add(
      `GetComponentSelf as push<-self`,
      ['instance:register/sN', 'names:const/str[]?'],
      stack.params([]).returns(['value/dynamic'])
    )
    .add(
      `GetComponentTagName as `,
      ['instance:register/sN'],
      stack.params([]).returns(['value/str'])
    )
    .add(
      `GetComponentLayout as push<-layout`,
      ['instance:register/sN'],
      stack.params([]).returns(['block/table', 'block/handle'])
    )
    .add(`SetupForEval as scope<-eval`, ['finished-instance:register/sN'])
    .add(
      `PopulateLayout as instance<-block`,
      ['instance:register/sN'],
      stack.params(['table:block/table', 'block:block/handle']).returns([])
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
    .add(`DynamicContentType as `, stack.params(['value:reference/any']).pushes(['enum/ctype']))
    .add(
      `DynamicHelper as v0<-helper`,
      stack.params(['args:args', 'ref:reference/any']).returns([])
    )
    .add(
      `DynamicModifier as element<-modifier`,
      stack.params(['args:args', 'ref:reference/any']).returns([])
    )
    .add(
      `IfInline as push<-if[pop3]`,
      stack
        .params(['falsy:reference/any', 'truthy:reference/any', 'condition:reference/any'])
        .returns(['reference/any'])
    )
    .add(`Not as push<-not[pop1]`, stack.params(['ref:reference/any']).returns(['reference/bool']))
    .add(
      `GetDynamicVar as push<-dynvar[pop1]`,
      stack.params(['name:reference/any']).returns(['reference/any'])
    )
    .add(`Log as v0<-log_ref[pop1]`, stack.params(['args:args']).returns([]))
    .add(
      `PushUnwindTarget as push<-target`,
      stack.params(['target:register/instruction']).returns([])
    )
);
