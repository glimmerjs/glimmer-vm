const GLIMMER_VALIDATOR_REGISTRATION = Symbol('GLIMMER_VALIDATOR_REGISTRATION');

if (Reflect.has(globalThis, GLIMMER_VALIDATOR_REGISTRATION)) {
  throw new Error(
    'The `@glimmer/validator` library has been included twice in this application. It could be different versions of the package, or the same version included twice by mistake. `@glimmer/validator` depends on having a single copy of the package in use at any time in an application, even if they are the same version. You must dedupe your build to remove the duplicate packages in order to prevent this error.'
  );
}

Reflect.set(globalThis, GLIMMER_VALIDATOR_REGISTRATION, true);

export { trackedArray } from './lib/collections/array';
export { trackedMap } from './lib/collections/map';
export { trackedObject } from './lib/collections/object';
export { trackedSet } from './lib/collections/set';
export { trackedWeakMap } from './lib/collections/weak-map';
export { trackedWeakSet } from './lib/collections/weak-set';
export { debug } from './lib/debug';
export { dirtyTagFor, tagFor, type TagMeta, tagMetaFor } from './lib/meta';
export { trackedData } from './lib/tracked-data';
export {
  beginTrackFrame,
  beginUntrackFrame,
  type Cache,
  consumeTag,
  createCache,
  endTrackFrame,
  endUntrackFrame,
  getValue,
  isConst,
  isTracking,
  resetTracking,
  track,
  untrack,
} from './lib/tracking';
export {
  ALLOW_CYCLES,
  bump,
  combine,
  COMPUTE,
  CONSTANT,
  CONSTANT_TAG,
  createTag,
  createUpdatableTag,
  CURRENT_TAG,
  CurrentTag,
  DIRTY_TAG as dirtyTag,
  INITIAL,
  isConstTag,
  type Revision,
  UPDATE_TAG as updateTag,
  validateTag,
  valueForTag,
  VOLATILE,
  VOLATILE_TAG,
  VolatileTag,
} from './lib/validators';
export type {
  CombinatorTag,
  ConstantTag,
  DirtyableTag,
  Tag,
  UpdatableTag,
} from '@glimmer/interfaces';
