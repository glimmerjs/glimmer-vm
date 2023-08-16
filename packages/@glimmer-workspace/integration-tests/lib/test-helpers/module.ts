import type { EnvironmentDelegate } from '@glimmer/runtime';

import type { RenderDelegate, RenderDelegateOptions } from '../render-delegate';
import type { IRenderTest, RenderTestContext } from '../render-test';
import type { ComponentTestFunction, ComponentTestMeta, RenderSuiteMeta } from '../test-decorator';
import type { DeclaredComponentType } from './constants';

import { ClientSideRenderDelegate, ErrorRecoveryRenderDelegate } from '../modes/jit/delegate';
import { NodeJitRenderDelegate } from '../modes/node/env';
import { Count } from '../render-test';
import { JitSerializationDelegate } from '../suites/custom-dom-helper';
import {
  getComponentTestMeta,
  getSuiteMetadata,
  isComponentTest,
  isSuite,
} from '../test-decorator';
import { RecordedEvents } from './recorded';

export interface RenderTestConstructor<D extends RenderDelegate, T extends IRenderTest> {
  suiteName?: string;
  new (delegate: D, context: RenderTestState): T;
}

export function jitSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>,
  options?: { componentModule?: boolean; test?: ['error-recovery']; env?: EnvironmentDelegate }
): void {
  testSuite(klass, ClientSideRenderDelegate, options);

  if (options?.test?.includes('error-recovery')) {
    testSuite(klass, ErrorRecoveryRenderDelegate);
  }
}

export function nodeSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>,
  options = { componentModule: false }
): void {
  return testSuite(klass, NodeJitRenderDelegate, options);
}

export function nodeComponentSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>
): void {
  return testSuite(klass, NodeJitRenderDelegate, { componentModule: true });
}

export function jitComponentSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>
): void {
  return testSuite(klass, ClientSideRenderDelegate, { componentModule: true });
}

export function jitSerializeSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>,
  options = { componentModule: false }
): void {
  return testSuite(klass, JitSerializationDelegate, options);
}

export interface RenderDelegateConstructor<Delegate extends RenderDelegate> {
  readonly style: string;
  new (options?: RenderDelegateOptions): Delegate;
}

export function componentSuite<D extends RenderDelegate>(
  klass: RenderTestConstructor<D, IRenderTest>,
  Delegate: RenderDelegateConstructor<D>
): void {
  return testSuite(klass, Delegate, { componentModule: true });
}

export function testSuite<D extends RenderDelegate>(
  Class: RenderTestConstructor<D, IRenderTest>,
  Delegate: RenderDelegateConstructor<D>,
  options: { componentModule?: boolean; env?: EnvironmentDelegate } = {}
): void {
  if (options.componentModule) {
    componentModule(
      `${Delegate.style} :: Components :: ${TestBlueprint.suiteName(Class)}`,
      Class as any as RenderTestConstructor<D, RenderTestContext>,
      Delegate
    );
  } else {
    QUnit.module(`[integration] ${Delegate.style} :: ${TestBlueprint.suiteName(Class)}`);

    for (let prop in Class.prototype) {
      const test = Class.prototype[prop];
      const blueprint = TestBlueprint.for(Class, Delegate);

      if (isComponentTest(test)) {
        const meta = getComponentTestMeta(test);

        const CASES = blueprint.filtered(meta).map((types) => {
          return {
            types,
            test: blueprint.createTestFn(test, types),
          };
        });

        for (const { types, test: testCase } of CASES) {
          if (meta.skip) {
            QUnit.skip(`${formatTypes(types)}: ${prop}`, testCase);
          } else {
            QUnit.test(`${formatTypes(types)}: ${prop}`, testCase);
          }
        }
      }
    }
  }
}

function formatTypes(types: RenderTestTypes): string {
  if (types.invoker === types.template) {
    return types.invoker;
  } else {
    return `${types.template} (invoked by ${types.invoker})`;
  }
}

export interface RenderTestState<
  Template extends DeclaredComponentType = DeclaredComponentType,
  Invoker extends DeclaredComponentType = Template,
> extends Assert {
  readonly count: Count;
  readonly events: RecordedEvents;
  readonly types: {
    readonly template: Template;
    readonly invoker: Invoker;
  };
}

export interface RenderTestTypes {
  readonly template: DeclaredComponentType;
  readonly invoker: DeclaredComponentType;
}

export function RenderTestState(
  assert: Assert,
  specifiedTypes: RenderTestTypes | DeclaredComponentType
): RenderTestState {
  const events = new RecordedEvents();

  const types =
    typeof specifiedTypes === 'string'
      ? { template: specifiedTypes, invoker: specifiedTypes }
      : specifiedTypes;

  return new Proxy(
    { assert, count: new Count(events), events, types },
    {
      get({ assert, count, types }, prop, receiver) {
        switch (prop) {
          case 'count':
            return count;
          case 'events':
            return events;
          case 'types':
            return types;
          default:
            return Reflect.get(assert, prop, receiver);
        }
      },
    }
  ) as unknown as RenderTestState;
}

type TestFn = () => void;

