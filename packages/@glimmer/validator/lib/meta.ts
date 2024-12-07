import type { ConstantTag, UpdatableTag } from '@glimmer/interfaces';
import type { TagMeta } from '@glimmer/state';
import { getTagMeta, getTrackingDebug, upsertTagMetaFor } from '@glimmer/fundamental';

import type { Indexable } from './utils';

import { unwrap } from './utils';
import { createUpdatableTag, DIRTY_TAG } from './validators';

function isObjectLike<T>(u: T): u is Indexable & T {
  return (typeof u === 'object' && u !== null) || typeof u === 'function';
}

///////////

export function dirtyTagFor<T extends object>(
  obj: T,
  key: keyof T | string | symbol,
  meta?: TagMeta
): void {
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
      unwrap(getTrackingDebug)().assertTagNotConsumed(propertyTag, obj, key);
    }

    DIRTY_TAG(propertyTag, true);
  }
}

export function tagFor<T extends object>(
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
