import { type RenderTestContext, type RenderTestConstructor } from '..';
import type { IRenderTest } from './render-test';
import { isTest, TEST_META } from './test-helpers/test';

export type DeclaredComponentKind = 'glimmer' | 'curly' | 'dynamic' | 'templateOnly';
export type ComponentKind = DeclaredComponentKind | 'all';

type ComponentTestOptions =
  | Partial<Pick<ComponentTestMeta, 'skip' | 'kind'>>
  | ComponentTestMeta['kind'];

type NormalizedComponentTestOptions = Pick<ComponentTestMeta, 'skip' | 'kind'>;

export interface ComponentTestMeta {
  type: 'component';
  kind: DeclaredComponentKind | 'all' | undefined;
  skip: boolean | DeclaredComponentKind | undefined;
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

export function test(meta: ComponentTestOptions): MethodDecorator;
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
    | [meta: ComponentTestOptions]
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
    return { kind: options, skip: false };
  } else {
    return { kind: undefined, skip: false, ...options };
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
  options?: Partial<RenderSuiteMeta> | ComponentKind
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
