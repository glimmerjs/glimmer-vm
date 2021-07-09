import {
  assert,
  createClassicTrackedDecorator,
  extendTrackedPropertyDesc,
} from '@glimmer/global-context';
import { tagFor, dirtyTagFor } from './meta';
import { consumeTag } from './tracking';

function isElementDescriptor(
  args: unknown[]
): args is [object, string, DecoratorPropertyDescriptor] {
  let [maybeTarget, maybeKey, maybeDesc] = args;

  return (
    // Ensure we have the right number of args
    args.length === 3 &&
    // Make sure the target is a class or object (prototype)
    (typeof maybeTarget === 'function' ||
      (typeof maybeTarget === 'object' && maybeTarget !== null)) &&
    // Make sure the key is a string
    typeof maybeKey === 'string' &&
    // Make sure the descriptor is the right shape
    ((typeof maybeDesc === 'object' && maybeDesc !== null) || maybeDesc === undefined)
  );
}

export type DecoratorPropertyDescriptor = (PropertyDescriptor & { initializer?: any }) | undefined;

/**
  @decorator
  @private

  Marks a property as tracked.

  By default, a component's properties are expected to be static,
  meaning you are not able to update them and have the template update accordingly.
  Marking a property as tracked means that when that property changes,
  a rerender of the component is scheduled so the template is kept up to date.

  There are two usages for the `@tracked` decorator, shown below.

  @example No dependencies

  If you don't pass an argument to `@tracked`, only changes to that property
  will be tracked:

  ```typescript
  import Component, { tracked } from '@glimmer/component';

  export default class MyComponent extends Component {
    @tracked
    remainingApples = 10
  }
  ```

  When something changes the component's `remainingApples` property, the rerender
  will be scheduled.

  @example Dependents

  In the case that you have a computed property that depends other
  properties, you want to track both so that when one of the
  dependents change, a rerender is scheduled.

  In the following example we have two properties,
  `eatenApples`, and `remainingApples`.

  ```typescript
  import Component, { tracked } from '@glimmer/component';

  const totalApples = 100;

  export default class MyComponent extends Component {
    @tracked
    eatenApples = 0

    @tracked('eatenApples')
    get remainingApples() {
      return totalApples - this.eatenApples;
    }

    increment() {
      this.eatenApples = this.eatenApples + 1;
    }
  }
  ```

  @param dependencies Optional dependents to be tracked.
*/
export function tracked(options: { value: unknown; initializer: () => unknown }): PropertyDecorator;
export function tracked(target: object, key: string): void;
export function tracked(
  target: object,
  key: string,
  desc: DecoratorPropertyDescriptor
): DecoratorPropertyDescriptor;
export function tracked(...args: unknown[]): DecoratorPropertyDescriptor | PropertyDecorator {
  if (!isElementDescriptor(args)) {
    return createClassicTrackedDecorator(args) as PropertyDecorator;
  }

  let [target, key, desc] = args;

  assert(
    !desc || (!desc.value && !desc.get && !desc.set),
    `You attempted to use @tracked on ${key}, but that element is not a class field. @tracked is only usable on class fields. Native getters and setters will autotrack add any tracked fields they encounter, so there is no need mark getters and setters with @tracked.`
  );

  let initializer = desc?.initializer;

  let values = new WeakMap<object, unknown>();
  let hasInitializer = typeof initializer === 'function';

  let newDesc = {
    enumerable: true,
    configurable: true,

    get() {
      consumeTag(tagFor(this, key));

      let value;

      // If the field has never been initialized, we should initialize it
      if (hasInitializer && !values.has(this)) {
        value = initializer.call(this);
        values.set(this, value);
      } else {
        value = values.get(this);
      }

      return value;
    },

    set(value: unknown) {
      dirtyTagFor(this, key);
      values.set(this, value);
    },
  };

  extendTrackedPropertyDesc(target, key, newDesc);

  return newDesc;
}
