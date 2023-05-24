import type { EnvironmentDelegate } from '@glimmer/runtime';
import { assert, keys } from '@glimmer/util';

import type { ComponentKind } from '../components';
import { JitRenderDelegate } from '../modes/jit/delegate';
import { NodeJitRenderDelegate } from '../modes/node/env';
import type RenderDelegate from '../render-delegate';
import type { RenderDelegateOptions } from '../render-delegate';
import type { Count, IRenderTest, RenderTest } from '../render-test';
import { JitSerializationDelegate } from '../suites/custom-dom-helper';
import type { ComponentTestMeta, DeclaredComponentKind } from '../test-decorator';

export interface RenderTestConstructor<D extends RenderDelegate, T extends IRenderTest> {
  suiteName: string;
  new (delegate: D): T;
}

export interface RenderTestFunction extends TestFunction, ComponentTestMeta {}

export function isRenderTestFunction(test: unknown): test is RenderTestFunction {
  return isTestFunction(test);
}

export function jitSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>,
  options?: { componentModule?: boolean; env?: EnvironmentDelegate }
): void {
  return suite(klass, JitRenderDelegate, options);
}

jitSuite.todo = <T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>,
  options?: { componentModule?: boolean; env?: EnvironmentDelegate }
): void => {
  return suite.todo(klass, JitRenderDelegate, options);
};

export function nodeSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>,
  options?: { componentModule: boolean }
): void {
  return suite(klass, NodeJitRenderDelegate, options);
}

export function nodeComponentSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>
): void {
  return suite(klass, NodeJitRenderDelegate, { componentModule: true });
}

export function jitComponentSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>
): void {
  return suite(klass, JitRenderDelegate, { componentModule: true });
}

export function jitSerializeSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>,
  options?: { componentModule: boolean }
): void {
  return suite(klass, JitSerializationDelegate, options);
}

export interface RenderDelegateConstructor<Delegate extends RenderDelegate> {
  readonly isEager: boolean;
  readonly style: string;
  new (options?: RenderDelegateOptions): Delegate;
}

export function componentSuite<D extends RenderDelegate>(
  klass: RenderTestConstructor<D, IRenderTest>,
  Delegate: RenderDelegateConstructor<D>
): void {
  return suite(klass, Delegate, { componentModule: true });
}

componentSuite.pending = <D extends RenderDelegate>(
  klass: RenderTestConstructor<D, IRenderTest>,
  Delegate: RenderDelegateConstructor<D>
): void => {
  let suiteName = klass.suiteName;

  QUnit.module(`${Delegate.style} :: Components :: ${suiteName}`);

  QUnit.todo('pending', (assert) => {
    assert.ok(false, 'the entire suite is pending');
  });
};

export function suite<D extends RenderDelegate>(
  klass: RenderTestConstructor<D, IRenderTest>,
  Delegate: RenderDelegateConstructor<D>,
  options: { componentModule?: boolean; env?: EnvironmentDelegate } = {}
): void {
  let suiteName = klass.suiteName;

  if (options.componentModule) {
    if (shouldRunTest<D>(Delegate)) {
      componentModule(
        `${Delegate.style} :: Components :: ${suiteName}`,
        klass as any as RenderTestConstructor<D, RenderTest>,
        Delegate
      );
    }
  } else {
    let instance: IRenderTest | null = null;
    QUnit.module(`[integration] ${Delegate.style} :: ${suiteName}`, {
      beforeEach() {
        instance = new klass(new Delegate({ env: options.env }));
        if (instance.beforeEach) instance.beforeEach();
      },

      afterEach() {
        if (instance!.afterEach) instance!.afterEach();
        instance = null;
      },
    });

    for (let property in klass.prototype) {
      let test = klass.prototype[property];

      if (isTestFunction(test) && shouldRunTest<D>(Delegate)) {
        // eslint-disable-next-line no-loop-func
        QUnit[test.testModifier](property, (assert) => {
          test.call(instance!, assert, instance!.count);
          instance!.count.assert();
        });
      }
    }
  }
}

