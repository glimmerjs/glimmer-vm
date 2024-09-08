import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';

import * as stackCheck /* {
  check,
  CheckArray,
  CheckBlockSymbolTable,
  CheckBoolean,
  CheckDict,
  CheckDocumentFragment,
  CheckElement,
  CheckFunction,
  CheckHandle,
  CheckInstanceof,
  CheckInterface,
  CheckMaybe,
  CheckNode,
  CheckNumber,
  CheckObject,
  CheckOption,
  CheckOr,
  CheckPrimitive,
  CheckProgramSymbolTable,
  CheckSafeString,
  CheckString,
  CheckUndefined,
  CheckUnknown,
  recordStackSize,
  wrap,
} */ from './lib/stack-check';

export { debug, debugSlice, logOpcode } from './lib/debug';
export type { Checker, SafeString } from './lib/stack-check';

const ident = <X>(x: any): NonNullable<X> => x;
const trueFn = () => true;

// TODO
export const wrap = stackCheck.wrap;
export const recordStackSize = stackCheck.recordStackSize;

export const check = LOCAL_DEBUG ? stackCheck.check : (x) => x;
export const CheckArray = LOCAL_DEBUG ? stackCheck.CheckArray : trueFn;
export const CheckBlockSymbolTable = LOCAL_DEBUG ? stackCheck.CheckBlockSymbolTable : trueFn;
export const CheckBoolean = LOCAL_DEBUG ? stackCheck.CheckBoolean : trueFn;
export const CheckDict = LOCAL_DEBUG ? stackCheck.CheckDict : trueFn;
export const CheckDocumentFragment = LOCAL_DEBUG ? stackCheck.CheckDocumentFragment : trueFn;
export const CheckElement = LOCAL_DEBUG ? stackCheck.CheckElement : trueFn;
export const CheckFunction = LOCAL_DEBUG ? stackCheck.CheckFunction : trueFn;
export const CheckHandle = LOCAL_DEBUG ? stackCheck.CheckHandle : trueFn;
export const CheckInstanceof = LOCAL_DEBUG ? stackCheck.CheckInstanceof : trueFn;
export const CheckInterface = LOCAL_DEBUG ? stackCheck.CheckInterface : trueFn;
export const CheckMaybe = LOCAL_DEBUG ? stackCheck.CheckMaybe : trueFn;
export const CheckNode = LOCAL_DEBUG ? stackCheck.CheckNode : trueFn;
export const CheckNumber = LOCAL_DEBUG ? stackCheck.CheckNumber : trueFn;
export const CheckObject = LOCAL_DEBUG ? stackCheck.CheckObject : trueFn;
export const CheckOption = LOCAL_DEBUG ? stackCheck.CheckOption : trueFn;
export const CheckOr = LOCAL_DEBUG ? stackCheck.CheckOr : trueFn;
export const CheckPrimitive = LOCAL_DEBUG ? stackCheck.CheckPrimitive : trueFn;
export const CheckProgramSymbolTable = LOCAL_DEBUG ? stackCheck.CheckProgramSymbolTable : trueFn;
export const CheckSafeString = LOCAL_DEBUG ? stackCheck.CheckSafeString : trueFn;
export const CheckString = LOCAL_DEBUG ? stackCheck.CheckString : trueFn;
export const CheckUndefined = LOCAL_DEBUG ? stackCheck.CheckUndefined : trueFn;
export const CheckUnknown = LOCAL_DEBUG ? stackCheck.CheckUnknown : trueFn;
