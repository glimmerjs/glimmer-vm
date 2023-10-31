import type { EnvironmentDelegate } from '@glimmer/runtime';
import { entries } from '@glimmer/util';

import type { ComponentKind } from '../components';
import { JitRenderDelegate } from '../modes/jit/delegate';
import { NodeJitRenderDelegate } from '../modes/node/env';
import type RenderDelegate from '../render-delegate';
import type { RenderDelegateOptions } from '../render-delegate';
import { Count, type IRenderTest, type RenderTest } from '../render-test';
import { JitSerializationDelegate } from '../suites/custom-dom-helper';
import {
  isComponentTest,
  type DeclaredComponentKind,
  getComponentTestMeta,
  type RenderSuiteMeta,
  isSuite,
  getSuiteMetadata,
  type ComponentTestMeta,
  type ComponentTestFunction,
} from '../test-decorator';
import { RecordedEvents } from './recorded';

export interface RenderTestConstructor<D extends RenderDelegate, T extends IRenderTest> {
  suiteName?: string;
  new (delegate: D, context: RenderTestContext): T;
}

export function jitSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>,
  options?: { componentModule?: boolean; env?: EnvironmentDelegate }
): void {
  return suite(klass, JitRenderDelegate, options);
}

export function nodeSuite<T extends IRenderTest>(
  klass: RenderTestConstructor<RenderDelegate, T>,
  options = { componentModule: false }
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
  options = { componentModule: false }
): void {
  return suite(klass, JitSerializationDelegate, options);
}

export interface RenderDelegateConstructor<Delegate extends RenderDelegate> {
  readonly style: string;
  new (options?: RenderDelegateOptions): Delegate;
}

export function componentSuite<D extends RenderDelegate>(
  klass: RenderTestConstructor<D, IRenderTest>,
  Delegate: RenderDelegateConstructor<D>
): void {
  return suite(klass, Delegate, { componentModule: true });
}

const INSTANCES = new Map<string, Map<ComponentKind, IRenderTest>>();

export function suite<D extends RenderDelegate>(
  Class: RenderTestConstructor<D, IRenderTest>,
  Delegate: RenderDelegateConstructor<D>,
  options: { componentModule?: boolean; env?: EnvironmentDelegate } = {}
): void {
  if (options.componentModule) {
    componentModule(
      `${Delegate.style} :: Components :: ${TestBlueprint.suiteName(Class)}`,
      Class as any as RenderTestConstructor<D, RenderTest>,
      Delegate
    );
  } else {
    QUnit.module(`[integration] ${Delegate.style} :: ${TestBlueprint.suiteName(Class)}`, {
      // beforeEach(assert) {
      //   const instance = new Class(
      //     new Delegate({ env: options.env }),
      //     RenderTestContext(assert, 'Glimmer')
      //   );
      //   setInstance('Glimmer', instance);
      //   QUnit.config.current['instance'] = instance;
      //   if (instance.beforeEach) instance.beforeEach();
      // },
      // afterEach() {
      //   const instance = getInstance('Glimmer');
      //   if (instance?.afterEach) instance?.afterEach();
      //   deleteInstance('Glimmer');
      // },
    });

    for (let prop in Class.prototype) {
      const test = Class.prototype[prop];
      const blueprint = TestBlueprint.for(Class, Delegate);

      if (isComponentTest(test)) {
        const meta = getComponentTestMeta(test);

        const CASES = blueprint.filtered(meta).map((kind) => {
          return {
            kind,
            test: blueprint.createTestFn(test, KIND_FOR[kind]),
          };
        });

        for (const { kind, test: testCase } of CASES) {
          if (meta.skip) {
            QUnit.skip(`${kind}: ${prop}`, testCase);
          } else {
            QUnit.test(`${kind}: ${prop}`, testCase);
          }
        }
      }
    }
  }
}

export interface RenderTestContext<
  K extends DeclaredComponentKind | 'all' = DeclaredComponentKind | 'all',
> extends Assert {
  count: Count;
  events: RecordedEvents;
  testType: KindFor<ExpandType<K>>;
}

