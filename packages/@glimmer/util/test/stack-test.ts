/* eslint-disable qunit/no-assert-logical-expression */
import {
  BalancedStack,
  enumerate,
  PresentStack,
  range,
  reverse,
  Stack,
  times,
} from '@glimmer/util';

const { module, test } = QUnit;

/**
 * If the stack starts with a value in it, we use this special sentinel value to make test failures
 * more comprehensible.
 */
const INITIAL = Symbol('initial');
type INITIAL = typeof INITIAL;

/**
 * Same as {@linkcode INITIAL}, but for the initial value in a guarded stack.
 */
const GUARDED_INITIAL = Symbol('guarded initial');
type GUARDED_INITIAL = typeof GUARDED_INITIAL;

type TestValue = `value${number}` | INITIAL | GUARDED_INITIAL;

module('@glimmer/util - Stack', () => {
  module('Stack', () => {
    StackTests({ create: () => Stack.empty(), initial: [] });
  });

  module('PresentStack', () => {
    StackTests({
      create: () => PresentStack.initial(INITIAL),
      initial: [INITIAL],
    }).test(`can't pop the last frame`, ({ assert, stack }) => {
      assert.throws(
        () => stack.pop(),
        `BUG: You should never pop the last frame from a PresentStack`
      );
    });
  });

  module('BalancedStack', () => {
    StackTests({ create: () => BalancedStack.empty<TestValue>(), initial: [] });
  });
});

export {};

interface Define {
  test: (
    name: string,
    fn: (state: {
      assert: Assert;
      stack: Stack<TestValue>;
      assertInitial: (stack: Stack<TestValue>, operation: string) => void;
    }) => void
  ) => Define;
  module: (name: string, callback: (define: Define) => void) => Define;
}

interface TestSpec {
  create: () => Stack<TestValue>;
  initial: TestValue[];
}

function define({ create, initial }: TestSpec, def?: (define: Define) => void) {
  const define: Define = {
    test: (name, fn) => {
      test(name, (assert) => {
        const assertInitial = (stack: Stack<TestValue>, operation: string) => {
          assert.strictEqual(
            stack.size,
            initial.length,
            `after ${operation}, the stack size is the same as the initial stack`
          );
          assert.strictEqual(
            stack.current,
            initial.at(-1) ?? null,
            `${operation} changes the current item`
          );
          assert.deepEqual(
            stack.toArray(),
            initial,
            `after ${operation}, toArray reflects the initial stack`
          );
        };

        return fn({ assert, stack: create(), assertInitial });
      });
      return define;
    },
    module: (name, callback) => {
      module(name, () => callback(define));
      return define;
    },
  };

  if (def) def(define);
  return define;
}

function UnguardedStackTests(
  { create, initial }: TestSpec,
  def?: (define: Define) => void
): Define {
  const defined = define({ create, initial }, ({ test }) => {
    test('initial size', ({ assert, stack }) => {
      assert.strictEqual(stack.size, initial.length, 'the stack has the right initial size');
    });

    test('push', ({ assert, stack }) => {
      pushing((number) => {
        stack.push(number);
        assert.strictEqual(stack.size, initial.length + 1, 'pushing increments the size');
        assert.strictEqual(stack.current, number, 'pushing changes the current item');
        assert.deepEqual(stack.toArray(), [...initial, number], 'toArray reflects the pushed item');
      });
    });

    test('nth', ({ assert, stack }) => {
      for (const count of range(0, 10)) {
        pushingN(count, (numbers) => {
          for (const number of numbers) {
            stack.push(number);
          }

          for (const [i, number] of enumerate(reverse(numbers))) {
            assert.strictEqual(
              stack.nth(i),
              number,
              `nth(${i}) of ${JSON.stringify(numbers)} returns the correct item`
            );
          }
        });
      }
    });

    test('pop', ({ stack, assertInitial }) => {
      pushing((number) => {
        stack.push(number);
        stack.pop();

        assertInitial(stack, 'balanced pushes and pops');
      });
    });
  });

  if (def) def(defined);
  return defined;
}

function StackTests({ create, initial }: TestSpec) {
  return UnguardedStackTests({ create, initial }, ({ module }) => {
    module('frames', ({ module }) => {
      module('guard', ({ test }) => {
        test('nth can go past the beginning of the transaction', ({
          stack,
          assert,
          assertInitial,
        }) => {
          pushing((value) => {
            stack.push(value);
            stack = stack.begin();
            assert.strictEqual(stack.nth(0), value, 'nth(0) returns the correct value');

            pushing((value2) => {
              stack.push(value2);
              assert.strictEqual(
                stack.nth(1),
                value,
                'nth(1) returns the value pushed before the transaction'
              );
              assert.strictEqual(
                stack.nth(0),
                value2,
                'nth(0) returns the value pushed after the transaction'
              );

              stack.pop();
              assert.strictEqual(
                stack.nth(0),
                value,
                'after popping, nth(0) returns the value pushed before the transaction'
              );
            });

            stack = stack.finally();

            assert.strictEqual(
              stack.nth(0),
              value,
              'after finally, nth(0) returns the value pushed before the transaction'
            );

            stack.pop();
            assertInitial(stack, 'after a transaction');
          });
        });

        UnguardedStackTests(
          {
            create: () => {
              const stack = create().begin();
              return stack;
            },
            initial,
          },
          ({ test }) => {
            test('finally', ({ stack, assertInitial }) => {
              pushing((number) => {
                stack.push(number);
                stack.pop();
                stack = stack.finally();
                assertInitial(stack, 'calling finally() on an empty guarded frame');
              });
            });

            test('unwind', ({ stack, assertInitial }) => {
              pushing((number) => {
                stack.push(number);
                stack = stack.rollback();
                assertInitial(stack, 'calling unwind() on a frame with items in it');
              });
            });

            test(`can't call finally when the current treansaction is non-empty`, ({
              assert,
              stack,
            }) => {
              pushing((number) => {
                stack.push(number);
                assert.throws(() => stack.finally(), `Expected an empty frame in finally`);
              });
            });

            test(`can't pop from a transaction when it's empty`, ({ assert, stack }) => {
              assert.throws(
                () => stack.pop(),
                'BUG: Unbalanced stack: attempted to pop an item but no item was pushed'
              );
            });
          }
        );
      });
    });
  });
}

let stringId = 0;

function pushing<T>(callback: (value: TestValue) => T): T {
  return callback(`value${stringId++}`);
}

function pushingN<N extends number, T>(count: N, callback: (values: TestValue[]) => T): T {
  const values: TestValue[] = [];

  for (const _ of times(count)) {
    values.push(`value${stringId++}`);
  }

  return callback(values);
}
