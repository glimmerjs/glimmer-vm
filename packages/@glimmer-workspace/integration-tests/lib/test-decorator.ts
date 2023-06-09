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

export function test(
  options: ComponentTestMeta
): <F extends Function>(fn: F, context: ClassMethodDecoratorContext) => void;
export function test<F extends Function>(fn: F, context: ClassMethodDecoratorContext): void;
export function test(
  ...args: [fn: Function, context: ClassMethodDecoratorContext] | [options: ComponentTestMeta]
): any {
  return setupTest2('test', ...args);
}

test.skip = (...args: any[]) => {
  setupTest2('skip', ...args);
};

test.todo = (...args: any[]) => {
  setupTest2('todo', ...args);
};

function setupTest2(
  type: TestFunctionType,
  ...args: [fn: Function, context: ClassMethodDecoratorContext] | [options: ComponentTestMeta]
) {
  if (args.length === 2) {
    let [testFunction] = args;

    Reflect.set(testFunction, 'isTest', true);
    Reflect.set(testFunction, 'testModifier', type);

    return testFunction;
  } else {
    let [options] = args;
    return (testFunction: Function, context: ClassMethodDecoratorContext) => {
      setupTest2(type, testFunction, context);

      for (let key of keys(options)) {
        Reflect.set(testFunction, key, options[key]);
      }

      return testFunction;
    };
  }
}
