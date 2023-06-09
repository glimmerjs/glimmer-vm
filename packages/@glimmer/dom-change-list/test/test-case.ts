import type { Dict } from '@glimmer/interfaces';
import type {
  ComponentKind,
  Count,
  IRenderTest,
  TestFunction,
  TestFunctionType,
} from '@glimmer-workspace/integration-tests';
import { isTestFunction } from '@glimmer-workspace/integration-tests';
import { keys } from '@glimmer/util';

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

type MethodDecorator = <F extends Function>(value: F, context: ClassMethodDecoratorContext) => F;

function setupTest(type: TestFunctionType, ...args: any[]) {
  if (args.length === 1) {
    let [options] = args as [object];

    return <F extends Function>(testFunction: F, context: ClassMethodDecoratorContext) => {
      for (let key of keys(options)) {
        testFunction[key] = options[key];
      }

      context.addInitializer(function (this: any) {
        let desc = Object.getOwnPropertyDescriptor(this, context.name)!;
        setTestingDescriptor(desc, type);
      });
    };
  }

  let [testFunction, context] = args as [Function, ClassMethodDecoratorContext];
  context.addInitializer(function (this: any) {
    let desc = Object.getOwnPropertyDescriptor(this, context.name)!;
    setTestingDescriptor(desc, type);
  });
  return testFunction;
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

export abstract class TestCase implements IRenderTest {
  abstract count: Count;
  abstract testType: ComponentKind;
  before() {}

  run(test: TestFunction, assert: typeof QUnit.assert): void | Promise<void> {
    this.before();
    return test.call(this, assert);
  }
}
