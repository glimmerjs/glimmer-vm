import { debugAssert as assert } from './assert';

export interface Checker {
  validate(value: any): boolean;
  throw(value: any, message?: string): void;
}

export abstract class Check implements Checker {
  abstract validate(value: any): boolean;
  throw(value: any, message: string) {
    assert(message, 'Must pass a message from subclasses');
    throw new Error(`Expecting the value to be ${message} but instead got ${String(value)}.`);
  }
  type(value: any) { return typeof value; }
}

export function stackCheck<T>(value: T, checker: Checker): boolean | void {
  let valid = checker.validate(value);
  if (valid) return true;
  checker.throw(value);
}
