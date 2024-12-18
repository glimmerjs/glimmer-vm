import type { TagMeta } from '@glimmer/state';
import state from '@glimmer/state';

export function upsertTagMetaFor(obj: object): TagMeta {
  let tags = state.meta.get(obj);

  if (tags === undefined) {
    tags = new Map();

    state.meta.set(obj, tags);
  }

  return tags;
}

type Optional<T> = T | undefined;

export function getTagMeta(obj: object): Optional<TagMeta> {
  return state.meta.get(obj);
}
