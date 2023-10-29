export {
  debug,
  logOpcodeSlice,
  getOpSnapshot,
  type OpSnapshot,
  type DebugConstants,
  type RegisterName,
  type DebugOp,
  DisassembledOperand,
  type AnyOperand,
  type RawDisassembledOperand,
  type DynamicDisassembledOperand,
  type SomeDisassembledOperand,
  type StaticDisassembledOperand,
} from './lib/debug';
export * from './lib/metadata';
export { opcodeMetadata } from './lib/opcode-metadata';
export * from './lib/stack-check';
export * from './lib/snapshot';
export {
  frag,
  as,
  type IntoFragment,
  join,
  intoFragment,
  value,
  dom,
  empty,
} from './lib/render/presets';
export type { Fragment } from './lib/render/fragment';
export { DebugLogger } from './lib/render/lines';
export { SerializeBlockContext } from './lib/render/serialize';
export * from './lib/render/combinators';
export * from './lib/render/state';
