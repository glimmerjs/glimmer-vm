export { debug, debugSlice, logOpcode } from './lib/debug';
export * from './lib/metadata';
export { opcodeMetadata } from './lib/opcode-metadata';
export type { Checker } from './lib/stack-check';
export {
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
} from './lib/stack-check';
