import { getValue, setValue, createStorage } from '@glimmer/validator';

export function trackedObj<T extends Record<string, unknown>>(
  obj: T = {} as T
): Record<string, unknown> {
  let trackedObj = {};

  for (let key in obj) {
    let storage = createStorage(obj[key], () => false);

    Object.defineProperty(trackedObj, key, {
      enumerable: true,

      get() {
        return getValue(storage);
      },

      set(value: T[Extract<keyof T, string>]) {
        setValue(storage, value);
      },
    });
  }

  return trackedObj;
}
