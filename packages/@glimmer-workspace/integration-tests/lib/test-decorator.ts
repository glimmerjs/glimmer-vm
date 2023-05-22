import { keys } from '@glimmer/util';
import type { TestFunctionType } from './test-helpers/module';

export type DeclaredComponentKind = 'glimmer' | 'curly' | 'dynamic' | 'templateOnly';

export interface ComponentTestMeta {
  kind?: DeclaredComponentKind;
  /**
   * The test doesn't make sense in this component kind.
   */
  except?: boolean | DeclaredComponentKind;
  /**
   * Skip the test for now (using `QUnit.skip`).
   *
   * @deprecated Use {@linkcode todo} instead.
   */
  skip?: boolean | DeclaredComponentKind;
  /**
   * Mark the test as QUnit.todo.
   */
  todo?: boolean | DeclaredComponentKind;
}

export function test(meta: ComponentTestMeta): MethodDecorator;
export function test<T>(
  _target: Object | ComponentTestMeta,
  _name?: string,
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

function setupTest(type: TestFunctionType, ...args: any[]) {
  if (args.length === 1) {
    let meta: ComponentTestMeta = args[0];
    return (_target: Object, _name: string, descriptor: PropertyDescriptor) => {
      let testFunction = descriptor.value;
      for (let key of keys(meta)) testFunction[key] = meta[key];
      setTestingDescriptor(descriptor, type);
    };
  }

  let descriptor = args[2];
  setTestingDescriptor(descriptor, type);
  return descriptor;
}

function setTestingDescriptor(descriptor: PropertyDescriptor, type: TestFunctionType): void {
  let testFunction = descriptor.value;
  descriptor.enumerable = true;
  testFunction['isTest'] = true;
  testFunction['testModifier'] = type;
}
