import type { AnyFn } from '@glimmer/interfaces';
import { localAssert } from '@glimmer/debug-util';
import { keys } from '@glimmer/util';

import type { Count, IBasicTest } from './render-test';

export type DeclaredComponentKind = 'glimmer' | 'curly' | 'dynamic' | 'templateOnly';

export interface ComponentTestMeta {
  kind?: DeclaredComponentKind;
  skip?: boolean | DeclaredComponentKind;
}

export interface TestFnMeta {
  test: AnyFn;
  qunit: QUnitTestFn;
  name: string;
}

type TestMethod = (assert: Assert & { count: Count }) => void | Promise<void>;

export type QUnitTestFn = typeof QUnit.test | typeof QUnit.skip | typeof QUnit.todo;
export const TEST_FNS = new WeakMap<object, TestFnMeta[]>();

export function test(meta: ComponentTestMeta): MethodDecorator;
export function test<T extends TestMethod>(
  _target: object | ComponentTestMeta,
  name?: string,
  descriptor?: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T> | void;
export function test(...args: any[]) {
  if (args.length === 1) {
    let meta: ComponentTestMeta = args[0];
    return (_target: object, _name: string, descriptor: PropertyDescriptor) => {
      let testFunction = descriptor.value;
      keys(meta).forEach((key) => (testFunction[key] = meta[key]));
      setTestingDescriptor(descriptor);
    };
  }

  let [target, name, descriptor] = args;
  setTestKind({
    callee: 'test',
    target,
    value: descriptor.value,
    kind: (...args: Parameters<typeof QUnit.test>) => QUnit.test(...args),
    name,
  });
  return descriptor;
}

test.skip = <T extends TypedPropertyDescriptor<TestMethod>>(
  target: IBasicTest,
  name: string,
  descriptor: T
) => {
  setTestKind({
    callee: 'test.skip',
    target,
    value: descriptor.value,
    kind: (...args: Parameters<typeof QUnit.skip>) => QUnit.skip(...args),
    name,
  });
  return descriptor;
};

test.todo = (target: IBasicTest, name: string, descriptor: PropertyDescriptor) => {
  setTestKind({
    callee: 'test.todo',
    target,
    value: descriptor.value,
    kind: (...args: Parameters<typeof QUnit.todo>) => QUnit.todo(...args),
    name,
  });
  return descriptor;
};

function setTestKind({
  callee,
  target,
  value,
  kind,
  name,
}: {
  callee: string;
  target: object;
  value: unknown;
  kind: QUnitTestFn;
  name: PropertyKey;
}) {
  localAssert(typeof value === 'function', `${callee} must be used on a method`);
  localAssert(typeof name === 'string', `${callee} must be used on a method with a string key`);
  const testFns = upsertTestFns(target);
  testFns.push({ test: value, qunit: kind, name });
}

function upsertTestFns(proto: object) {
  let testFns = TEST_FNS.get(proto);

  if (!testFns) {
    testFns = [];
    TEST_FNS.set(proto, testFns);
  }

  return testFns;
}

export function getTestMetas(proto: object): TestFnMeta[] {
  return TEST_FNS.get(proto) ?? [];
}

function setTestingDescriptor(descriptor: PropertyDescriptor): void {
  let testFunction = descriptor.value;
  descriptor.enumerable = true;
  testFunction['isTest'] = true;
}
