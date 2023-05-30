import type {
  VmAppendDocumentFragment,
  VmAppendHTML,
  VmAppendNode,
  VmAppendSafeHTML,
  VmAppendText,
  VmAssertSame,
  VmBeginComponentTransaction,
  VmBindDynamicScope,
  VmBindEvalScope,
  VmCaptureArgs,
  VmChildScope,
  VmCloseElement,
  VmComment,
  VmCommitComponentTransaction,
  VmCompileBlock,
  VmComponentAttr,
  VmStrictComponentAttr,
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
  VmStrictDynamicAttr,
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
  VmMachineInvokeStatic,
  VmMachineInvokeVirtual,
  VmMachineJump,
  VmMachineOp,
  VmMachinePopFrame,
  VmMachinePushFrame,
  VmMachineReturn,
  VmMachineReturnTo,
  VmMachineSize,
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
  VmStrictStaticAttr,
  VmStrictStaticComponentAttr,
  VmText,
  VmToBoolean,
  VmVirtualRootScope,
} from '@glimmer/interfaces';

export const PUSH_FRAME_OP: VmMachinePushFrame = 0;
export const POP_FRAME_OP: VmMachinePopFrame = 1;
export const INVOKE_VIRTUAL_OP: VmMachineInvokeVirtual = 2;
export const INVOKE_STATIC_OP: VmMachineInvokeStatic = 3;
export const JUMP_OP: VmMachineJump = 4;
export const RETURN_OP: VmMachineReturn = 5;
export const RETURN_TO_OP: VmMachineReturnTo = 6;
export const SIZE_OP: VmMachineSize = 7;

