import { keys } from '@glimmer/util';

import type { ComponentTestMeta } from '../test-decorator';

export function test(meta: ComponentTestMeta): MethodDecorator;
export function test<T>(
  _target: Object | ComponentTestMeta,
  _name?: string,
  descriptor?: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T> | void;
export function test(...args: any[]) {
  if (args.length === 1) {
    let meta: ComponentTestMeta = args[0];
    return (_target: Object, _name: string, descriptor: PropertyDescriptor) => {
      let testFunction = descriptor.value;
      for (let key of keys(meta)) testFunction[key] = meta[key];
      setTestingDescriptor(descriptor);
    };
  }

  let descriptor = args[2];
  setTestingDescriptor(descriptor);
  return descriptor;
}

function setTestingDescriptor(descriptor: PropertyDescriptor): void {
  let testFunction = descriptor.value;
  descriptor.enumerable = true;
  testFunction['isTest'] = true;
}
