import { meta, type TagMeta } from '@glimmer/state';

export function upsertTagMetaFor(obj: object): TagMeta {
  let tags = meta.get(obj);

  if (tags === undefined) {
    tags = new Map();

    meta.set(obj, tags);
  }

  return tags;
}

type Optional<T> = T | undefined;

export function getTagMeta(obj: object): Optional<TagMeta> {
  return meta.get(obj);
}
