import type {
  VmAppendDocumentFragment,
  VmAppendHTML,
  VmAppendNode,
  VmAppendSafeHTML,
  VmAppendText,
  VmAssertSame,
  VmBeginComponentTransaction,
  VmBindDynamicScope,
  VmCaptureArgs,
  VmChildScope,
  VmCloseElement,
  VmComment,
  VmCommitComponentTransaction,
  VmCompileBlock,
  VmComponentAttr,
  VmConcat,
  VmConstant,
  VmConstantReference,
  VmContentType,
  VmCreateComponent,
  VmCurry,
  VmDebugger,
  VmDidCreateElement,
  VmDidRenderLayout,
  VmDup,
  VmDynamicAttr,
  VmDynamicContentType,
  VmDynamicHelper,
  VmDynamicModifier,
  VmEnter,
  VmEnterList,
  VmExit,
  VmExitList,
  VmFetch,
  VmFlushElement,
  VmGetBlock,
  VmGetComponentLayout,
  VmGetComponentSelf,
  VmGetComponentTagName,
  VmGetDynamicVar,
  VmGetProperty,
  VmGetVariable,
  VmHasBlock,
  VmHasBlockParams,
  VmHelper,
  VmIfInline,
  VmInvokeComponentLayout,
  VmInvokeYield,
  VmIterate,
  VmJumpEq,
  VmJumpIf,
  VmJumpUnless,
  VmLoad,
  VmLog,
  VmMain,
  VmModifier,
  VmNot,
  VmOp,
  VmOpenDynamicElement,
  VmOpenElement,
  VmPop,
  VmPopArgs,
  VmPopDynamicScope,
  VmPopRemoteElement,
  VmPopScope,
  VmPopulateLayout,
  VmPrepareArgs,
  VmPrimitive,
  VmPrimitiveReference,
  VmPushArgs,
  VmPushBlockScope,
  VmPushComponentDefinition,
  VmPushDynamicComponentInstance,
  VmPushDynamicScope,
  VmPushEmptyArgs,
  VmPushRemoteElement,
  VmPushSymbolTable,
  VmPutComponentOperations,
  VmRegisterComponentDestructor,
  VmReifyU32,
  VmResolveCurriedComponent,
  VmResolveDynamicComponent,
  VmRootScope,
  VmSetBlock,
  VmSetBlocks,
  VmSetNamedVariables,
  VmSetVariable,
  VmSize,
  VmSpreadBlock,
  VmStaticAttr,
  VmStaticComponentAttr,
  VmText,
  VmToBoolean,
  VmVirtualRootScope,
} from '@glimmer/interfaces';

