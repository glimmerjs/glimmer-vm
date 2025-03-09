import { keys } from '@glimmer/util';

import type { ComponentTestMeta } from '../test-decorator';
import { jitSuite } from './module';
import { Count } from '../render-test';

export function test(meta: ComponentTestMeta): MethodDecorator;
export function test<T>(
  _target: object | ComponentTestMeta,
  _name?: string,
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

  let descriptor = args[2];
  setTestingDescriptor(descriptor);
  return descriptor;
}

export function testSuite(...names: string[]) {
  return (klass: new (...args: any[]) => any) => {
    const suiteName = names.pop();
    for (const name of names) {
      QUnit.module(name);
    }

    jitSuite(klass, { suiteName });
    return klass;
  };
}

function setTestingDescriptor(descriptor: PropertyDescriptor): void {
  let testFunction = descriptor.value;
  descriptor.enumerable = true;
  testFunction['isTest'] = true;
}
