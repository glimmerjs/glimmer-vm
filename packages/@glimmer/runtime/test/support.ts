export function module(name: string, nested: (hooks: NestedHooks) => void): void;
export function module(name: string, setup: Hooks): void;
export function module(name: string, setup: Hooks, nested: (hooks: NestedHooks) => void): void;
export function module(name: string): void {
  if (arguments.length === 1) {
    return QUnit.module(name);
  }

  let nested: (hooks: NestedHooks) => void, setup: Hooks;
  if (arguments.length === 2) {
    if (typeof arguments[1] === 'object') {
      setup = arguments[1];
      return QUnit.module(name, setup);
    }
    nested = arguments[1];
    return QUnit.module(name, nested);
  }

  if (arguments.length === 3) {
    setup = arguments[1];
    nested = arguments[2];
    return QUnit.module(name, setup, nested);
  }
}

export function test(name: string, callback: (assert: Assert) => void) {
  return QUnit.test(name, callback);
}

export function todo(name: string, callback: (assert: Assert) => void) {
  return QUnit.todo(name, callback);
}

export const assert = QUnit.assert;
