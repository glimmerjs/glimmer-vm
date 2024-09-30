import { consumeTag, dirtyTagFor, tagFor } from '@glimmer/validator';

const COLLECTION = Symbol();

function createProxy(obj = {}) {
  return new Proxy(obj, {
    get(target, prop) {
      consumeTag(tagFor(target, prop));

      return Reflect.get(target, prop);
    },

    has(target, prop) {
      consumeTag(tagFor(target, prop));

      return prop in target;
    },

    ownKeys(target) {
      consumeTag(tagFor(target, COLLECTION));

      return Reflect.ownKeys(target);
    },

    set(target, prop, value) {
      Reflect.set(target, prop, value);

      dirtyTagFor(target, prop);
      dirtyTagFor(target, COLLECTION);

      return true;
    },

    getPrototypeOf() {
      return TrackedObject.prototype;
    },
  });
}

export default class TrackedObject {
  static fromEntries<T>(this: void, entries: Iterable<readonly [PropertyKey, T]>) {
    return createProxy(Object.fromEntries(entries));
  }

  constructor(obj = {}) {
    let proto = Object.getPrototypeOf(obj);
    let descs = Object.getOwnPropertyDescriptors(obj);

    let clone = Object.create(proto);

    for (let prop in descs) {
      Object.defineProperty(clone, prop, Reflect.get(descs, prop));
    }

    return createProxy(clone);
  }
}

export const tracked = <T extends object>(obj: T): T => new TrackedObject(obj) as T;
