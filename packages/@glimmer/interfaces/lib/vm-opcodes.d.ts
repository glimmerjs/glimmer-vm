/* This file is generated by build/debug.js */

export type VmMachinePushFrame = 0;
export type VmMachinePopFrame = 1;
export type VmMachineInvokeVirtual = 2;
export type VmMachineInvokeStatic = 3;
export type VmMachineJump = 4;
export type VmMachineReturn = 5;
export type VmMachineReturnTo = 6;
export type VmMachineSize = 7;

export type VmMachineOp =
  | VmMachinePushFrame
  | VmMachinePopFrame
  | VmMachineInvokeVirtual
  | VmMachineInvokeStatic
  | VmMachineJump
  | VmMachineReturn
  | VmMachineReturnTo
  | VmMachineSize;
  
// DOM Opcodes
export type VmDomText = 28;
export type VmDomComment = 29;
export type VmDomOpenElement = 30;
export type VmDomOpenDynamicElement = 31;
export type VmDomFlushElement = 32;
export type VmDomCloseElement = 33;
export type VmDomStaticAttr = 34;
export type VmDomDynamicAttr = 35;
export type VmDomModifier = 36;
export type VmDomDynamicModifier = 37;
export type VmDomPushRemoteElement = 38;
export type VmDomPopRemoteElement = 39;

export type VmHelper = 16;
export type VmSetNamedVariables = 17;
export type VmSetBlocks = 18;
export type VmSetVariable = 19;
export type VmSetBlock = 20;
export type VmGetVariable = 21;
export type VmGetProperty = 22;
export type VmGetBlock = 23;
export type VmSpreadBlock = 24;
export type VmHasBlock = 25;
export type VmHasBlockParams = 26;
export type VmConcat = 27;
export type VmConstant = 28;
export type VmConstantReference = 29;
export type VmPrimitive = 30;
export type VmPrimitiveReference = 31;
export type VmReifyU32 = 32;
export type VmDup = 33;
export type VmPop = 34;
export type VmLoad = 35;
export type VmFetch = 36;
export type VmRootScope = 37;
export type VmVirtualRootScope = 38;
export type VmChildScope = 39;
export type VmPopScope = 40;
export type VmText = 41;
export type VmComment = 42;
export type VmAppendHTML = 43;
export type VmAppendSafeHTML = 44;
export type VmAppendDocumentFragment = 45;
export type VmAppendNode = 46;
export type VmAppendText = 47;
export type VmOpenElement = 48;
export type VmOpenDynamicElement = 49;
export type VmPushRemoteElement = 50;
export type VmStaticAttr = 51;
export type VmDynamicAttr = 52;
export type VmComponentAttr = 53;
export type VmFlushElement = 54;
export type VmCloseElement = 55;
export type VmPopRemoteElement = 56;
export type VmModifier = 57;
export type VmBindDynamicScope = 58;
export type VmPushDynamicScope = 59;
export type VmPopDynamicScope = 60;
export type VmCompileBlock = 61;
export type VmPushBlockScope = 62;
export type VmPushSymbolTable = 63;
export type VmInvokeYield = 64;
export type VmJumpIf = 65;
export type VmJumpUnless = 66;
export type VmJumpEq = 67;
export type VmAssertSame = 68;
export type VmEnter = 69;
export type VmExit = 70;
export type VmToBoolean = 71;
export type VmEnterList = 72;
export type VmExitList = 73;
export type VmIterate = 74;
export type VmMain = 75;
export type VmContentType = 76;
export type VmCurry = 77;
export type VmPushComponentDefinition = 78;
export type VmPushDynamicComponentInstance = 79;
export type VmResolveDynamicComponent = 80;
export type VmResolveCurriedComponent = 81;
export type VmPushArgs = 82;
export type VmPushEmptyArgs = 83;
export type VmPopArgs = 84;
export type VmPrepareArgs = 85;
export type VmCaptureArgs = 86;
export type VmCreateComponent = 87;
export type VmRegisterComponentDestructor = 88;
export type VmPutComponentOperations = 89;
export type VmGetComponentSelf = 90;
export type VmGetComponentTagName = 91;
export type VmGetComponentLayout = 92;
export type VmPopulateLayout = 95;
export type VmInvokeComponentLayout = 96;
export type VmBeginComponentTransaction = 97;
export type VmCommitComponentTransaction = 98;
export type VmDidCreateElement = 99;
export type VmDidRenderLayout = 100;
export type VmDebugger = 103;
export type VmStaticComponentAttr = 105;
export type VmDynamicContentType = 106;
export type VmDynamicHelper = 107;
export type VmDynamicModifier = 108;
export type VmIfInline = 109;
export type VmNot = 110;
export type VmGetDynamicVar = 111;
export type VmLog = 112;
export type VmSize = 113;

export type VmOp =
  | VmHelper
  | VmSetNamedVariables
  | VmSetBlocks
  | VmSetVariable
  | VmSetBlock
  | VmGetVariable
  | VmGetProperty
  | VmGetBlock
  | VmSpreadBlock
  | VmHasBlock
  | VmHasBlockParams
  | VmConcat
  | VmConstant
  | VmConstantReference
  | VmPrimitive
  | VmPrimitiveReference
  | VmReifyU32
  | VmDup
  | VmPop
  | VmLoad
  | VmFetch
  | VmRootScope
  | VmVirtualRootScope
  | VmChildScope
  | VmPopScope
  | VmText
  | VmComment
  | VmAppendHTML
  | VmAppendSafeHTML
  | VmAppendDocumentFragment
  | VmAppendNode
  | VmAppendText
  | VmOpenElement
  | VmOpenDynamicElement
  | VmPushRemoteElement
  | VmStaticAttr
  | VmDynamicAttr
  | VmComponentAttr
  | VmFlushElement
  | VmCloseElement
  | VmPopRemoteElement
  | VmModifier
  | VmBindDynamicScope
  | VmPushDynamicScope
  | VmPopDynamicScope
  | VmCompileBlock
  | VmPushBlockScope
  | VmPushSymbolTable
  | VmInvokeYield
  | VmJumpIf
  | VmJumpUnless
  | VmJumpEq
  | VmAssertSame
  | VmEnter
  | VmExit
  | VmToBoolean
  | VmEnterList
  | VmExitList
  | VmIterate
  | VmMain
  | VmContentType
  | VmCurry
  | VmPushComponentDefinition
  | VmPushDynamicComponentInstance
  | VmResolveDynamicComponent
  | VmResolveCurriedComponent
  | VmPushArgs
  | VmPushEmptyArgs
  | VmPopArgs
  | VmPrepareArgs
  | VmCaptureArgs
  | VmCreateComponent
  | VmRegisterComponentDestructor
  | VmPutComponentOperations
  | VmGetComponentSelf
  | VmGetComponentTagName
  | VmGetComponentLayout
  | VmPopulateLayout
  | VmInvokeComponentLayout
  | VmBeginComponentTransaction
  | VmCommitComponentTransaction
  | VmDidCreateElement
  | VmDidRenderLayout
  | VmDebugger
  | VmSize
  | VmStaticComponentAttr
  | VmDynamicContentType
  | VmDynamicHelper
  | VmDynamicModifier
  | VmIfInline
  | VmNot
  | VmGetDynamicVar
  | VmLog;

export type SomeVmOp = VmOp | VmMachineOp;
