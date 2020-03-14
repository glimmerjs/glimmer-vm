import { trackedData } from '@glimmer/validator';

interface PropertyDescWithInitializer extends PropertyDescriptor {
  initializer?(): unknown;
}

export function tracked(_target: object, key: string, desc?: PropertyDescWithInitializer): any {
  let { getter, setter } = trackedData<any, any>(key, desc?.initializer);

  return {
    get() {
      return getter(this);
    },

    set(value: unknown) {
      return setter(this, value);
    },
  };
}
