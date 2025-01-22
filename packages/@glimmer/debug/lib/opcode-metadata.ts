/* This file is generated by build/debug.js */

import type { Nullable, VmMachineOp, VmOp } from '@glimmer/interfaces';
import {
  isMachineOp,
  VM_APPEND_DOCUMENT_FRAGMENT_OP,
  VM_APPEND_HTML_OP,
  VM_APPEND_NODE_OP,
  VM_APPEND_SAFE_HTML_OP,
  VM_APPEND_TEXT_OP,
  VM_ASSERT_SAME_OP,
  VM_BEGIN_COMPONENT_TRANSACTION_OP,
  VM_BIND_DYNAMIC_SCOPE_OP,
  VM_CAPTURE_ARGS_OP,
  VM_CHILD_SCOPE_OP,
  VM_CLOSE_ELEMENT_OP,
  VM_COMMENT_OP,
  VM_COMMIT_COMPONENT_TRANSACTION_OP,
  VM_COMPILE_BLOCK_OP,
  VM_COMPONENT_ATTR_OP,
  VM_CONCAT_OP,
  VM_CONSTANT_OP,
  VM_CONSTANT_REFERENCE_OP,
  VM_CONTENT_TYPE_OP,
  VM_CREATE_COMPONENT_OP,
  VM_CURRY_OP,
  VM_DEBUGGER_OP,
  VM_DID_CREATE_ELEMENT_OP,
  VM_DID_RENDER_LAYOUT_OP,
  VM_DUP_FP_OP,
  VM_DUP_SP_OP,
  VM_DYNAMIC_ATTR_OP,
  VM_DYNAMIC_CONTENT_TYPE_OP,
  VM_DYNAMIC_HELPER_OP,
  VM_DYNAMIC_MODIFIER_OP,
  VM_ENTER_LIST_OP,
  VM_ENTER_OP,
  VM_EXIT_LIST_OP,
  VM_EXIT_OP,
  VM_FETCH_OP,
  VM_FLUSH_ELEMENT_OP,
  VM_GET_BLOCK_OP,
  VM_GET_COMPONENT_LAYOUT_OP,
  VM_GET_COMPONENT_SELF_OP,
  VM_GET_COMPONENT_TAG_NAME_OP,
  VM_GET_PROPERTY_OP,
  VM_GET_VARIABLE_OP,
  VM_HAS_BLOCK_OP,
  VM_HAS_BLOCK_PARAMS_OP,
  VM_HELPER_OP,
  VM_IF_INLINE_OP,
  VM_INVOKE_COMPONENT_LAYOUT_OP,
  VM_INVOKE_STATIC_OP,
  VM_INVOKE_VIRTUAL_OP,
  VM_INVOKE_YIELD_OP,
  VM_ITERATE_OP,
  VM_JIT_INVOKE_VIRTUAL_OP,
  VM_JUMP_EQ_OP,
  VM_JUMP_IF_OP,
  VM_JUMP_OP,
  VM_JUMP_UNLESS_OP,
  VM_LOAD_OP,
  VM_MACHINE_SIZE,
  VM_MAIN_OP,
  VM_MODIFIER_OP,
  VM_NOT_OP,
  VM_OPEN_DYNAMIC_ELEMENT_OP,
  VM_OPEN_ELEMENT_OP,
  VM_POP_ARGS_OP,
  VM_POP_DYNAMIC_SCOPE_OP,
  VM_POP_FRAME_OP,
  VM_POP_OP,
  VM_POP_REMOTE_ELEMENT_OP,
  VM_POP_SCOPE_OP,
  VM_POPULATE_LAYOUT_OP,
  VM_PREPARE_ARGS_OP,
  VM_PRIMITIVE_OP,
  VM_PRIMITIVE_REFERENCE_OP,
  VM_PUSH_AND_BIND_DYNAMIC_SCOPE_OP,
  VM_PUSH_ARGS_OP,
  VM_PUSH_BLOCK_SCOPE_OP,
  VM_PUSH_COMPONENT_DEFINITION_OP,
  VM_PUSH_DYNAMIC_COMPONENT_INSTANCE_OP,
  VM_PUSH_EMPTY_ARGS_OP,
  VM_PUSH_FRAME_OP,
  VM_PUSH_REMOTE_ELEMENT_OP,
  VM_PUSH_SYMBOL_TABLE_OP,
  VM_PUT_COMPONENT_OPERATIONS_OP,
  VM_REGISTER_COMPONENT_DESTRUCTOR_OP,
  VM_REIFY_U32_OP,
  VM_RESOLVE_COMPONENT_DEFINITION,
  VM_RESOLVE_COMPONENT_DEFINITION_OR_STRING,
  VM_RETURN_OP,
  VM_RETURN_TO_OP,
  VM_ROOT_SCOPE_OP,
  VM_SET_BLOCK_OP,
  VM_SET_BLOCKS_OP,
  VM_SET_NAMED_VARIABLES_OP,
  VM_SET_VARIABLE_OP,
  VM_SPREAD_BLOCK_OP,
  VM_STATIC_ATTR_OP,
  VM_SYSCALL_SIZE,
  VM_TEXT_OP,
  VM_TO_BOOLEAN_OP,
  VM_VIRTUAL_ROOT_SCOPE_OP,
} from '@glimmer/constants';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';

