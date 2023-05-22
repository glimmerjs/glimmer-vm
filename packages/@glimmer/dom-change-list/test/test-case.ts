import type { Dict } from '@glimmer/interfaces';
import type { TestFunction, TestFunctionType } from '@glimmer-workspace/integration-tests';
import { isTestFunction } from '@glimmer-workspace/integration-tests';

// A bunch of this file was extracted from the Glimmer testing harness.
// TODO: Clean this up and eliminate anything that isn't generically unnecessary.

function setTestingDescriptor(
  descriptor: PropertyDescriptor,
  testModifier: TestFunctionType
): void {
  let testFunction = descriptor.value as TestFunction;
  descriptor.enumerable = true;
  testFunction['isTest'] = true;
  testFunction['testModifier'] = testModifier;
}

export function test(meta: Dict<unknown>): MethodDecorator;
export function test(a: unknown, b: unknown): () => VoidFunction;
export function test<T>(
  _target: object,
  _name: string,
  descriptor?: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T> | void;
export function test(...args: any[]) {
  return setupTest('test', ...args);
}

test.skip = (...args: any[]) => {
  return setupTest('skip', ...args);
};

test.todo = (...args: any[]) => {
  return setupTest('todo', ...args);
};

function setupTest(type: TestFunctionType, ...args: any[]) {
  if (args.length === 1) {
    let meta: Dict<unknown> = args[0];
    return (_target: Object, _name: string, descriptor: PropertyDescriptor) => {
      let testFunction = descriptor.value;
      for (let key of Object.keys(meta)) testFunction[key] = meta[key];
      setTestingDescriptor(descriptor, type);
    };
  }

  let descriptor = args[2];
  setTestingDescriptor(descriptor, type);
  return descriptor;
}

export interface Constructor<T = unknown, Prototype = T> {
  new (...args: any[]): T;
  prototype: Prototype;
}

export function describe(name: string): (klass: new () => TestCase, other: unknown) => void {
  return function (klass: new () => TestCase) {
    QUnit.module(name);

    let proto = klass.prototype as Dict<unknown>;
    for (let property in proto) {
      // eslint-disable-next-line prefer-let/prefer-let
      const test = proto[property];

      if (isTestFunction(test)) {
        if (test.testModifier) {
          QUnit[test.testModifier](property, (assert) => new klass().run(test, assert));
        } else {
          QUnit.test(property, (assert) => new klass().run(test, assert));
        }
      }
    }
  };
}

export abstract class TestCase {
  before() {}

  run(test: TestFunction, assert: typeof QUnit.assert): void | Promise<void> {
    this.before();
    return test.call(this, assert);
  }
}
