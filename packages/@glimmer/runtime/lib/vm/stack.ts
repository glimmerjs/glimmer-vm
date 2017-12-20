import { DEBUG } from '@glimmer/local-debug-flags';
import { Opaque } from '@glimmer/interfaces';
import { PrimitiveType } from '@glimmer/program';
import { unreachable } from '@glimmer/util';
import { wasm, Stack as WasmStack } from '@glimmer/low-level';

const HI   = 0x80000000;
const MASK = 0x7FFFFFFF;

export class InnerStack {
  private inner: WasmStack;
  private js: Opaque[] =[];

  constructor(stack: number) {
    this.inner = new WasmStack(stack);
  }

  sliceInner<T = Opaque>(start: number, end: number): T[] {
    let out = [];

    for (let i=start; i<end; i++) {
      out.push(this.get(i));
    }

    return out;
  }

  copy(from: number, to: number): void {
    this.inner.copy(from, to);
  }

  write(pos: number, value: Opaque): void {
    if (isImmediate(value)) {
      this.inner.writeRaw(pos, encodeImmediate(value));
    } else {
      let idx = this.js.length;
      this.js.push(value);
      this.inner.writeRaw(pos, idx | HI);
    }
  }

  writeSmi(pos: number, value: number): void {
    this.inner.writeSmi(pos, value);
  }

  writeImmediate(pos: number, value: number): void {
    this.inner.writeRaw(pos, value);
  }

  get<T>(pos: number): T {
    let value = this.inner.getRaw(pos);

    if (value & HI) {
      return this.js[value & MASK] as T;
    } else {
      return decodeImmediate(value) as any;
    }
  }

  getSmi(pos: number): number {
    return this.inner.getSmi(pos);
  }

  reset(): void {
    this.inner.reset();
  }

  dropWasm() {
    this.inner.dropWasm();
  }
}

export default class EvaluationStack {
  private stack: InnerStack;

  constructor(private wasmVM: number) {
    // TODO: this is super sketchy! We're extracing a borrowed pointer,
    // `wasm_stack`, from the actual `wasmVM` instance and then we're stashing
    // that away in a separate object so we can frob it as well. This isn't a
    // great interface because if the `wasmVM` is destroyed then it invalidates
    // the `wasm_stack`. Hopefully that doesn't happen?
    //
    // The memory here probably needs to be managed better either by creating a
    // fully owned copy like a `Rc` on the Rust side to send to our `InnerStack`
    // or otherwise the `wasm_stack` needs to stay encapsulated in the
    // `LowLevelVM`, the true owner of `wasmVM`.
    let wasm_stack = wasm.exports.low_level_vm_stack(wasmVM);
    this.stack = new InnerStack(wasm_stack);
    if (DEBUG) {
      Object.seal(this);
    }
  }

  restore(snapshot: Opaque[]): void {
    for (let i=0; i<snapshot.length; i++) {
      this.stack.write(i, snapshot[i]);
    }
    this.fp = 0;
    this.sp = snapshot.length - 1;
  }

  get fp(): number {
    return wasm.exports.low_level_vm_fp(this.wasmVM);
  }

  set fp(fp: number) {
    wasm.exports.low_level_vm_set_fp(this.wasmVM, fp);
  }

  get sp(): number {
    return wasm.exports.low_level_vm_sp(this.wasmVM);
  }

  set sp(sp: number) {
    wasm.exports.low_level_vm_set_sp(this.wasmVM, sp);
  }

  push(value: Opaque): void {
    this.stack.write(++this.sp, value);
  }

  pushSmi(value: number): void {
    this.stack.writeSmi(++this.sp, value);
  }

  pushImmediate(value: null | undefined | number | boolean): void {
    this.stack.writeImmediate(++this.sp, encodeImmediate(value));
  }

  pushEncodedImmediate(value: number): void {
    this.stack.writeImmediate(++this.sp, value);
  }

  pushNull(): void {
    this.stack.writeImmediate(++this.sp, Immediates.Null);
  }

  dup(position = this.sp): void {
    this.stack.copy(position, ++this.sp);
  }

  copy(from: number, to: number): void {
    this.stack.copy(from, to);
  }

  pop<T>(n = 1): T {
    let top = this.stack.get<T>(this.sp);
    this.sp -= n;
    return top;
  }

  popSmi(): number {
    return this.stack.getSmi(this.sp--);
  }

  peek<T>(offset = 0): T {
    return this.stack.get<T>(this.sp - offset);
  }

  peekSmi(offset = 0): number {
    return this.stack.getSmi(this.sp - offset);
  }

  get<T>(offset: number, base = this.fp): T {
    return this.stack.get<T>(base + offset);
  }

  getSmi(offset: number, base = this.fp): number {
    return this.stack.getSmi(base + offset);
  }

  set(value: Opaque, offset: number, base = this.fp) {
    this.stack.write(base + offset, value);
  }

  sliceArray<T = Opaque>(start: number, end: number): T[] {
    return this.stack.sliceInner(start, end);
  }

  capture(items: number): Opaque[] {
    let end = this.sp + 1;
    let start = end - items;
    return this.stack.sliceInner(start, end);
  }

  reset() {
    this.stack.reset();
  }

  toArray() {
    return this.stack.sliceInner(this.fp, this.sp + 1);
  }

  dropWasm() {
    // we don't actually own this, so we just forget about it.
    this.wasmVM = 0;
    this.stack.dropWasm();
  }
}

function isImmediate(value: Opaque): value is number | boolean | null | undefined {
  let type = typeof value;

  if (value === null || value === undefined) return true;

  switch (type) {
    case 'boolean':
    case 'undefined':
      return true;
    case 'number':
      // not an integer
      if (value as number % 1 !== 0) return false;

      let abs = Math.abs(value as number);

      // too big
      if (abs & HI) return false;

      return true;
    default:
      return false;
  }
}

export const enum Type {
  NUMBER          = 0b000,
  FLOAT           = 0b001,
  STRING          = 0b010,
  BOOLEAN_OR_VOID = 0b011,
  NEGATIVE        = 0b100
}

export const enum Immediates {
  False = 0 << 3 | Type.BOOLEAN_OR_VOID,
  True  = 1 << 3 | Type.BOOLEAN_OR_VOID,
  Null  = 2 << 3 | Type.BOOLEAN_OR_VOID,
  Undef = 3 << 3 | Type.BOOLEAN_OR_VOID
}

function encodeSmi(primitive: number) {
  if (primitive < 0) {
    return Math.abs(primitive) << 3 | PrimitiveType.NEGATIVE;
  } else {
    return primitive << 3 | PrimitiveType.NUMBER;
  }
}

function encodeImmediate(primitive: number | boolean | null | undefined): number {
  switch (typeof primitive) {
    case 'number':
      return encodeSmi(primitive as number);
    case 'boolean':
      return primitive ? Immediates.True : Immediates.False;
    case 'object':
      // assume null
      return Immediates.Null;
    case 'undefined':
      return Immediates.Undef;
    default:
      throw unreachable();
  }
}

function decodeSmi(smi: number): number {
  switch (smi & 0b111) {
    case PrimitiveType.NUMBER:
      return smi >> 3;
    case PrimitiveType.NEGATIVE:
      return -(smi >> 3);
    default:
      throw unreachable();
  }
}

function decodeImmediate(immediate: number): number | boolean | null | undefined {
  switch (immediate) {
    case Immediates.False: return false;
    case Immediates.True:  return true;
    case Immediates.Null:  return null;
    case Immediates.Undef: return undefined;
    default:
      return decodeSmi(immediate);
  }
}
