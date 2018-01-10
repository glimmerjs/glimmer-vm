import { DEBUG } from '@glimmer/local-debug-flags';
import { Opaque } from '@glimmer/interfaces';
import { WasmLowLevelVM } from '@glimmer/low-level';
import { Context } from './gbox';

export default class EvaluationStack {
  private cx: Context;

  constructor(private wasmVM: WasmLowLevelVM) {
    this.cx = new Context();
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
    this.wasmVM.stack_write_raw(pos, this.cx.encode(value));
  }

  private read<T>(pos: number): T {
    return this.cx.decode(this.wasmVM.stack_read_raw(pos));
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
    this.wasmVM.stack_write_raw(++this.sp, this.cx.encode(value));
  }

  pushEncodedImmediate(value: number): void {
    this.wasmVM.stack_write_raw(++this.sp, value);
  }

  pushNull(): void {
    this.wasmVM.stack_write_raw(++this.sp, this.cx.nullValue());
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
