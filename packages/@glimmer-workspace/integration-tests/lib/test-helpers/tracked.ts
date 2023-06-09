import { unwrap } from '@glimmer/util';
import { trackedCell, trackedData, type TrackedCell } from '@glimmer/validator';

export function trackedOriginal(target: object, key: string) {
  let { getter, setter } = trackedData<any, any>(key);

  Object.defineProperty(target, key, {
    get() {
      return getter(this);
    },

    set(value: unknown) {
      setter(this, value);
    },
  });
}

const CELLS = new WeakMap<object, TrackedCell<unknown>>();

export const tracked = <This extends object, Value>(
  _target: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>
): ClassAccessorDecoratorResult<This, Value> => {
  return {
    init(this: This, value: Value) {
      CELLS.set(
        this,
        trackedCell(value as unknown, { parent: this.constructor.name, key: String(context.name) })
      );
      return value;
    },
    get() {
      let [get] = unwrap(CELLS.get(this));
      return get() as Value;
    },
    set(this: This, value: Value) {
      let [, set] = unwrap(CELLS.get(this));
      set(value);
    },
  };
};
