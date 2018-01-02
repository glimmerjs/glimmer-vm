import { wasm, booted } from './lib/rust-wrapper';
import { LowLevelVM as WasmLowLevelVM } from './lib/rust';
import { WasmHeap } from './lib/rust';

export { wasm, booted, WasmLowLevelVM, WasmHeap };
