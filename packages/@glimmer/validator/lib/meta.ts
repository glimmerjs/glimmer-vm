import { DEBUG } from '@glimmer/env';
import { assert } from '@glimmer/global-context';
import { StorageSource } from '@glimmer/interfaces';
import { createStorage, isSourceImpl, setValue } from './cache';
import { Indexable } from './utils';

function isObjectLike<T>(u: T): u is Indexable & T {
  return (typeof u === 'object' && u !== null) || typeof u === 'function';
}

///////////

export type StorageMeta = Map<PropertyKey, StorageSource>;

const STORAGE_METAS = new WeakMap<object, StorageMeta>();

/**
 * This function is used mostly for legacy purposes, it comes from the fact that previously:
 *
 * 1. Revision management was separate from storage and caching, in a concept called Tags
 * 2. Tags could be created for any property to represent the state of that property,
 *    but not for storing the value of that property. Instead, the value was stored
 *    directly on the original object.
 * 3. Tagged properties could be added to any object at any time dynamically, e.g.
 *    via `Ember.get` and in other ways.
 *
 * This meant users may also have attempted to update a property dynamically, e.g. using
 * `Ember.set`. Rather than always create a storage for properties that are updated in this
 * way, we instead only notify if the storage actually exists. Notifying consists of
 * resetting any value that exists within the storage. If the storage has isEqual = false,
 * then this will notify correctly, otherwise it will not.
 */
export function notifyStorageFor<T extends object>(
  obj: T,
  key: keyof T | string | symbol,
  meta = STORAGE_METAS.get(obj)
): void {
  assert(isObjectLike(obj), `BUG: Can't update a storage for a primitive`);

  if (meta === undefined) return;

  let storage = meta.get(key);

  if (storage === undefined) return;

  // Assert so we can directly access storage.value without consuming the storage
  assert(isSourceImpl(storage), `BUG: Storage was not a cache impl`);

  setValue(storage, storage.value);
}

export function storageMetaFor(obj: object): StorageMeta {
  let tags = STORAGE_METAS.get(obj);

  if (tags === undefined) {
    tags = new Map();

    STORAGE_METAS.set(obj, tags);
  }

  return tags;
}

export function storageFor(
  obj: object,
  key: string | symbol,
  meta = storageMetaFor(obj),
  initializer?: () => unknown
): StorageSource {
  let storage = meta.get(key);

  if (storage === undefined) {
    storage = createStorage(initializer?.(), false, DEBUG && debugName(obj, key));

    meta.set(key, storage);
  }

  return storage;
}

function debugName(obj: object, key: string | symbol): string {
  let objName;

  if (
    typeof obj.toString === 'function' &&
    obj.toString !== Object.prototype.toString &&
    obj.toString !== Function.prototype.toString
  ) {
    objName = obj.toString();
  } else if (typeof obj === 'function') {
    objName = obj.name;
  } else if (typeof obj === 'object' && obj !== null) {
    let className = (obj.constructor && obj.constructor.name) || '(unknown class)';

    objName = `an instance of ${className}`;
  } else if (obj === undefined) {
    objName = '(an unknown obj)';
  } else {
    objName = String(obj);
  }

  return `the \`${String(key)}\` property on ${objName}`;
}