export function RenderTestContext(assert: Assert, testType: ComponentKind): RenderTestContext {
  const events = new RecordedEvents();

  return new Proxy(
    { assert, count: new Count(events), events, testType },
    {
      get({ assert, count, testType }, prop, receiver) {
        switch (prop) {
          case 'count':
            return count;
          case 'events':
            return events;
          case 'testType':
            return testType;
          default:
            return Reflect.get(assert, prop, receiver);
        }
      },
    }
  ) as unknown as RenderTestContext;
}

const KIND_FOR = {
  glimmer: 'Glimmer',
  curly: 'Curly',
  dynamic: 'Dynamic',
  templateOnly: 'TemplateOnly',
} as const;

export type KindFor<K extends DeclaredComponentKind> = (typeof KIND_FOR)[K];

type TestFn = (type: ComponentKind) => void;

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

  filtered(meta: ComponentTestMeta): readonly DeclaredComponentKind[] {
    const included = EXPANSIONS[meta.kind ?? this.#suite.kind ?? 'all'];
    const excluded = new Set(expandSkip(meta.skip));

    return included.filter((kind) => !excluded.has(kind));
  }

  createTestFn(
    test: ComponentTestFunction,
    type: ComponentKind
  ): (assert: Assert) => void | Promise<void> {
    return (assert) => {
      const instance = new this.#Class(new this.#Delegate(), RenderTestContext(assert, type));
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

  createTest(description: string, test: unknown): TestFn | undefined {
    if (!isComponentTest(test)) return;

    return (type: ComponentKind) => {
      QUnit.test(description, this.createTestFn(test, type));
    };
  }
}

class ComponentModule {
  readonly #type: DeclaredComponentKind;
  readonly #tests: readonly TestFn[];

  constructor(type: DeclaredComponentKind, tests: readonly TestFn[]) {
    this.#type = type;
    this.#tests = tests;
  }

  *[Symbol.iterator]() {
    yield* this.#tests;
  }

  get type() {
    return this.#type;
  }

  get formatted(): string {
    return upperFirst(this.#type);
  }
}

class ComponentTests<D extends RenderDelegate, T extends IRenderTest> {
  readonly #blueprint: TestBlueprint<D, T>;
  readonly #tests: ComponentTestFunctions = {
    glimmer: [],
    curly: [],
    dynamic: [],
    templateOnly: [],
  };

  constructor(blueprint: TestBlueprint<D, T>) {
    this.#blueprint = blueprint;
  }

  *[Symbol.iterator](): IterableIterator<ComponentModule> {
    for (let [type, tests] of entries(this.#tests)) {
      yield new ComponentModule(type, [...tests].reverse());
    }
  }

  get(type: DeclaredComponentKind): TestFn[] {
    return this.#tests[type];
  }

  add(kinds: readonly DeclaredComponentKind[], { prop, test }: { prop: string; test: unknown }) {
    for (const kind of kinds) {
      const testFn = this.#blueprint.createTest(prop, test);
      if (testFn) this.#tests[kind].push(testFn);
    }
  }
}

export type ExpandType<K extends DeclaredComponentKind | 'all'> = EXPANSIONS[K][number];

const EXPANSIONS = {
  curly: ['curly', 'dynamic'],
  glimmer: ['glimmer', 'templateOnly'],
  dynamic: ['dynamic'],
  templateOnly: ['templateOnly'],
  all: ['curly', 'glimmer', 'dynamic', 'templateOnly'],
} as const;
type EXPANSIONS = typeof EXPANSIONS;

function expandSkip(
  kind: DeclaredComponentKind | boolean | undefined
): readonly DeclaredComponentKind[] {
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

interface ComponentTestFunctions {
  readonly glimmer: TestFn[];
  readonly curly: TestFn[];
  readonly dynamic: TestFn[];
  readonly templateOnly: TestFn[];
}

function nestedComponentModules<D extends RenderDelegate, T extends IRenderTest>(
  tests: ComponentTests<D, T>
): void {
  for (const module of tests) {
    QUnit.module(`[integration] ${module.formatted}`, () => {
      for (const test of module) {
        test(KIND_FOR[module.type]);
      }
    });
  }
}

function upperFirst<T extends string>(
  str: T extends '' ? `upperFirst only takes (statically) non-empty strings` : T
): string {
  let first = str[0] as string;
  let rest = str.slice(1);

  return `${first.toUpperCase()}${rest}`;
}
