import type { Destroyable, Destructor, Nullable, SimpleDocument } from '@glimmer/interfaces';
import type { IteratorDelegate } from '@glimmer/reference';
import type { EnvironmentDelegate } from '@glimmer/runtime';
import type { SimpleElement } from 'node_modules/@glimmer/compiler/lib/passes/2-encoding/mir';
import setGlobalContextVM from '@glimmer/global-context';

import { isNativeIterable, NativeIterator } from './iterator';

let scheduledDestroyables: Destroyable[] = [];
let scheduledDestructors: Destructor<object>[] = [];
let scheduledFinishDestruction: (() => void)[] = [];

export function setGlobalContext(scheduleRevalidate: () => void): void {
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

    scheduleRevalidate,

    toBool,

    toIterator(value: unknown): Nullable<IteratorDelegate> {
      if (isNativeIterable(value)) {
        return NativeIterator.from(value);
      }

      return null;
    },

    scheduleDestroy(destroyable, destructor) {
      scheduledDestroyables.push(destroyable);
      scheduledDestructors.push(destructor as Destructor<Destroyable>);
    },

    scheduleDestroyed(fn) {
      scheduledFinishDestruction.push(fn);
    },

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

/**
 * The environment delegate base class shared by both the client and SSR
 * environments. Contains shared definitions, but requires user to specify
 * `isInteractive` and a method for getting the protocols of URLs.
 *
 * @internal
 */
export abstract class BaseEnvDelegate implements EnvironmentDelegate {
  abstract isInteractive: boolean;
  abstract protocolForURL(url: string): string;

  enableDebugTooling = false;
  owner = {};

  onTransactionCommit(): void {
    for (let i = 0; i < scheduledDestroyables.length; i++) {
      const destructor = scheduledDestructors[i];
      const destroyable = scheduledDestroyables[i];

      if (destructor && destroyable) {
        destructor(destroyable);
      }
    }

    scheduledFinishDestruction.forEach((fn) => fn());

    scheduledDestroyables = [];
    scheduledDestructors = [];
    scheduledFinishDestruction = [];
  }
}

/**
 * The client specific environment delegate.
 *
 * @internal
 */
export class ClientEnvDelegate extends BaseEnvDelegate {
  isInteractive = true;
  #document: SimpleDocument;

  constructor(document: SimpleDocument) {
    super();
    this.#document = document;
    this.uselessAnchor = document.createElement('a');
  }

  private uselessAnchor: SimpleElement & { href: string; protocol: string };

  protocolForURL = (url: string): string => {
    // TODO - investigate alternative approaches
    // e.g. see `installPlatformSpecificProtocolForURL` in Ember
    this.uselessAnchor.href = url;
    return this.uselessAnchor.protocol;
  };
}

export class NodeEnvDelegate extends BaseEnvDelegate {
  isInteractive = false;
  protocolForURL = (): string => 'http:';
}

export default function toBool(predicate: unknown): boolean {
  if (Array.isArray(predicate)) {
    return predicate.length !== 0;
  } else {
    return Boolean(predicate);
  }
}
