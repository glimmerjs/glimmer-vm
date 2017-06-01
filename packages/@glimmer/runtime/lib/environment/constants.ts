import { VersionedPathReference } from "@glimmer/reference";
import { Opaque } from "@glimmer/interfaces";
import { DEBUG } from '@glimmer/local-debug-flags';

import { Block } from "../syntax/interfaces";

export type ConstantType = 'slice' | 'block' | 'reference' | 'string' | 'number' | 'expression';
export type ConstantReference =  number;
export type ConstantString = number;
export type ConstantExpression = number;
export type ConstantSlice = number;
export type ConstantBlock = number;
export type ConstantFunction = number;
export type ConstantArray = number;
export type ConstantOther = number;

export class Constants {
  // `0` means NULL

  private references: VersionedPathReference<Opaque>[] = [];
  private strings: string[];
  private expressions: Opaque[];
  private arrays: number[][];
  private blocks: Block[];
  private functions: Function[];
  private others: Opaque[];

  getReference<T extends Opaque>(value: ConstantReference): VersionedPathReference<T> {
    return this.references[value - 1] as VersionedPathReference<T>;
  }

  reference(value: VersionedPathReference<Opaque>): ConstantReference {
    let index = this.references.length;
    this.references.push(value);
    return index + 1;
  }

  getString(value: ConstantString): string {
    return this.strings[value - 1];
  }

  string(value: string): ConstantString {
    if (this.strings === undefined) {
      this.strings = [value];
      return 1;
    }

    let index = this.strings.length;
    this.strings.push(value);
    return index + 1;
  }

  getExpression<T>(value: ConstantExpression): T {
    return this.expressions[value - 1] as T;
  }

  getArray(value: ConstantArray): number[] {
    return this.arrays[value - 1];
  }

  getNames(value: ConstantArray): string[] {
    let _names: string[] = [];
    let names = this.getArray(value);

    for (let i = 0; i < names.length; i++) {
      let n = names[i];
      _names[i] = this.getString(n);
    }

    return _names;
  }

  array(values: number[]): ConstantArray {
    if (this.arrays === undefined) {
      this.arrays = [values];
      return 1;
    }

    let index = this.arrays.length;
    this.arrays.push(values);
    return index + 1;
  }

  getBlock(value: ConstantBlock): Block {
    return this.blocks[value - 1];
  }

  block(block: Block): ConstantBlock {
    if (this.blocks === undefined) {
      this.blocks = [block];
      return 1;
    }

    let index = this.blocks.length;
    this.blocks.push(block);
    return index + 1;
  }

  getFunction<T extends Function>(value: ConstantFunction): T {
    return this.functions[value - 1] as T;
  }

  function(f: Function): ConstantFunction {
    if (this.functions === undefined) {
      this.functions = [f];
      return 1;
    }

    let index = this.functions.length;
    this.functions.push(f);
    return index + 1;
  }

  getOther<T>(value: ConstantOther): T {
    return this.others[value - 1] as T;
  }

  other(other: Opaque): ConstantOther {
    if (this.others === undefined) {
      this.others = [other];
      return 1;
    }

    let index = this.others.length;
    this.others.push(other);
    return index + 1;
  }

  has(type: string) {
    if (DEBUG) {
      return this[`${type}s`] !== undefined;
    }

    return false;
  }

  reset() {
    if (this.strings !== undefined) { this.strings.length = 0; };
    if (this.blocks !== undefined) { this.blocks.length = 0; };
    if (this.expressions !== undefined) { this.expressions.length = 0; };
    if (this.arrays !== undefined) { this.arrays.length = 0; }
    if (this.functions !== undefined) { this.functions.length = 0; }
    if (this.references !== undefined) { this.references.length = 0; }
    if (this.others !== undefined) { this.others.length = 0; }
  }
}
