import { Opaque } from "@glimmer/interfaces";
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

  private strings: string[] = [];
  private arrays: number[][] = [];
  private blocks: Block[] = [];
  private functions: Function[] = [];
  private others: Opaque[] = [];

  getString(value: ConstantString): string {
    return this.strings[value - 1];
  }

  string(value: string): ConstantString {
    let index = this.strings.length;
    this.strings.push(value);
    return index + 1;
  }

  getArray(value: ConstantArray): number[] {
    return this.arrays[value - 1];
  }

  array(values: number[]): ConstantArray {
    let index = this.arrays.length;
    this.arrays.push(values);
    return index + 1;
  }

  getBlock(value: ConstantBlock): Block {
    return this.blocks[value - 1];
  }

  block(block: Block): ConstantBlock {
    let index = this.blocks.length;
    this.blocks.push(block);
    return index + 1;
  }

  getFunction<T extends Function>(value: ConstantFunction): T {
    return this.functions[value - 1] as T;
  }

  function(f: Function): ConstantFunction {
    let index = this.functions.length;
    this.functions.push(f);
    return index + 1;
  }

  getOther<T>(value: ConstantOther): T {
    return this.others[value - 1] as T;
  }

  other(other: Opaque): ConstantOther {
    let index = this.others.length;
    this.others.push(other);
    return index + 1;
  }
}