import type { NormalizedMetadata } from './metadata';

export function opcodeMetadata(op: VmOp | VmMachineOp): Nullable<NormalizedMetadata> {
  if (!LOCAL_DEBUG) {
    return null;
  }

  let value = isMachineOp(op) ? MACHINE_METADATA[op] : METADATA[op];

  return value || null;
}

const METADATA = new Array<Nullable<NormalizedMetadata>>(VM_SYSCALL_SIZE).fill(null);
const MACHINE_METADATA = new Array<Nullable<NormalizedMetadata>>(VM_MACHINE_SIZE).fill(null);

if (LOCAL_DEBUG) {
  MACHINE_METADATA[VM_PUSH_FRAME_OP] = {
    name: 'PushFrame',
    mnemonic: 'pushf',
    stackChange: 2,
  };

  MACHINE_METADATA[VM_POP_FRAME_OP] = {
    name: 'PopFrame',
    mnemonic: 'popf',
    stackChange: -2,
    check: false,
  };

  MACHINE_METADATA[VM_INVOKE_VIRTUAL_OP] = {
    name: 'InvokeVirtual',
    mnemonic: 'vcall',
    stackChange: -1,
  };

  MACHINE_METADATA[VM_INVOKE_STATIC_OP] = {
    name: 'InvokeStatic',
    mnemonic: 'scall',
    stackChange: 0,
    ops: ['offset:handle/block'],
  };

  MACHINE_METADATA[VM_JUMP_OP] = {
    name: 'Jump',
    mnemonic: 'goto',
    stackChange: 0,
    ops: ['to:instruction/relative'],
  };

  MACHINE_METADATA[VM_RETURN_OP] = {
    name: 'Return',
    mnemonic: 'ret',
    stackChange: 0,
    check: false,
  };

  MACHINE_METADATA[VM_RETURN_TO_OP] = {
    name: 'ReturnTo',
    mnemonic: 'setra',
    stackChange: 0,
    ops: ['offset:instruction/relative'],
  };

  METADATA[VM_HELPER_OP] = {
    name: 'Helper',
    mnemonic: 'ncall',
    stackChange: null,
    ops: ['helper:handle'],
  };

  METADATA[VM_DYNAMIC_HELPER_OP] = {
    name: 'DynamicHelper',
    mnemonic: 'dynamiccall',
    stackChange: null,
  };

  METADATA[VM_DYNAMIC_MODIFIER_OP] = {
    name: 'DynamicModifier',
    mnemonic: 'dynamicmodifier',
    stackChange: null,
    ops: ['helper:handle'],
  };

  METADATA[VM_SET_NAMED_VARIABLES_OP] = {
    name: 'SetNamedVariables',
    mnemonic: 'vsargs',
    stackChange: 0,
    ops: ['register:register'],
  };

  METADATA[VM_SET_BLOCKS_OP] = {
    name: 'SetBlocks',
    mnemonic: 'vbblocks',
    stackChange: 0,
    ops: ['register:register'],
  };

  METADATA[VM_SET_VARIABLE_OP] = {
    name: 'SetVariable',
    mnemonic: 'sbvar',
    stackChange: -1,
    ops: ['symbol:variable'],
  };

  METADATA[VM_SET_BLOCK_OP] = {
    name: 'SetBlock',
    mnemonic: 'sblock',
    stackChange: -3,
    ops: ['symbol:variable'],
  };

  METADATA[VM_GET_VARIABLE_OP] = {
    name: 'GetVariable',
    mnemonic: 'symload',
    stackChange: 1,
    ops: ['symbol:variable'],
  };

  METADATA[VM_GET_PROPERTY_OP] = {
    name: 'GetProperty',
    mnemonic: 'getprop',
    stackChange: 0,
    ops: ['property:const/str'],
  };

  METADATA[VM_GET_BLOCK_OP] = {
    name: 'GetBlock',
    mnemonic: 'blockload',
    stackChange: 1,
    ops: ['block:variable'],
  };

  METADATA[VM_SPREAD_BLOCK_OP] = {
    name: 'SpreadBlock',
    mnemonic: 'blockspread',
    stackChange: 2,
  };

  METADATA[VM_HAS_BLOCK_OP] = {
    name: 'HasBlock',
    mnemonic: 'hasblockload',
    stackChange: 0,
  };

  METADATA[VM_HAS_BLOCK_PARAMS_OP] = {
    name: 'HasBlockParams',
    mnemonic: 'hasparamsload',
    stackChange: -2,
  };

  METADATA[VM_CONCAT_OP] = {
    name: 'Concat',
    mnemonic: 'concat',
    stackChange: null,
    ops: ['count:imm/u32'],
  };

  METADATA[VM_IF_INLINE_OP] = {
    name: 'IfInline',
    mnemonic: 'ifinline',
    stackChange: -2,
  };

  METADATA[VM_NOT_OP] = {
    name: 'Not',
    mnemonic: 'not',
    stackChange: 0,
  };

  METADATA[VM_CONSTANT_OP] = {
    name: 'Constant',
    mnemonic: 'rconstload',
    stackChange: 1,
    ops: ['constant:const/any'],
  };

  METADATA[VM_CONSTANT_REFERENCE_OP] = {
    name: 'ConstantReference',
    mnemonic: 'rconstrefload',
    stackChange: 1,
    ops: ['constant:const/any'],
  };

  METADATA[VM_PRIMITIVE_OP] = {
    name: 'Primitive',
    mnemonic: 'pconstload',
    stackChange: 1,
    ops: ['constant:const/primitive'],
  };

  METADATA[VM_PRIMITIVE_REFERENCE_OP] = {
    name: 'PrimitiveReference',
    mnemonic: 'ptoref',
    stackChange: 0,
  };

  METADATA[VM_REIFY_U32_OP] = {
    name: 'ReifyU32',
    mnemonic: 'reifyload',
    stackChange: 1,
  };

  METADATA[VM_DUP_FP_OP] = {
    name: 'DupFp',
    mnemonic: 'dupfp',
    stackChange: 1,
    ops: ['offset:imm/u32'],
  };

  METADATA[VM_DUP_SP_OP] = {
    name: 'DupSp',
    mnemonic: 'dupsp',
    stackChange: 1,
  };

  METADATA[VM_POP_OP] = {
    name: 'Pop',
    mnemonic: 'pop',
    stackChange: 0,
    ops: ['count:imm/u32'],
    check: false,
  };

  METADATA[VM_LOAD_OP] = {
    name: 'Load',
    mnemonic: 'put',
    stackChange: -1,
    ops: ['register:register'],
  };

  METADATA[VM_FETCH_OP] = {
    name: 'Fetch',
    mnemonic: 'regload',
    stackChange: 1,
    ops: ['register:register'],
  };

  METADATA[VM_ROOT_SCOPE_OP] = {
    name: 'RootScope',
    mnemonic: 'rscopepush',
    stackChange: 0,
    ops: ['symbols:imm/u32'],
  };

  METADATA[VM_VIRTUAL_ROOT_SCOPE_OP] = {
    name: 'VirtualRootScope',
    mnemonic: 'vrscopepush',
    stackChange: 0,
    ops: ['register:register'],
  };

  METADATA[VM_CHILD_SCOPE_OP] = {
    name: 'ChildScope',
    mnemonic: 'cscopepush',
    stackChange: 0,
  };

  METADATA[VM_POP_SCOPE_OP] = {
    name: 'PopScope',
    mnemonic: 'scopepop',
    stackChange: 0,
  };

  METADATA[VM_TEXT_OP] = {
    name: 'Text',
    mnemonic: 'apnd_text',
    stackChange: 0,
    ops: ['contents:const/str'],
  };

  METADATA[VM_COMMENT_OP] = {
    name: 'Comment',
    mnemonic: 'apnd_comment',
    stackChange: 0,
    ops: ['contents:const/str'],
  };

  METADATA[VM_APPEND_HTML_OP] = {
    name: 'AppendHTML',
    mnemonic: 'apnd_dynhtml',
    stackChange: -1,
  };

  METADATA[VM_APPEND_SAFE_HTML_OP] = {
    name: 'AppendSafeHTML',
    mnemonic: 'apnd_dynshtml',
    stackChange: -1,
  };

  METADATA[VM_APPEND_DOCUMENT_FRAGMENT_OP] = {
    name: 'AppendDocumentFragment',
    mnemonic: 'apnd_dynfrag',
    stackChange: -1,
  };

  METADATA[VM_APPEND_NODE_OP] = {
    name: 'AppendNode',
    mnemonic: 'apnd_dynnode',
    stackChange: -1,
  };

  METADATA[VM_APPEND_TEXT_OP] = {
    name: 'AppendText',
    mnemonic: 'apnd_dyntext',
    stackChange: -1,
  };

  METADATA[VM_OPEN_ELEMENT_OP] = {
    name: 'OpenElement',
    mnemonic: 'apnd_tag',
    stackChange: 0,
    ops: ['tag:const/str'],
  };

  METADATA[VM_OPEN_DYNAMIC_ELEMENT_OP] = {
    name: 'OpenDynamicElement',
    mnemonic: 'apnd_dyntag',
    stackChange: -1,
  };

  METADATA[VM_PUSH_REMOTE_ELEMENT_OP] = {
    name: 'PushRemoteElement',
    mnemonic: 'apnd_remotetag',
    stackChange: -3,
  };

  METADATA[VM_STATIC_ATTR_OP] = {
    name: 'StaticAttr',
    mnemonic: 'apnd_attr',
    stackChange: 0,
    ops: ['name:const/str', 'value:const/str', 'namespace:const/str?'],
  };

  METADATA[VM_DYNAMIC_ATTR_OP] = {
    name: 'DynamicAttr',
    mnemonic: 'apnd_dynattr',
    stackChange: -1,
    ops: ['name:const/str', 'value:const/str'],
  };

  METADATA[VM_COMPONENT_ATTR_OP] = {
    name: 'ComponentAttr',
    mnemonic: 'apnd_cattr',
    stackChange: -1,
    ops: ['name:const/str', 'value:const/str', 'namespace:const/str?'],
  };

  METADATA[VM_FLUSH_ELEMENT_OP] = {
    name: 'FlushElement',
    mnemonic: 'apnd_flushtag',
    stackChange: 0,
  };

  METADATA[VM_CLOSE_ELEMENT_OP] = {
    name: 'CloseElement',
    mnemonic: 'apnd_closetag',
    stackChange: 0,
  };

  METADATA[VM_POP_REMOTE_ELEMENT_OP] = {
    name: 'PopRemoteElement',
    mnemonic: 'apnd_closeremotetag',
    stackChange: 0,
  };

  METADATA[VM_MODIFIER_OP] = {
    name: 'Modifier',
    mnemonic: 'apnd_modifier',
    stackChange: -1,
    ops: ['helper:handle'],
  };

  METADATA[VM_BIND_DYNAMIC_SCOPE_OP] = {
    name: 'BindDynamicScope',
    mnemonic: 'setdynscope',
    stackChange: null,
    ops: ['names:const/str[]'],
  };

  METADATA[VM_PUSH_AND_BIND_DYNAMIC_SCOPE_OP] = {
    name: 'PushDynamicScope',
    mnemonic: 'dynscopepush',
    stackChange: 0,
  };

  METADATA[VM_POP_DYNAMIC_SCOPE_OP] = {
    name: 'PopDynamicScope',
    mnemonic: 'dynscopepop',
    stackChange: 0,
  };

  METADATA[VM_COMPILE_BLOCK_OP] = {
    name: 'CompileBlock',
    mnemonic: 'cmpblock',
    stackChange: 0,
  };

  METADATA[VM_JIT_INVOKE_VIRTUAL_OP] = {
    name: 'JitInvokeVirtual',
    mnemonic: 'jit_invoke_virtual',
    stackChange: 0,
  };

  METADATA[VM_PUSH_BLOCK_SCOPE_OP] = {
    name: 'PushBlockScope',
    mnemonic: 'scopeload',
    stackChange: 1,
  };

  METADATA[VM_PUSH_SYMBOL_TABLE_OP] = {
    name: 'PushSymbolTable',
    mnemonic: 'dsymload',
    stackChange: 1,
  };

  METADATA[VM_INVOKE_YIELD_OP] = {
    name: 'InvokeYield',
    mnemonic: 'invokeyield',
    stackChange: null,
  };

  METADATA[VM_JUMP_IF_OP] = {
    name: 'JumpIf',
    mnemonic: 'iftrue',
    stackChange: -1,
    ops: ['to:instruction/relative'],
  };

  METADATA[VM_JUMP_UNLESS_OP] = {
    name: 'JumpUnless',
    mnemonic: 'iffalse',
    stackChange: -1,
    ops: ['to:instruction/relative'],
  };

  METADATA[VM_JUMP_EQ_OP] = {
    name: 'JumpEq',
    mnemonic: 'ifeq',
    stackChange: 0,
    ops: ['to:instruction/relative', 'comparison:imm/i32'],
  };

  METADATA[VM_ASSERT_SAME_OP] = {
    name: 'AssertSame',
    mnemonic: 'assert_eq',
    stackChange: 0,
  };

  METADATA[VM_ENTER_OP] = {
    name: 'Enter',
    mnemonic: 'blk_start',
    stackChange: 0,
    ops: ['args:imm/u32'],
  };

  METADATA[VM_EXIT_OP] = {
    name: 'Exit',
    mnemonic: 'blk_end',
    stackChange: 0,
  };

  METADATA[VM_TO_BOOLEAN_OP] = {
    name: 'ToBoolean',
    mnemonic: 'anytobool',
    stackChange: 0,
  };

  METADATA[VM_ENTER_LIST_OP] = {
    name: 'EnterList',
    mnemonic: 'list_start',
    stackChange: null,
    ops: ['start:instruction/relative', 'else:instruction/relative'],
  };

  METADATA[VM_EXIT_LIST_OP] = {
    name: 'ExitList',
    mnemonic: 'list_end',
    stackChange: 0,
  };

  METADATA[VM_ITERATE_OP] = {
    name: 'Iterate',
    mnemonic: 'iter',
    stackChange: 0,
    ops: ['end:instruction/relative'],
    check: false,
  };

  METADATA[VM_MAIN_OP] = {
    name: 'Main',
    mnemonic: 'main',
    stackChange: -2,
    ops: ['state:register'],
  };

  METADATA[VM_CONTENT_TYPE_OP] = {
    name: 'ContentType',
    mnemonic: 'ctload',
    stackChange: 1,
  };

  METADATA[VM_DYNAMIC_CONTENT_TYPE_OP] = {
    name: 'DynamicContentType',
    mnemonic: 'dctload',
    stackChange: 1,
  };

  METADATA[VM_CURRY_OP] = {
    name: 'Curry',
    mnemonic: 'curry',
    stackChange: null,
    ops: ['type:imm/enum<curry>', 'strict?:const/bool'],
  };

  METADATA[VM_PUSH_COMPONENT_DEFINITION_OP] = {
    name: 'PushComponentDefinition',
    mnemonic: 'cmload',
    stackChange: 1,
    ops: ['spec:handle'],
  };

  METADATA[VM_PUSH_DYNAMIC_COMPONENT_INSTANCE_OP] = {
    name: 'PushDynamicComponentInstance',
    mnemonic: 'dciload',
    stackChange: 0,
  };

  METADATA[VM_RESOLVE_COMPONENT_DEFINITION] = {
    name: 'ResolveDynamicComponent',
    mnemonic: 'rescd',
    stackChange: 0,
  };

  METADATA[VM_RESOLVE_COMPONENT_DEFINITION_OR_STRING] = {
    name: 'ResolveDynamicComponent',
    mnemonic: 'rescds',
    stackChange: 0,
    ops: ['strict?:imm/bool'],
  };

  METADATA[VM_PUSH_ARGS_OP] = {
    name: 'PushArgs',
    mnemonic: 'argsload',
    stackChange: null,
    ops: ['names:const/str[]', 'block-names:const/str[]', 'flags:imm/u32'],
  };

  METADATA[VM_PUSH_EMPTY_ARGS_OP] = {
    name: 'PushEmptyArgs',
    mnemonic: 'emptyargsload',
    stackChange: 1,
  };

  METADATA[VM_POP_ARGS_OP] = {
    name: 'PopArgs',
    mnemonic: 'argspop',
    stackChange: null,
  };

  METADATA[VM_PREPARE_ARGS_OP] = {
    name: 'PrepareArgs',
    mnemonic: 'argsprep',
    stackChange: 0,
    ops: ['state:register'],
    check: false,
  };

  METADATA[VM_CAPTURE_ARGS_OP] = {
    name: 'CaptureArgs',
    mnemonic: 'argscapture',
    stackChange: 0,
  };

  METADATA[VM_CREATE_COMPONENT_OP] = {
    name: 'CreateComponent',
    mnemonic: 'comp_create',
    stackChange: 0,
    ops: ['flags:imm/i32'],
  };

  METADATA[VM_REGISTER_COMPONENT_DESTRUCTOR_OP] = {
    name: 'RegisterComponentDestructor',
    mnemonic: 'comp_dest',
    stackChange: 0,
    ops: ['state:register'],
  };

  METADATA[VM_PUT_COMPONENT_OPERATIONS_OP] = {
    name: 'PutComponentOperations',
    mnemonic: 'comp_elops',
    stackChange: 0,
  };

  METADATA[VM_GET_COMPONENT_SELF_OP] = {
    name: 'GetComponentSelf',
    mnemonic: 'comp_selfload',
    stackChange: 1,
    ops: ['state:register'],
  };

  METADATA[VM_GET_COMPONENT_TAG_NAME_OP] = {
    name: 'GetComponentTagName',
    mnemonic: 'comp_tagload',
    stackChange: 1,
    ops: ['state:register'],
  };

  METADATA[VM_GET_COMPONENT_LAYOUT_OP] = {
    name: 'GetComponentLayout',
    mnemonic: 'comp_layoutload',
    stackChange: 2,
    ops: ['state:register'],
  };

  METADATA[VM_POPULATE_LAYOUT_OP] = {
    name: 'PopulateLayout',
    mnemonic: 'comp_layoutput',
    stackChange: -2,
    ops: ['state:register'],
  };

  METADATA[VM_INVOKE_COMPONENT_LAYOUT_OP] = {
    name: 'InvokeComponentLayout',
    mnemonic: 'comp_invokelayout',
    stackChange: 0,
    ops: ['state:register'],
  };

  METADATA[VM_BEGIN_COMPONENT_TRANSACTION_OP] = {
    name: 'BeginComponentTransaction',
    mnemonic: 'comp_begin',
    stackChange: 0,
  };

  METADATA[VM_COMMIT_COMPONENT_TRANSACTION_OP] = {
    name: 'CommitComponentTransaction',
    mnemonic: 'comp_commit',
    stackChange: 0,
  };

  METADATA[VM_DID_CREATE_ELEMENT_OP] = {
    name: 'DidCreateElement',
    mnemonic: 'comp_created',
    stackChange: 0,
    ops: ['state:register'],
  };

  METADATA[VM_DID_RENDER_LAYOUT_OP] = {
    name: 'DidRenderLayout',
    mnemonic: 'comp_rendered',
    stackChange: 0,
    ops: ['state:register'],
  };

  METADATA[VM_DEBUGGER_OP] = {
    name: 'Debugger',
    mnemonic: 'debugger',
    stackChange: 0,
    ops: ['symbols:const/any'],
  };
}
