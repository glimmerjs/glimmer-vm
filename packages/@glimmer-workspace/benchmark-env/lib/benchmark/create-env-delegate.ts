/* eslint-disable no-console */

import { setGlobalContext } from '@glimmer/global-context';
import type { Destroyable, Destructor, RenderResult } from '@glimmer/interfaces';
import type { EnvironmentDelegate } from '@glimmer/runtime';

type Queue = (() => void)[];

const scheduledDestructors: Queue = [];
const scheduledFinalizers: Queue = [];

function flush(queue: Queue) {
  for (const fn of queue) fn();
  queue.length = 0;
}

let result: RenderResult;
let resolveRender: () => void;

export function registerResult(_result: RenderResult, _resolveRender: () => void) {
  result = _result;
  resolveRender = _resolveRender;
}

let revalidateScheduled = false;

setGlobalContext({
  scheduleRevalidate() {
    if (!revalidateScheduled) {
      Promise.resolve()
        .then(() => {
          const { env } = result;
          env.begin();
          result.rerender();
          revalidateScheduled = false;
          env.commit();
          // only resolve if commit didn't dirty again
          if (!revalidateScheduled && resolveRender !== undefined) {
            resolveRender();
          }
        })
        .catch((error) => console.error(error));
    }
  },

  getProp(value: unknown, property: string) {
    return (value as Record<string, unknown>)[property];
  },

  setProp(parent: unknown, property: string, value: unknown) {
    (parent as Record<string, unknown>)[property] = value;
  },

  getPath(value: unknown, path: string) {
    let parts = path.split('.');

    let current: unknown = value;

    for (let part of parts) {
      if (typeof current === 'function' || (typeof current === 'object' && current !== null)) {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return current;
  },

  setPath(parent: unknown, path: string, value: unknown) {
    let parts = path.split('.');

    let current: unknown = parent;
    let pathToSet = parts.pop()!;

    for (let part of parts) {
      current = (current as Record<string, unknown>)[part];
    }

    (current as Record<string, unknown>)[pathToSet] = value;
  },

  toBool(value) {
    return !!value;
  },

  toIterator() {
    return null;
  },

  warnIfStyleNotTrusted() {
    // noop
  },

  scheduleDestroy<T extends Destroyable>(destroyable: T, destructor: Destructor<T>) {
    scheduledDestructors.push(() => destructor(destroyable));
  },

  scheduleDestroyed(fn: () => void) {
    scheduledFinalizers.push(fn);
  },

  assert(test: unknown, message: string) {
    if (!test) {
      throw new Error(message);
    }
  },

  deprecate(message: string, test: unknown) {
    if (!test) {
      console.warn(message);
    }
  },
});

export default function createEnvironmentDelegate(isInteractive: boolean): EnvironmentDelegate {
  return {
    isInteractive,
    enableDebugTooling: false,
    onTransactionCommit() {
      flush(scheduledDestructors);
      flush(scheduledFinalizers);
    },
  };
}