suite.todo = <D extends RenderDelegate>(
  klass: RenderTestConstructor<D, IRenderTest>,
  Delegate: RenderDelegateConstructor<D>,
  options: { componentModule?: boolean; env?: EnvironmentDelegate } = {}
): void => {
  let suiteName = klass.suiteName;

  if (options.componentModule) {
    // eslint-disable-next-line no-console
    console.warn(`TODO suites are not supported in component modules (try componentSuite.pending)`);
    QUnit.module(`${Delegate.style} :: Components :: ${suiteName}`);

    QUnit.todo('pending', (assert) => {
      assert.ok(false, 'the entire suite is pending');
    });
  } else {
    let instance: IRenderTest | null = null;
    QUnit.module(`[integration] ${Delegate.style} :: ${suiteName}`, {
      beforeEach() {
        instance = new klass(new Delegate({ env: options.env }));
        if (instance.beforeEach) instance.beforeEach();
      },
    });

    for (let property of Object.keys(klass.prototype)) {
      let desc = Object.getOwnPropertyDescriptor(klass.prototype, property);
      if (desc && isTestFunction(desc.value)) {
        desc.value.testModifier = 'todo';
      }
    }

    // for (let property in klass.prototype) {
    //   let test = klass.prototype[property];

    //   if (isTestFunction(test) && shouldRunTest<D>(Delegate)) {
    //     // eslint-disable-next-line no-loop-func
    //     QUnit[test.testModifier](property, (assert) => {
    //       test.call(instance!, assert, instance!.count);
    //       instance!.count.assert();
    //     });
    //   }
    // }
  }
};

type ComponentTestFunction<D extends RenderDelegate, T extends IRenderTest> = (
  type: ComponentKind,
  klass: RenderTestConstructor<D, T>
) => void;

class ComponentTests<D extends RenderDelegate, T extends IRenderTest> {
  readonly glimmer: ComponentTestFunction<D, T>[] = [];
  readonly curly: ComponentTestFunction<D, T>[] = [];
  readonly dynamic: ComponentTestFunction<D, T>[] = [];
  readonly templateOnly: ComponentTestFunction<D, T>[] = [];

  readonly #Delegate: RenderDelegateConstructor<D>;

  constructor(Delegate: RenderDelegateConstructor<D>) {
    this.#Delegate = Delegate;
  }

