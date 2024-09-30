import type { Destroyable, Destructor, Nullable } from '@glimmer/interfaces';
import type { IteratorDelegate } from '@glimmer/reference';
import setGlobalContextVM from '@glimmer/global-context';

import { isNativeIterable, NativeIterator } from './iterator';

interface ContextDelegate {
  schedule: {
    revalidate: () => void;
    destroy: <T extends Destroyable>(destroyable: T, destructor: Destructor<T>) => void;
    destroyed: (fn: () => void) => void;
  };
}

export function setGlobalContext(delegate: ContextDelegate): void {
  setGlobalContextVM({
    getProp(obj, key) {
      return (obj as Record<string, unknown>)[key as keyof object];
    },

    setProp(obj, key, newValue) {
      (obj as Record<string, unknown>)[key] = newValue;
    },

    getPath(obj, key) {
      if (import.meta.env.DEV && key.includes('.')) {
        throw new Error(
          'You attempted to get a path with a `.` in it, but Glimmer.js does not support paths with dots.'
        );
      }

      return (obj as Record<string, unknown>)[key];
    },

    setPath(obj, key, newValue) {
      if (import.meta.env.DEV && key.includes('.')) {
        throw new Error(
          'You attempted to set a path with a `.` in it, but Glimmer.js does not support paths with dots.'
        );
      }

      (obj as Record<string, unknown>)[key] = newValue;
    },

    scheduleRevalidate: delegate.schedule.revalidate,

    toBool,

    toIterator(value: unknown): Nullable<IteratorDelegate> {
      if (isNativeIterable(value)) {
        return NativeIterator.from(value);
      }

      return null;
    },

    scheduleDestroy: delegate.schedule.destroy,
    scheduleDestroyed: delegate.schedule.destroyed,

    warnIfStyleNotTrusted() {
      // Do nothing
    },

    assert(test: unknown, msg: string) {
      if (!test) {
        throw new Error(msg);
      }
    },

    deprecate(msg: string, test: unknown) {
      if (!test) {
        // eslint-disable-next-line no-console
        console.warn(msg);
      }
    },
  });
}

export default function toBool(predicate: unknown): boolean {
  if (Array.isArray(predicate)) {
    return predicate.length !== 0;
  } else {
    return Boolean(predicate);
  }
}
