import { getGlobal } from './lib/utils';

const GLIMMER_VALIDATOR_REGISTRATION = Symbol('GLIMMER_VALIDATOR_REGISTRATION');

const globalObj = getGlobal();

if (globalObj[GLIMMER_VALIDATOR_REGISTRATION] === true) {
  throw new Error(
    'The `@glimmer/validator` library has been included twice in this application. It could be different versions of the package, or the same version included twice by mistake. `@glimmer/validator` depends on having a single copy of the package in use at any time in an application, even if they are the same version. You must dedupe your build to remove the duplicate packages in order to prevent this error.'
  );
}

globalObj[GLIMMER_VALIDATOR_REGISTRATION] = true;

export type {
  CombinatorTag,
  ConstantTag,
  DirtyableTag,
  Tag,
  UpdatableTag,
} from '@glimmer/interfaces';
export { debug } from './lib/debug';
export { dirtyTagFor, tagFor, tagMetaFor, type TagMeta } from './lib/meta';
export { trackedData } from './lib/tracked-data';
export {
  beginTrackFrame,
  beginUntrackFrame,
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
  type Cache,
} from './lib/tracking';
export {
  ALLOW_CYCLES,
  COMPUTE,
  CONSTANT,
  CONSTANT_TAG,
  CURRENT_TAG,
  CurrentTag,
  INITIAL,
  VOLATILE,
  VOLATILE_TAG,
  VolatileTag,
  bump,
  combine,
  createTag,
  createUpdatableTag,
  DIRTY_TAG as dirtyTag,
  isConstTag,
  UPDATE_TAG as updateTag,
  validateTag,
  valueForTag,
  type Revision,
} from './lib/validators';
