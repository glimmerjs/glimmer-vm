import type { AnyFn, PresentArray } from '@glimmer/interfaces';
import QUnit from 'qunit';

import type { IBasicTest } from '../render-test';

import { Count, RecordEvents } from '../render-test';

export type VanillaTest = object | IBasicTest;

export interface TestFnMeta {
  test: AnyFn;
  qunit: QUnitTestFn;
  name: string;
}

function formatTitle(pkg: string, parts: PresentArray<string>): string {
  const [title, ...scopes] = parts;
  const msg = [`[${pkg}] ${title}`];

  if (scopes.length > 0) {
    msg.push(...scopes);
  }

  return msg.join(' :: ');
}

type On = { cleanup: (callback: Cleanup) => void };
type Cleanup = () => void | Promise<void>;
type TestInstance = Assert & { count: Count; on: On };
type TestMethod = (assert: TestInstance) => void | Promise<void>;

type QUnitTestFn = typeof QUnit.test | typeof QUnit.skip | typeof QUnit.todo;
const TEST_FNS = new WeakMap<object, TestFnMeta[]>();

type QUnitAssert = Parameters<Parameters<typeof QUnit.test>[1]>[0];
export type BasicTestConstructor<T extends IBasicTest = IBasicTest> = new (
  assert: QUnitAssert
) => T;

export const PackageSuite = (packageName: string) => {
  return (title: PresentArray<string>, build: (builder: BasicSuiteBuilder) => void) => {
    BasicSuiteBuilder.build(packageName, title, build);
  };
};

interface AssertInstance extends QUnitAssert {
  count: Count;
  on: On;
}

function assertProxy(assert: QUnitAssert): {
  instance: AssertInstance;
  count: Count;
  record: RecordEvents;
  cleanups: Set<Cleanup>;
} {
  const count = new Count();
  const record = new RecordEvents();
  const on = { cleanup: (callback: Cleanup) => cleanups.add(callback) };
  const cleanups = new Set<Cleanup>();

  const extras = {
    count,
    record,
    on,
  };

  const instance = new Proxy(assert, {
    get(target, prop, receiver) {
      if (Object.hasOwn(extras, prop)) {
        return Reflect.get(extras, prop, receiver);
      } else {
        return Reflect.get(target, prop, receiver);
      }
    },

    ownKeys(target) {
      return [...Reflect.ownKeys(target), ...Reflect.ownKeys(extras)];
    },

    has(target, prop) {
      return Reflect.has(target, prop) || Reflect.ownKeys(extras).includes(prop);
    },

    getOwnPropertyDescriptor(target, prop) {
      if (Object.hasOwn(extras, prop)) {
        return {
          configurable: true,
          writable: false,
          enumerable: true,
          get() {
            return extras[prop as keyof typeof extras];
          },
        };
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },

    getPrototypeOf(target) {
      return Reflect.getPrototypeOf(target);
    },
  }) as AssertInstance;

  return { instance, count, record, cleanups };
}

export class BasicSuiteBuilder {
  static build(
    this: void,
    pkg: string,
    title: PresentArray<string>,
    build: (builder: BasicSuiteBuilder) => void
  ) {
    const builder = new BasicSuiteBuilder();
    build(builder);

    for (const testMeta of builder.#tests) {
      QUnit.module(formatTitle(pkg, title), () => {
        testMeta.qunit(testMeta.name, async (assert: QUnitAssert) => {
          const { instance, count, record, cleanups } = assertProxy(assert);
          await testMeta.test.call(null, instance);

          for (const cleanup of cleanups) {
            await cleanup();
          }

          for (const cleanup of builder.#cleanups) {
            await cleanup();
          }

          count.assert();
          RecordEvents.expectNone(record);
        });
      });
    }
  }

  #cleanups = new Set<Cleanup>();
  #tests: TestFnMeta[] = [];

  cleanup(cleanup: Cleanup) {
    this.#cleanups.add(cleanup);
    return this;
  }

  test(name: string, method: TestMethod) {
    this.#tests.push({ test: method, qunit: QUnit.test, name });
    return this;
  }

  skip(name: string, method: TestMethod) {
    this.#tests.push({
      test: method,
      qunit: (...args: Parameters<typeof QUnit.skip>) => QUnit.skip(...args),
      name,
    });
    return this;
  }

  todo(name: string, method: TestMethod) {
    this.#tests.push({
      test: method,
      qunit: (...args: Parameters<typeof QUnit.todo>) => QUnit.todo(...args),
      name,
    });
    return this;
  }
}

export const BasicSuite = BasicSuiteBuilder.build;

export function getTestMetas(proto: object): TestFnMeta[] {
  return TEST_FNS.get(proto) ?? [];
}
