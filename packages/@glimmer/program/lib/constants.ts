import { CompileTimeConstants, ConstantPool, RuntimeConstants } from '@glimmer/interfaces';

export const WELL_KNOWN_EMPTY_ARRAY_POSITION = 0;
const WELL_KNOW_EMPTY_ARRAY = Object.freeze([]);

export class WriteOnlyConstants implements CompileTimeConstants {
  // `0` means NULL

  protected values: unknown[] = [WELL_KNOW_EMPTY_ARRAY];
  protected indexMap: Map<unknown, number> = new Map();

  value(value: unknown) {
    let indexMap = this.indexMap;
    let index = indexMap.get(value);

    if (index === undefined) {
      index = this.values.push(value) - 1;
      indexMap.set(value, index);
    }

    return index;
  }

  array(values: unknown[]): number {
    let handles: number[] = new Array(values.length);

    for (let i = 0; i < values.length; i++) {
      handles[i] = this.value(values[i]);
    }

    return this.value(handles);
  }

  serializable(value: unknown): number {
    let str = JSON.stringify(value);

    return this.value(str);
  }

  toPool(): ConstantPool {
    return this.values;
  }
}

export class RuntimeConstantsImpl implements RuntimeConstants {
  protected values: unknown[];

  constructor(pool: ConstantPool) {
    this.values = pool;
  }

  getValue<T>(handle: number) {
    return this.values[handle] as T;
  }

  getArray<T>(value: number): T[] {
    let handles = this.getValue(value) as number[];
    let reified: T[] = new Array(handles.length);

    for (let i = 0; i < handles.length; i++) {
      let n = handles[i];
      reified[i] = this.getValue(n);
    }

    return reified;
  }

  getSerializable<T>(s: number): T {
    return JSON.parse(this.values[s] as string) as T;
  }
}

export class JitConstants extends WriteOnlyConstants implements RuntimeConstants {
  protected reifiedArrs: unknown[][] = [WELL_KNOW_EMPTY_ARRAY as any];

  templateMeta(meta: unknown): number {
    return this.value(meta);
  }

  getValue<T>(index: number) {
    return this.values[index] as T;
  }

  getArray<T>(value: number): T[] {
    let reifiedArrs = this.reifiedArrs;
    let reified = reifiedArrs[value] as T[];

    if (reified === undefined) {
      let names: number[] = this.getValue(value);
      reified = new Array(names.length);

      for (let i = 0; i < names.length; i++) {
        reified[i] = this.getValue(names[i]);
      }

      reifiedArrs[value] = reified;
    }

    return reified;
  }

  getSerializable<T>(s: number): T {
    return JSON.parse(this.getValue(s)) as T;
  }
}
