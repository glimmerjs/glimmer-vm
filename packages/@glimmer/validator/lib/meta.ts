import type { ConstantTag, UpdatableTag } from '@glimmer/interfaces';

import { debug } from './debug';
import { type Indexable, unwrap, unwrapDebug } from './utils';
import { DIRTY_TAG, createUpdatableTag } from './validators';

function isObjectLike<T>(u: T): u is Indexable & T {
  return (typeof u === 'object' && u !== null) || typeof u === 'function';
}

///////////

export type TagMeta = Map<PropertyKey, UpdatableTag>;

const TRACKED_TAGS = new WeakMap<object, TagMeta>();

export function dirtyTagFor<T extends object>(
  obj: T,
  key: keyof T | string | symbol,
  meta?: TagMeta
): void {
  if (import.meta.env.DEV && !isObjectLike(obj)) {
    throw new Error(`BUG: Can't update a tag for a primitive`);
  }

  let tags = meta === undefined ? TRACKED_TAGS.get(obj) : meta;

  // No tags have been setup for this object yet, return
  if (tags === undefined) return;

  // Dirty the tag for the specific property if it exists
  let propertyTag = tags.get(key);

  if (propertyTag !== undefined) {
    if (import.meta.env.DEV) {
      unwrap(debug.assertTagNotConsumed)(propertyTag, obj, key);
    }

    DIRTY_TAG(propertyTag, true);
  }
}

export function tagMetaFor(obj: object): TagMeta {
  let tags = TRACKED_TAGS.get(obj);

  if (tags === undefined) {
    tags = new Map();

    TRACKED_TAGS.set(obj, tags);
  }

  return tags;
}

export const OBJECT_DEBUG = import.meta.env.DEV ? new WeakMap<object, string>() : void 0;

export function tagFor<T extends object>(
  obj: T,
  key: keyof T | string | symbol,
  meta?: TagMeta
): UpdatableTag | ConstantTag {
  let tags = meta === undefined ? tagMetaFor(obj) : meta;
  let tag = tags.get(key);

  if (tag === undefined) {
    tag = import.meta.env.DEV
      ? createUpdatableTag(
          `${unwrapDebug(OBJECT_DEBUG).get(obj) ?? 'object'}${formatDebugTag(
            key as string | symbol
          )}`
        )
      : createUpdatableTag();
    tags.set(key, tag);
  }

  return tag;
}

function formatDebugTag(key: string | symbol): string {
  if (typeof key === 'symbol') {
    return `[${key.description}]`;
  } else if (/\d+/u.test(key)) {
    return `[${key}]`;
  } else {
    return `.${key}`;
  }
}
