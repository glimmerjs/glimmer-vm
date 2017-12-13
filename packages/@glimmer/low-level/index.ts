import { wasm } from './lib/rust-wrapper';
import * as wasm_wrapper from './lib/rust-wrapper';

export * from './lib/glue/storage';
export * from './lib/asm/stack';
export { wasm, wasm_wrapper };
