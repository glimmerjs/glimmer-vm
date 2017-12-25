import { DEBUG } from '@glimmer/local-debug-flags';
import { Opaque } from '@glimmer/interfaces';
import { PrimitiveType } from '@glimmer/program';
import { unreachable } from '@glimmer/util';
import { WasmLowLevelVM } from '@glimmer/low-level';

const HI   = 0x80000000;
const MASK = 0x7FFFFFFF;

export default class EvaluationStack {
  private js: Opaque[] = [];

  constructor(private wasmVM: WasmLowLevelVM) {
    if (DEBUG) {
      Object.seal(this);
    }
  }

  restore(snapshot: Opaque[]): void {
    for (let i=0; i<snapshot.length; i++) {
      this.write(i, snapshot[i]);
    }
    this.fp = 0;
    this.sp = snapshot.length - 1;
  }

  get fp(): number {
    return this.wasmVM.fp();
  }

  set fp(fp: number) {
    this.wasmVM.set_fp(fp);
  }

  get sp(): number {
    return this.wasmVM.sp();
  }

  set sp(sp: number) {
    this.wasmVM.set_sp(sp);
  }

  private write(pos: number, value: Opaque): void {
    if (isImmediate(value)) {
      this.wasmVM.stack_write_raw(pos, encodeImmediate(value));
    } else {
      let idx = this.js.length;
      this.js.push(value);
      this.wasmVM.stack_write_raw(pos, idx | HI);
    }
  }

  private read<T>(pos: number): T {
    let value = this.wasmVM.stack_read_raw(pos);

    if (value & HI) {
      return this.js[value & MASK] as T;
    } else {
      return decodeImmediate(value) as any;
    }
  }

  private slice<T = Opaque>(start: number, end: number): T[] {
    let out = [];

    for (let i=start; i<end; i++) {
      out.push(this.read(i));
    }

    return out;
  }

  push(value: Opaque): void {
    this.write(++this.sp, value);
  }

  pushSmi(value: number): void {
    this.wasmVM.stack_write(++this.sp, value);
  }

  pushImmediate(value: null | undefined | number | boolean): void {
    this.wasmVM.stack_write_raw(++this.sp, encodeImmediate(value));
  }

  pushEncodedImmediate(value: number): void {
    this.wasmVM.stack_write_raw(++this.sp, value);
  }

  pushNull(): void {
    this.wasmVM.stack_write_raw(++this.sp, Immediates.Null);
  }

  dup(position = this.sp): void {
    this.wasmVM.stack_copy(position, ++this.sp);
  }

  copy(from: number, to: number): void {
    this.wasmVM.stack_copy(from, to);
  }

  pop<T>(n = 1): T {
    let top = this.read<T>(this.sp);
    this.sp -= n;
    return top;
  }

  popSmi(): number {
    return this.wasmVM.stack_read(this.sp--);
  }

  peek<T>(offset = 0): T {
    return this.read<T>(this.sp - offset);
  }

  peekSmi(offset = 0): number {
    return this.wasmVM.stack_read(this.sp - offset);
  }

  get<T>(offset: number, base = this.fp): T {
    return this.read<T>(base + offset);
  }

  getSmi(offset: number, base = this.fp): number {
    return this.wasmVM.stack_read(base + offset);
  }

  set(value: Opaque, offset: number, base = this.fp) {
    this.write(base + offset, value);
  }

  sliceArray<T = Opaque>(start: number, end: number): T[] {
    return this.slice(start, end);
  }

  capture(items: number): Opaque[] {
    let end = this.sp + 1;
    let start = end - items;
    return this.slice(start, end);
  }

  toArray() {
    return this.slice(this.fp, this.sp + 1);
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
