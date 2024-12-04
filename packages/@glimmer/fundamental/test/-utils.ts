import type { TagMeta } from '@glimmer/fundamental';
import type {
  ConstantTag,
  ConstantTagId,
  CurrentTagId,
  DirtyableTag,
  DirtyableTagId,
  Indexable,
  Tag,
  UpdatableTag,
  UpdatableTagId,
} from '@glimmer/interfaces';
import { unwrap } from '@glimmer/debug-util';
import {
  beginTrackFrame,
  beginUntrackFrame,
  consumeTag,
  debug,
  endTrackFrame,
  endUntrackFrame,
  getTagMeta,
  now,
  TagImpl,
  upsertTagMetaFor,
} from '@glimmer/fundamental';

export const module = QUnit.module;
export const test = QUnit.test;

//// This file implements higher-level APIs and constructs from `@glimmer/validator`
//// in terms of `@glimmer/fundamental` to validate the `@glimmer/fundamental` APIs
//// in terms of the intended use case. TL;DR they're used in integration-style tests.

export const CONSTANT_TAG = new TagImpl(3 satisfies ConstantTagId) as ConstantTag;
export const CURRENT_TAG = new TagImpl(101 satisfies CurrentTagId, now);

export function createTag(): DirtyableTag {
  return new TagImpl(0 satisfies DirtyableTagId);
}

export function createUpdatableTag(): UpdatableTag {
  return new TagImpl(1 satisfies UpdatableTagId);
}

export function dirtyTagFor(obj: object, key: string | symbol, meta?: TagMeta): void {
  if (import.meta.env.DEV && !isObjectLike(obj)) {
    throw new Error(`BUG: Can't update a tag for a primitive`);
  }

  const tags = meta ?? getTagMeta(obj);

  // No tags have been setup for this object yet, return
  if (tags === undefined) return;

  // Dirty the tag for the specific property if it exists
  let propertyTag = tags.get(key);

  if (propertyTag !== undefined) {
    if (import.meta.env.DEV) {
      unwrap(debug.assertTagNotConsumed)(propertyTag, obj, key);
    }

    TagImpl.dirtyTag(propertyTag, true);
  }
}

export function track(block: () => void, debugLabel?: string | false): Tag {
  beginTrackFrame(debugLabel);

  let tag;

  try {
    block();
  } finally {
    tag = endTrackFrame();
  }

  return tag;
}

export function untrack<T>(callback: () => T): T {
  beginUntrackFrame();

  try {
    return callback();
  } finally {
    endUntrackFrame();
  }
}

export type Getter<T, K extends keyof T> = (self: T) => T[K] | undefined;
export type Setter<T, K extends keyof T> = (self: T, value: T[K]) => void;

/**
 * This utility is used to test
 */
export function trackedData<T extends object, K extends keyof T & (string | symbol)>(
  key: K,
  initializer?: (this: void, self: T) => T[K]
): { getter: Getter<T, K>; setter: Setter<T, K> } {
  let values = new WeakMap<T, T[K]>();

  function getter(self: T) {
    const tags = upsertTagMetaFor(self);

    let tag = tags.get(key);

    if (!tag) {
      tag = createUpdatableTag();
      tags.set(key, tag);
    }

    consumeTag(tag);

    if (initializer && !values.has(self)) {
      const value = initializer(self);
      values.set(self, value);
      return value;
    } else {
      return values.get(self);
    }
  }

  function setter(self: T, value: T[K]): void {
    dirtyTagFor(self, key);
    values.set(self, value);
  }

  return { getter, setter };
}

function isObjectLike<T>(u: T): u is Indexable & T {
  return (typeof u === 'object' && u !== null) || typeof u === 'function';
}

export function upsertTagForKey<T extends object>(
  obj: T,
  key: keyof T | string | symbol,
  meta?: TagMeta
): UpdatableTag | ConstantTag {
  const tags = meta ?? upsertTagMetaFor(obj);
  let tag = tags.get(key);

  if (tag === undefined) {
    tag = createUpdatableTag();
    tags.set(key, tag);
  }

  return tag;
}