export const HELPER_OP: VmHelper = 16;
export const SET_NAMED_VARIABLES_OP: VmSetNamedVariables = 17;
export const SET_BLOCKS_OP: VmSetBlocks = 18;
export const SET_VARIABLE_OP: VmSetVariable = 19;
export const SET_BLOCK_OP: VmSetBlock = 20;
export const GET_VARIABLE_OP: VmGetVariable = 21;
export const GET_PROPERTY_OP: VmGetProperty = 22;
export const GET_BLOCK_OP: VmGetBlock = 23;
export const SPREAD_BLOCK_OP: VmSpreadBlock = 24;
export const HAS_BLOCK_OP: VmHasBlock = 25;
export const HAS_BLOCK_PARAMS_OP: VmHasBlockParams = 26;
export const CONCAT_OP: VmConcat = 27;
export const CONSTANT_OP: VmConstant = 28;
export const CONSTANT_REFERENCE_OP: VmConstantReference = 29;
export const PRIMITIVE_OP: VmPrimitive = 30;
export const PRIMITIVE_REFERENCE_OP: VmPrimitiveReference = 31;
export const REIFY_U32_OP: VmReifyU32 = 32;
export const DUP_OP: VmDup = 33;
export const POP_OP: VmPop = 34;
export const LOAD_OP: VmLoad = 35;
export const FETCH_OP: VmFetch = 36;
export const ROOT_SCOPE_OP: VmRootScope = 37;
export const VIRTUAL_ROOT_SCOPE_OP: VmVirtualRootScope = 38;
export const CHILD_SCOPE_OP: VmChildScope = 39;
export const POP_SCOPE_OP: VmPopScope = 40;
export const TEXT_OP: VmText = 41;
export const COMMENT_OP: VmComment = 42;
export const APPEND_HTML_OP: VmAppendHTML = 43;
export const APPEND_SAFE_HTML_OP: VmAppendSafeHTML = 44;
export const APPEND_DOCUMENT_FRAGMENT_OP: VmAppendDocumentFragment = 45;
export const APPEND_NODE_OP: VmAppendNode = 46;
export const APPEND_TEXT_OP: VmAppendText = 47;
export const OPEN_ELEMENT_OP: VmOpenElement = 48;
export const OPEN_DYNAMIC_ELEMENT_OP: VmOpenDynamicElement = 49;
export const PUSH_REMOTE_ELEMENT_OP: VmPushRemoteElement = 50;
export const STATIC_ATTR_OP: VmStaticAttr = 51;
export const DYNAMIC_ATTR_OP: VmDynamicAttr = 52;
export const COMPONENT_ATTR_OP: VmComponentAttr = 53;
export const FLUSH_ELEMENT_OP: VmFlushElement = 54;
export const CLOSE_ELEMENT_OP: VmCloseElement = 55;
export const POP_REMOTE_ELEMENT_OP: VmPopRemoteElement = 56;
export const MODIFIER_OP: VmModifier = 57;
export const BIND_DYNAMIC_SCOPE_OP: VmBindDynamicScope = 58;
export const PUSH_DYNAMIC_SCOPE_OP: VmPushDynamicScope = 59;
export const POP_DYNAMIC_SCOPE_OP: VmPopDynamicScope = 60;
export const COMPILE_BLOCK_OP: VmCompileBlock = 61;
export const PUSH_BLOCK_SCOPE_OP: VmPushBlockScope = 62;
export const PUSH_SYMBOL_TABLE_OP: VmPushSymbolTable = 63;
export const INVOKE_YIELD_OP: VmInvokeYield = 64;
export const JUMP_IF_OP: VmJumpIf = 65;
export const JUMP_UNLESS_OP: VmJumpUnless = 66;
export const JUMP_EQ_OP: VmJumpEq = 67;
export const ASSERT_SAME_OP: VmAssertSame = 68;
export const ENTER_OP: VmEnter = 69;
export const EXIT_OP: VmExit = 70;
export const TO_BOOLEAN_OP: VmToBoolean = 71;
export const ENTER_LIST_OP: VmEnterList = 72;
export const EXIT_LIST_OP: VmExitList = 73;
export const ITERATE_OP: VmIterate = 74;
export const MAIN_OP: VmMain = 75;
export const CONTENT_TYPE_OP: VmContentType = 76;
export const CURRY_OP: VmCurry = 77;
export const PUSH_COMPONENT_DEFINITION_OP: VmPushComponentDefinition = 78;
export const PUSH_DYNAMIC_COMPONENT_INSTANCE_OP: VmPushDynamicComponentInstance = 79;
export const RESOLVE_DYNAMIC_COMPONENT_OP: VmResolveDynamicComponent = 80;
export const RESOLVE_CURRIED_COMPONENT_OP: VmResolveCurriedComponent = 81;
export const PUSH_ARGS_OP: VmPushArgs = 82;
export const PUSH_EMPTY_ARGS_OP: VmPushEmptyArgs = 83;
export const POP_ARGS_OP: VmPopArgs = 84;
export const PREPARE_ARGS_OP: VmPrepareArgs = 85;
export const CAPTURE_ARGS_OP: VmCaptureArgs = 86;
export const CREATE_COMPONENT_OP: VmCreateComponent = 87;
export const REGISTER_COMPONENT_DESTRUCTOR_OP: VmRegisterComponentDestructor = 88;
export const PUT_COMPONENT_OPERATIONS_OP: VmPutComponentOperations = 89;
export const GET_COMPONENT_SELF_OP: VmGetComponentSelf = 90;
export const GET_COMPONENT_TAG_NAME_OP: VmGetComponentTagName = 91;
export const GET_COMPONENT_LAYOUT_OP: VmGetComponentLayout = 92;
export const BIND_EVAL_SCOPE_OP: VmBindEvalScope = 93;
export const POPULATE_LAYOUT_OP: VmPopulateLayout = 95;
export const INVOKE_COMPONENT_LAYOUT_OP: VmInvokeComponentLayout = 96;
export const BEGIN_COMPONENT_TRANSACTION_OP: VmBeginComponentTransaction = 97;
export const COMMIT_COMPONENT_TRANSACTION_OP: VmCommitComponentTransaction = 98;
export const DID_CREATE_ELEMENT_OP: VmDidCreateElement = 99;
export const DID_RENDER_LAYOUT_OP: VmDidRenderLayout = 100;
export const DEBUGGER_OP: VmDebugger = 103;
export const VM_SIZE_OP: VmSize = 104;
export const STATIC_COMPONENT_ATTR_OP: VmStaticComponentAttr = 105;
export const DYNAMIC_CONTENT_TYPE_OP: VmDynamicContentType = 106;
export const DYNAMIC_HELPER_OP: VmDynamicHelper = 107;
export const DYNAMIC_MODIFIER_OP: VmDynamicModifier = 108;
export const IF_INLINE_OP: VmIfInline = 109;
export const NOT_OP: VmNot = 110;
export const GET_DYNAMIC_VAR_OP: VmGetDynamicVar = 111;
export const LOG_OP: VmLog = 112;
export const STRICT_STATIC_ATTR_OP: VmStrictStaticAttr = 113;
export const STRICT_DYNAMIC_ATTR_OP: VmStrictDynamicAttr = 114;
export const STRICT_COMPONENT_ATTR_OP: VmStrictComponentAttr = 115;
export const STRICT_STATIC_COMPONENT_ATTR_OP: VmStrictStaticComponentAttr = 116;

export function isMachineOp(value: number): value is VmMachineOp {
  return value >= 0 && value <= 15;
}

export function isOp(value: number): value is VmOp {
  return value >= 16;
}
