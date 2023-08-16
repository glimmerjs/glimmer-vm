export interface TestMeta {
  type: string;
  skip?: boolean | undefined;
}

export interface SimpleTestMeta extends TestMeta {
  type: 'simple';
}

export type SimpleTestOptions = Partial<Omit<TestMeta, 'type'>>;

export function test(meta: SimpleTestOptions): MethodDecorator;
export function test<T>(
  _target: object,
  _name: string | symbol,
  descriptor: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T>;
export function test(
  ...args: [meta: SimpleTestOptions] | Parameters<MethodDecorator>
): MethodDecorator | PropertyDescriptor {
  if (args.length === 1) {
    let meta = args[0];
    return ((_target, _name, descriptor: PropertyDescriptor) => {
      setTestingDescriptor(descriptor, meta);
    }) satisfies MethodDecorator;
  } else {
    const [, , descriptor] = args;
    setTestingDescriptor(descriptor);
    return descriptor;
  }
}

export const TEST_META = Symbol('TEST_META');
function setTestingDescriptor(
  descriptor: PropertyDescriptor,
  options?: SimpleTestOptions | undefined
): void {
  let testFunction = descriptor.value;
  descriptor.enumerable = true;
  testFunction[TEST_META] = {
    type: 'simple',
    skip: options?.skip,
  };
}

export interface TestFunction<Instance = object> {
  (this: Instance, assert: Assert): void;
  readonly [TEST_META]: {
    type: string;
  };
}

export interface SimpleTestFunction extends TestFunction {
  readonly [TEST_META]: {
    type: 'simple';
    skip?: boolean | undefined;
  };
}

export function isTest(value: unknown): value is TestFunction {
  return typeof value === 'function' && TEST_META in value;
}

export function getTestMeta(value: TestFunction): TestMeta {
  return value[TEST_META];
}

export function isSimpleTest(value: unknown): value is SimpleTestFunction {
  return isTest(value) && value[TEST_META].type === 'simple';
}
