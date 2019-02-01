export interface TestClass<T = unknown> {
  new (): T;
}

export function module(Class: TestClass) {
  QUnit.module(Class.name, () => {
    let proto = Class.prototype;

    let descs = Object.getOwnPropertyDescriptors(proto);

    Object.keys(descs).forEach(key => {
      let desc = descs[key];

      if (desc.value && TEST.has(desc.value)) {
        QUnit.test(key, assert => {
          let test = new Class();
          (test as any)[key](assert);
        });
      }
    });
  });
}

const TEST = new WeakSet<Function>();

export function test(_target: unknown, _key: string, descriptor: PropertyDescriptor): void {
  TEST.add(descriptor.value);
}
