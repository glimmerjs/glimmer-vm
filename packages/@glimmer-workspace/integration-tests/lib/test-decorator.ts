import type { IRenderTest } from './render-test';
import type { DeclaredComponentType, EveryComponentType } from './test-helpers/constants';
import type { RenderTestConstructor, RenderTestContext } from './test-helpers/module';
import { TEST_META, isTest } from './test-helpers/test';

type ComponentTestOptions =
  | Partial<Pick<ComponentTestMeta, 'skip' | 'kind' | 'invokeAs'>>
  | ComponentTestMeta['kind'];

type NormalizedComponentTestOptions = Pick<ComponentTestMeta, 'skip' | 'kind' | 'invokeAs'>;

export interface ComponentTestMeta {
  type: 'component';
  kind: EveryComponentType | undefined;
  // Normally, any invoking code is built using the same style as the target template. But sometimes
  // you need to invoke a component with a different style for full coverage (in particular, you
  // need a Glimmer invoker to pass attributes, but curly components can accept attributes).
  invokeAs: DeclaredComponentType | undefined;
  skip: boolean | DeclaredComponentType | undefined;
}

export interface ComponentTestFunction {
  (this: IRenderTest, assert: RenderTestContext): void | Promise<void>;

  readonly [TEST_META]: ComponentTestMeta;
}

export function isComponentTest(value: unknown): value is ComponentTestFunction {
  return isTest(value) && value[TEST_META].type === 'component';
}

export function getComponentTestMeta(value: ComponentTestFunction) {
  return value[TEST_META];
}

export function test(
  kind: DeclaredComponentType,
  options: Omit<ComponentTestOptions, 'type' | 'kind'>
): MethodDecorator;
export function test(meta: Omit<ComponentTestOptions, 'type'>): MethodDecorator;
export function test<T>(
  target: object,
  name: string,
  descriptor: TypedPropertyDescriptor<() => void | Promise<void>>
): void;
export function test<T, C extends Assert>(
  target: object,
  name: string,
  descriptor: TypedPropertyDescriptor<(context: C) => void | Promise<void>>
): void;
export function test(
  ...args:
    | [meta: Omit<ComponentTestOptions, 'type'>]
    | [kind: DeclaredComponentType, options: Omit<ComponentTestOptions, 'type' | 'kind'>]
    | [target: object, name: string, descriptor: PropertyDescriptor]
): MethodDecorator | PropertyDescriptor {
  if (args.length === 1) {
    const [options] = args;
    return (<T>(
      _target: object,
      _name: string | symbol,
      descriptor: TypedPropertyDescriptor<T>
    ) => {
      setTestingDescriptor(descriptor, normalizeOptions(options));
      return descriptor;
    }) satisfies MethodDecorator;
  } else if (args.length === 2) {
    const [kind, options] = args;
    return (<T>(
      _target: object,
      _name: string | symbol,
      descriptor: TypedPropertyDescriptor<T>
    ) => {
      setTestingDescriptor(descriptor, normalizeOptions({ kind, ...options }));
      return descriptor;
    }) satisfies MethodDecorator;
  } else {
    let [, , descriptor] = args;

    setTestingDescriptor(descriptor);
    return descriptor;
  }
}

function setTestingDescriptor(
  descriptor: PropertyDescriptor,
  meta: NormalizedComponentTestOptions = normalizeOptions(undefined)
): void {
  let testFunction = descriptor.value;
  descriptor.enumerable = true;
  setComponentTest(testFunction, meta);
}

export function setComponentTest(
  testFunction: Partial<ComponentTestFunction>,
  meta: NormalizedComponentTestOptions
) {
  Object.defineProperty(testFunction, TEST_META, {
    configurable: true,
    value: {
      type: 'component',
      ...meta,
    } satisfies ComponentTestMeta,
  });
}

function normalizeOptions(
  options: ComponentTestOptions | undefined
): NormalizedComponentTestOptions {
  if (typeof options === 'string') {
    return { kind: options, invokeAs: options === 'all' ? undefined : options, skip: false };
  } else {
    return {
      kind: options?.kind,
      invokeAs: options?.invokeAs,
      skip: false,
    };
  }
}

const RENDER_SUITE_META = Symbol('SUITE_META');

export interface RenderSuiteMeta {
  readonly description: string;
  readonly kind?: ComponentTestMeta['kind'] | undefined;
}

export interface RenderSuite {
  [RENDER_SUITE_META]: RenderSuiteMeta;
}

export function isSuite(value: object): value is RenderSuite {
  return RENDER_SUITE_META in value;
}

export function getSuiteMetadata(suite: RenderSuite): RenderSuiteMeta {
  return suite[RENDER_SUITE_META];
}

export function suite(
  description: string,
  options?: Partial<RenderSuiteMeta> | EveryComponentType
): <Class extends RenderTestConstructor<any, any>>(Class: Class) => Class {
  return (Class) => {
    Object.defineProperty(Class, RENDER_SUITE_META, {
      configurable: true,
      value: {
        description,
        kind: typeof options === 'string' ? options : options?.kind,
      } satisfies RenderSuiteMeta,
    });

    if ('suiteName' in Class) {
      throw Error(
        `Don't use 'static suiteName =' and @suite together. Please remove the static property and migrate to @suite.`
      );
    }

    Object.defineProperty(Class, 'suiteName', {
      configurable: true,
      value: description,
    });

    return Class;
  };
}