  withoutKind({
    skip,
    modifier,
    property,
    test,
  }: {
    skip: DeclaredComponentKind | boolean | undefined;
    modifier: 'test' | 'skip' | 'todo';
    property: PropertyKey;
    test: TestFunction;
  }) {
    if (typeof property !== 'string') return;

    switch (skip) {
      case 'glimmer':
        this.curly.push(this.#createTest(property, test));
        this.dynamic.push(this.#createTest(property, test));
        this.glimmer.push(this.#createTest(property, test, modifier));
        break;
      case 'curly':
        this.glimmer.push(this.#createTest(property, test));
        this.dynamic.push(this.#createTest(property, test));
        this.curly.push(this.#createTest(property, test, modifier));
        break;
      case 'dynamic':
        this.glimmer.push(this.#createTest(property, test));
        this.curly.push(this.#createTest(property, test));
        this.dynamic.push(this.#createTest(property, test, modifier));
        break;
      case true:
        if (test['kind'] === 'templateOnly') {
          this.templateOnly.push(this.#createTest(property, test, modifier));
        } else {
          for (let kind of ['glimmer', 'curly', 'dynamic']) {
            this[kind as DeclaredComponentKind].push(this.#createTest(property, test, modifier));
          }
        }
      default:
        this.glimmer.push(this.#createTest(property, test));
        this.curly.push(this.#createTest(property, test));
        this.dynamic.push(this.#createTest(property, test));
    }
  }

  addCurly({ property, test }: { property: PropertyKey; test: TestFunction }) {
    if (typeof property !== 'string') return;
    this.curly.push(this.#createTest(property, test));
    this.dynamic.push(this.#createTest(property, test));
  }

  addGlimmer({ property, test }: { property: PropertyKey; test: TestFunction }) {
    if (typeof property !== 'string') return;
    this.glimmer.push(this.#createTest(property, test));
  }

  addDynamic({ property, test }: { property: PropertyKey; test: TestFunction }) {
    if (typeof property !== 'string') return;
    this.curly.push(this.#createTest(property, test));
    this.dynamic.push(this.#createTest(property, test));
  }

  addTemplateOnly({ property, test }: { property: PropertyKey; test: TestFunction }) {
    if (typeof property !== 'string') return;
    this.templateOnly.push(this.#createTest(property, test));
  }

  #createTest(
    property: string,
    test: TestFunction,
    modifier = test.testModifier
  ): (type: ComponentKind, klass: RenderTestConstructor<D, T>) => void {
    let shouldSkip: boolean;

    return (type: ComponentKind, klass: RenderTestConstructor<D, T>) => {
      QUnit[modifier](property, (assert) => {
        let instance = new klass(new this.#Delegate());
        instance.testType = type;
        return test.call(instance, assert, instance.count);
      });
    };
  }
}

function componentModule<D extends RenderDelegate, T extends IRenderTest>(
  name: string,
  klass: RenderTestConstructor<D, T>,
  Delegate: RenderDelegateConstructor<D>
) {
  let tests = new ComponentTests(Delegate);

  for (let property in klass.prototype) {
    let test = klass.prototype[property] as TestFunction;

    if (isRenderTestFunction(test)) {
      if (test['kind'] === undefined) {
        tests.withoutKind({
          modifier: 'skip',
          skip: test['skip'],
          property: property,
          test,
        });
        continue;
      }

      let kind = test['kind'];

      if (kind === 'curly') {
        tests.addCurly({ property, test });
      }

      if (kind === 'glimmer') {
        tests.addGlimmer({ property, test });
      }

      if (kind === 'dynamic') {
        tests.addDynamic({ property, test });
      }

      if (kind === 'templateOnly') {
        tests.addTemplateOnly({ property, test });
      }
    }
  }
  QUnit.module(`[integration] ${name}`, () => {
    nestedComponentModules(klass, tests);
  });
}

function nestedComponentModules<D extends RenderDelegate, T extends IRenderTest>(
  klass: RenderTestConstructor<D, T>,
  tests: ComponentTests<D, T>
): void {
  for (let type of keys(tests)) {
    let formattedType = upperFirst(type) as ComponentKind;

    QUnit.module(`[integration] ${formattedType}`, () => {
      let allTests = [...tests[type]].reverse();

      for (let t of allTests) {
        t(formattedType, klass);
      }

      tests[type] = [];
    });
  }
}

function upperFirst<T extends string>(
  text: T extends '' ? `upperFirst only takes (statically) non-empty strings` : T
): string {
  let first = text[0] as string;
  let rest = text.slice(1);

  return `${first.toUpperCase()}${rest}`;
}

const HAS_TYPED_ARRAYS = typeof Uint16Array !== 'undefined';

function shouldRunTest<T extends RenderDelegate>(Delegate: RenderDelegateConstructor<T>) {
  let isEagerDelegate = Delegate['isEager'];

  if (HAS_TYPED_ARRAYS) {
    return true;
  }

  if (!HAS_TYPED_ARRAYS && !isEagerDelegate) {
    return true;
  }

  return false;
}

export type TestFunctionType = 'skip' | 'todo' | 'test';

export interface TestFunction {
  (this: IRenderTest, assert: typeof QUnit.assert, count?: Count): void;
  kind?: DeclaredComponentKind;
  isTest: true;
  testModifier: TestFunctionType;
}

export function isTestFunction(value: any): value is TestFunction {
  let isTest = typeof value === 'function' && value.isTest;

  if (isTest) {
    assert(
      'testModifier' in value,
      `bug: expected decorated test method to have a testModifier property. This is a bug in an internal test decorator`
    );
  }

  return isTest;
}
