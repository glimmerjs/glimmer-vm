import { wasm, booted } from './lib/rust-wrapper';
import { LowLevelVM as WasmLowLevelVM } from './lib/rust';

export * from './lib/glue/storage';
export * from './lib/asm/stack';
export { wasm, booted, WasmLowLevelVM };