export class TestBlueprint<D extends RenderDelegate, T extends IRenderTest> {
  static for<D extends RenderDelegate, T extends IRenderTest>(
    Class: RenderTestConstructor<D, T>,
    Delegate: RenderDelegateConstructor<D>
  ) {
    return new TestBlueprint(Class, Delegate);
  }

  static suiteName<D extends RenderDelegate, T extends IRenderTest>(
    Class: RenderTestConstructor<D, T>
  ) {
    if (isSuite(Class)) {
      return getSuiteMetadata(Class).description;
    } else if (Class.suiteName) {
      return Class.suiteName;
    } else {
      throw Error(`Could not find suite name for ${Class.name}`);
    }
  }

  #Class: RenderTestConstructor<D, T>;
  #Delegate: RenderDelegateConstructor<D>;
  #suite: RenderSuiteMeta;

  private constructor(Class: RenderTestConstructor<D, T>, Delegate: RenderDelegateConstructor<D>) {
    this.#Class = Class;
    this.#Delegate = Delegate;

    if (isSuite(Class)) {
      this.#suite = getSuiteMetadata(Class);
    } else {
      this.#suite = { description: Class.suiteName ?? Class.name };
    }
  }

  get suiteName() {
    return this.#suite.description;
  }

  filtered(meta: ComponentTestMeta): readonly RenderTestTypes[] {
    const included = EXPANSIONS[meta.kind ?? this.#suite.kind ?? 'all'];
    const excluded = new Set(expandSkip(meta.skip));

    return included
      .filter((kind) => !excluded.has(kind))
      .map((kind) => ({ invoker: meta.invokeAs ?? kind, template: kind }));
  }

  createTestFn(
    test: ComponentTestFunction,
    types: RenderTestTypes
  ): (assert: Assert) => void | Promise<void> {
    return (assert) => {
      const instance = new this.#Class(new this.#Delegate(), RenderTestState(assert, types));
      instance.beforeEach?.();

      try {
        const result = test.call(instance, instance.context);

        if (result === undefined) {
          instance.context.count.assert();
        } else {
          return result.then(() => {
            instance.context.count.assert();
          });
        }
      } finally {
        instance.afterEach?.();
      }
    };
  }

  createTest(types: RenderTestTypes, description: string, test: unknown): TestFn | undefined {
    if (!isComponentTest(test)) return;

    return () => {
      QUnit.test(
        `${types.invoker !== types.template ? formatTypes(types) : ''} ${description}`,
        this.createTestFn(test, types)
      );
    };
  }
}

class ComponentTests<D extends RenderDelegate, T extends IRenderTest> {
  readonly #blueprint: TestBlueprint<D, T>;
  readonly #tests: { types: RenderTestTypes; test: TestFn }[] = [];

  constructor(blueprint: TestBlueprint<D, T>) {
    this.#blueprint = blueprint;
  }

  *[Symbol.iterator](): IterableIterator<readonly [DeclaredComponentType, TestFn[]]> {
    for (const type of ['curly', 'glimmer', 'dynamic', 'templateOnly'] as const) {
      yield [
        type,
        this.#tests.filter((t) => t.types.template === type).map((t) => t.test),
      ] as const;
    }
  }

  add(kinds: readonly RenderTestTypes[], { prop, test }: { prop: string; test: unknown }) {
    for (const types of kinds) {
      const testFn = this.#blueprint.createTest(types, prop, test);
      if (testFn) {
        this.#tests.push({ types, test: testFn });
      }
    }
  }
}

export type ExpandType<K extends DeclaredComponentType | 'all'> = EXPANSIONS[K][number];

const EXPANSIONS = {
  curly: ['curly', 'dynamic'],
  glimmer: ['glimmer', 'templateOnly'],
  dynamic: ['dynamic'],
  templateOnly: ['templateOnly'],
  all: ['curly', 'glimmer', 'dynamic', 'templateOnly'],
} as const;
type EXPANSIONS = typeof EXPANSIONS;

function expandSkip(
  kind: DeclaredComponentType | boolean | undefined
): readonly DeclaredComponentType[] {
  if (kind === false || kind === undefined) {
    return [];
  } else if (kind === true) {
    return ['glimmer', 'curly', 'dynamic'];
  } else {
    return EXPANSIONS[kind];
  }
}

function componentModule<D extends RenderDelegate, T extends IRenderTest>(
  name: string,
  Class: RenderTestConstructor<D, T>,
  Delegate: RenderDelegateConstructor<D>
) {
  const blueprint = TestBlueprint.for(Class, Delegate);
  const tests = new ComponentTests(blueprint);

  for (let prop in Class.prototype) {
    const test = Class.prototype[prop];
    if (isComponentTest(test)) {
      const meta = getComponentTestMeta(test);
      const filtered = blueprint.filtered(meta);
      tests.add(filtered, { prop, test });
    }
  }
  QUnit.module(`[integration] ${name}`, () => {
    nestedComponentModules(tests);
  });
}

function nestedComponentModules<D extends RenderDelegate, T extends IRenderTest>(
  modules: ComponentTests<D, T>
): void {
  for (const [type, tests] of modules) {
    QUnit.module(`[integration] ${type}`, () => {
      for (const test of tests) {
        test();
      }
    });
  }
}
