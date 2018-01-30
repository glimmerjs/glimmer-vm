import { booted, memory as wasmMemory } from './lib/rust_wasm';
import { LowLevelVM as WasmLowLevelVM, WasmHeap, num_allocated } from './lib/rust';

export { booted, WasmLowLevelVM, WasmHeap, wasmMemory, num_allocated };
