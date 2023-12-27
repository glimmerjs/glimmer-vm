import {
  setIsRendering,
  type MergedCell,
  tagsToRevalidate,
  executeTag,
  relatedTags,
} from '@/utils/reactive';

let revalidateScheduled = false;
type voidFn = () => void;
let resolveRender: undefined | voidFn = undefined;

export function setResolveRender(value: () => void) {
  resolveRender = value;
}

export function scheduleRevalidate() {
  if (!revalidateScheduled) {
    revalidateScheduled = true;
    Promise.resolve().then(() => {
      syncDom();
      if (resolveRender !== undefined) {
        resolveRender();
        resolveRender = undefined;
      }
      revalidateScheduled = false;
    });
  }
}

export function syncDom() {
  const sharedTags = new Set<MergedCell>();
  setIsRendering(true);
  tagsToRevalidate.forEach((tag) => {
    executeTag(tag);
    relatedTags.get(tag)?.forEach((tag) => {
      sharedTags.add(tag);
    });
  });
  sharedTags.forEach((tag) => {
    executeTag(tag);
  });
  tagsToRevalidate.clear();
  setIsRendering(false);
}