export const VM_HELPER_OP: VmHelper = 16;
export const VM_SET_NAMED_VARIABLES_OP: VmSetNamedVariables = 17;
export const VM_SET_BLOCKS_OP: VmSetBlocks = 18;
export const VM_SET_VARIABLE_OP: VmSetVariable = 19;
export const VM_SET_BLOCK_OP: VmSetBlock = 20;
export const VM_GET_VARIABLE_OP: VmGetVariable = 21;
export const VM_GET_PROPERTY_OP: VmGetProperty = 22;
export const VM_GET_BLOCK_OP: VmGetBlock = 23;
export const VM_SPREAD_BLOCK_OP: VmSpreadBlock = 24;
export const VM_HAS_BLOCK_OP: VmHasBlock = 25;
export const VM_HAS_BLOCK_PARAMS_OP: VmHasBlockParams = 26;
export const VM_CONCAT_OP: VmConcat = 27;
export const VM_CONSTANT_OP: VmConstant = 28;
export const VM_CONSTANT_REFERENCE_OP: VmConstantReference = 29;
export const VM_PRIMITIVE_OP: VmPrimitive = 30;
export const VM_PRIMITIVE_REFERENCE_OP: VmPrimitiveReference = 31;
export const VM_REIFY_U32_OP: VmReifyU32 = 32;
export const VM_DUP_OP: VmDup = 33;
export const VM_POP_OP: VmPop = 34;
export const VM_LOAD_OP: VmLoad = 35;
export const VM_FETCH_OP: VmFetch = 36;
export const VM_ROOT_SCOPE_OP: VmRootScope = 37;
export const VM_VIRTUAL_ROOT_SCOPE_OP: VmVirtualRootScope = 38;
export const VM_CHILD_SCOPE_OP: VmChildScope = 39;
export const VM_POP_SCOPE_OP: VmPopScope = 40;
export const VM_TEXT_OP: VmText = 41;
export const VM_COMMENT_OP: VmComment = 42;
export const VM_APPEND_HTML_OP: VmAppendHTML = 43;
export const VM_APPEND_SAFE_HTML_OP: VmAppendSafeHTML = 44;
export const VM_APPEND_DOCUMENT_FRAGMENT_OP: VmAppendDocumentFragment = 45;
export const VM_APPEND_NODE_OP: VmAppendNode = 46;
export const VM_APPEND_TEXT_OP: VmAppendText = 47;
export const VM_OPEN_ELEMENT_OP: VmOpenElement = 48;
export const VM_OPEN_DYNAMIC_ELEMENT_OP: VmOpenDynamicElement = 49;
export const VM_PUSH_REMOTE_ELEMENT_OP: VmPushRemoteElement = 50;
export const VM_STATIC_ATTR_OP: VmStaticAttr = 51;
export const VM_DYNAMIC_ATTR_OP: VmDynamicAttr = 52;
export const VM_COMPONENT_ATTR_OP: VmComponentAttr = 53;
export const VM_FLUSH_ELEMENT_OP: VmFlushElement = 54;
export const VM_CLOSE_ELEMENT_OP: VmCloseElement = 55;
export const VM_POP_REMOTE_ELEMENT_OP: VmPopRemoteElement = 56;
export const VM_MODIFIER_OP: VmModifier = 57;
export const VM_BIND_DYNAMIC_SCOPE_OP: VmBindDynamicScope = 58;
export const VM_PUSH_DYNAMIC_SCOPE_OP: VmPushDynamicScope = 59;
export const VM_POP_DYNAMIC_SCOPE_OP: VmPopDynamicScope = 60;
export const VM_COMPILE_BLOCK_OP: VmCompileBlock = 61;
export const VM_PUSH_BLOCK_SCOPE_OP: VmPushBlockScope = 62;
export const VM_PUSH_SYMBOL_TABLE_OP: VmPushSymbolTable = 63;
export const VM_INVOKE_YIELD_OP: VmInvokeYield = 64;
export const VM_JUMP_IF_OP: VmJumpIf = 65;
export const VM_JUMP_UNLESS_OP: VmJumpUnless = 66;
export const VM_JUMP_EQ_OP: VmJumpEq = 67;
export const VM_ASSERT_SAME_OP: VmAssertSame = 68;
export const VM_ENTER_OP: VmEnter = 69;
export const VM_EXIT_OP: VmExit = 70;
export const VM_TO_BOOLEAN_OP: VmToBoolean = 71;
export const VM_ENTER_LIST_OP: VmEnterList = 72;
export const VM_EXIT_LIST_OP: VmExitList = 73;
export const VM_ITERATE_OP: VmIterate = 74;
export const VM_MAIN_OP: VmMain = 75;
export const VM_CONTENT_TYPE_OP: VmContentType = 76;
export const VM_CURRY_OP: VmCurry = 77;
export const VM_PUSH_COMPONENT_DEFINITION_OP: VmPushComponentDefinition = 78;
export const VM_PUSH_DYNAMIC_COMPONENT_INSTANCE_OP: VmPushDynamicComponentInstance = 79;
export const VM_RESOLVE_DYNAMIC_COMPONENT_OP: VmResolveDynamicComponent = 80;
export const VM_RESOLVE_CURRIED_COMPONENT_OP: VmResolveCurriedComponent = 81;
export const VM_PUSH_ARGS_OP: VmPushArgs = 82;
export const VM_PUSH_EMPTY_ARGS_OP: VmPushEmptyArgs = 83;
export const VM_POP_ARGS_OP: VmPopArgs = 84;
export const VM_PREPARE_ARGS_OP: VmPrepareArgs = 85;
export const VM_CAPTURE_ARGS_OP: VmCaptureArgs = 86;
export const VM_CREATE_COMPONENT_OP: VmCreateComponent = 87;
export const VM_REGISTER_COMPONENT_DESTRUCTOR_OP: VmRegisterComponentDestructor = 88;
export const VM_PUT_COMPONENT_OPERATIONS_OP: VmPutComponentOperations = 89;
export const VM_GET_COMPONENT_SELF_OP: VmGetComponentSelf = 90;
export const VM_GET_COMPONENT_TAG_NAME_OP: VmGetComponentTagName = 91;
export const VM_GET_COMPONENT_LAYOUT_OP: VmGetComponentLayout = 92;
export const VM_POPULATE_LAYOUT_OP: VmPopulateLayout = 95;
export const VM_INVOKE_COMPONENT_LAYOUT_OP: VmInvokeComponentLayout = 96;
export const VM_BEGIN_COMPONENT_TRANSACTION_OP: VmBeginComponentTransaction = 97;
export const VM_COMMIT_COMPONENT_TRANSACTION_OP: VmCommitComponentTransaction = 98;
export const VM_DID_CREATE_ELEMENT_OP: VmDidCreateElement = 99;
export const VM_DID_RENDER_LAYOUT_OP: VmDidRenderLayout = 100;
export const VM_DEBUGGER_OP: VmDebugger = 103;
export const VM_STATIC_COMPONENT_ATTR_OP: VmStaticComponentAttr = 105;
export const VM_DYNAMIC_CONTENT_TYPE_OP: VmDynamicContentType = 106;
export const VM_DYNAMIC_HELPER_OP: VmDynamicHelper = 107;
export const VM_DYNAMIC_MODIFIER_OP: VmDynamicModifier = 108;
export const VM_IF_INLINE_OP: VmIfInline = 109;
export const VM_NOT_OP: VmNot = 110;
export const VM_GET_DYNAMIC_VAR_OP: VmGetDynamicVar = 111;
export const VM_LOG_OP: VmLog = 112;
export const VM_SYSCALL_SIZE: VmSize = 113;

export function isOp(value: number): value is VmOp {
  return value >= 16;
}
