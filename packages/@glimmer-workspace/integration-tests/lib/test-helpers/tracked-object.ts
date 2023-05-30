import { consumeTag, dirtyTagFor, tagFor, OBJECT_DEBUG, unwrapDebug } from '@glimmer/validator';

export function trackedObj<T extends Record<string, unknown>>(
  obj: T = {} as T,
  name?: string
): Record<string, unknown> {
  let trackedObj = {};

  if (import.meta.env.DEV) {
    unwrapDebug(OBJECT_DEBUG).set(trackedObj, name ?? 'tracked.object');
  }

  for (let key in obj) {
    Object.defineProperty(trackedObj, key, {
      enumerable: true,

      get() {
        consumeTag(tagFor(obj, key));

        return (obj as any)[key];
      },

      set(value: unknown) {
        dirtyTagFor(obj, key);
        return ((obj as any)[key] = value);
      },
    });
  }

  return trackedObj;
}
