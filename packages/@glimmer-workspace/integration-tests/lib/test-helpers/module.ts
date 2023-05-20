import type { EnvironmentDelegate } from '@glimmer/runtime';
import { keys } from '@glimmer/util';

import type { ComponentKind } from '../components';
import { JitRenderDelegate } from '../modes/jit/delegate';
import { NodeJitRenderDelegate } from '../modes/node/env';
import type RenderDelegate from '../render-delegate';
import type { RenderDelegateOptions } from '../render-delegate';
import type { Count, IRenderTest, RenderTest } from '../render-test';
import { JitSerializationDelegate } from '../suites/custom-dom-helper';
import type { DeclaredComponentKind } from '../test-decorator';

export interface RenderTestConstructor<D extends RenderDelegate, T extends IRenderTest> {
  suiteName: string;
  new (delegate: D): T;
}

export function jitSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>,
  options?: { componentModule?: boolean; env?: EnvironmentDelegate }
): void {
  return suite(klass, JitRenderDelegate, options);
}

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
        if (isSkippedTest(test)) {
          // eslint-disable-next-line no-loop-func
          QUnit.skip(property, (assert) => {
            test.call(instance!, assert, instance!.count);
            instance!.count.assert();
          });
        } else {
          // eslint-disable-next-line no-loop-func
          QUnit.test(property, (assert) => {
            let result = test.call(instance!, assert, instance!.count);
            instance!.count.assert();
            return result;
          });
        }
      }
    }
  }
}

function componentModule<D extends RenderDelegate, T extends IRenderTest>(
  name: string,
  klass: RenderTestConstructor<D, T>,
  Delegate: RenderDelegateConstructor<D>
) {
  let tests: ComponentTests = {
    glimmer: [],
    curly: [],
    dynamic: [],
    templateOnly: [],
  };

  function createTest(property: string, test: any, skip?: boolean) {
    let shouldSkip: boolean;
    if (skip === true || test.skip === true) {
      shouldSkip = true;
    }

    return (type: ComponentKind, klass: RenderTestConstructor<D, T>) => {
      if (!shouldSkip) {
        QUnit.test(property, (assert) => {
          let instance = new klass(new Delegate());
          instance.testType = type;
          return test.call(instance, assert, instance.count);
        });
      }
    };
  }

  for (let property in klass.prototype) {
    let test = klass.prototype[property];
    if (isTestFunction(test)) {
      if (test['kind'] === undefined) {
        let skip = test['skip'];
        switch (skip) {
          case 'glimmer':
            tests.curly.push(createTest(property, test));
            tests.dynamic.push(createTest(property, test));
            tests.glimmer.push(createTest(property, test, true));
            break;
          case 'curly':
            tests.glimmer.push(createTest(property, test));
            tests.dynamic.push(createTest(property, test));
            tests.curly.push(createTest(property, test, true));
            break;
          case 'dynamic':
            tests.glimmer.push(createTest(property, test));
            tests.curly.push(createTest(property, test));
            tests.dynamic.push(createTest(property, test, true));
            break;
          case true:
            if (test['kind'] === 'templateOnly') {
              tests.templateOnly.push(createTest(property, test, true));
            } else {
              for (let kind of ['glimmer', 'curly', 'dynamic']) {
                tests[kind as DeclaredComponentKind].push(createTest(property, test, true));
              }
            }
          default:
            tests.glimmer.push(createTest(property, test));
            tests.curly.push(createTest(property, test));
            tests.dynamic.push(createTest(property, test));
        }
        continue;
      }

      let kind = test['kind'];

      if (kind === 'curly') {
        tests.curly.push(createTest(property, test));
        tests.dynamic.push(createTest(property, test));
      }

      if (kind === 'glimmer') {
        tests.glimmer.push(createTest(property, test));
      }

      if (kind === 'dynamic') {
        tests.curly.push(createTest(property, test));
        tests.dynamic.push(createTest(property, test));
      }

      if (kind === 'templateOnly') {
        tests.templateOnly.push(createTest(property, test));
      }
    }
  }
  QUnit.module(`[integration] ${name}`, () => {
    nestedComponentModules(klass, tests);
  });
}

interface ComponentTests {
  glimmer: Function[];
  curly: Function[];
  dynamic: Function[];
  templateOnly: Function[];
}

function nestedComponentModules<D extends RenderDelegate, T extends IRenderTest>(
  klass: RenderTestConstructor<D, T>,
  tests: ComponentTests
): void {
  for (let type of keys(tests)) {
    let formattedType = upperFirst(type);

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

interface TestFunction {
  (this: IRenderTest, assert: typeof QUnit.assert, count?: Count): void;
  kind?: DeclaredComponentKind;
  skip?: boolean | DeclaredComponentKind;
}

function isTestFunction(value: any): value is TestFunction {
  return typeof value === 'function' && value.isTest;
}

function isSkippedTest(value: any): boolean {
  return typeof value === 'function' && value.skip;
}
