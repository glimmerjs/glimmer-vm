import type { Optional, UpdatableTag } from '@glimmer/interfaces';

export type TagMeta = Map<PropertyKey, UpdatableTag>;

export function upsertTagMetaFor(obj: object): TagMeta {
  let tags = TRACKED_TAGS.get(obj);

  if (tags === undefined) {
    tags = new Map();

    TRACKED_TAGS.set(obj, tags);
  }

  return tags;
}

export function getTagMeta(obj: object): Optional<TagMeta> {
  return TRACKED_TAGS.get(obj);
}

const TRACKED_TAGS = new WeakMap<object, TagMeta>();
