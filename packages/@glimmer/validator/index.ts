import { getGlobal } from './lib/utils';

const GLIMMER_VALIDATOR_REGISTRATION = Symbol('GLIMMER_VALIDATOR_REGISTRATION');

const globalObj = getGlobal();

if (globalObj[GLIMMER_VALIDATOR_REGISTRATION] === true) {
  throw new Error(
    'The `@glimmer/validator` library has been included twice in this application. It could be different versions of the package, or the same version included twice by mistake. `@glimmer/validator` depends on having a single copy of the package in use at any time in an application, even if they are the same version. You must dedupe your build to remove the duplicate packages in order to prevent this error.'
  );
}

globalObj[GLIMMER_VALIDATOR_REGISTRATION] = true;

export { dirtyTagFor, tagFor } from './lib/meta';
export { trackedData } from './lib/tracked-data';
export { type Cache, createCache, getValue, isConst, track, untrack } from './lib/tracking';
export {
  combine,
  CONSTANT,
  CONSTANT_TAG,
  createTag,
  createUpdatableTag,
  CURRENT_TAG,
  DIRTY_TAG as dirtyTag,
  INITIAL,
  UPDATE_TAG as updateTag,
} from './lib/validators';
export type {
  CombinatorTag,
  ConstantTag,
  DirtyableTag,
  Tag,
  UpdatableTag,
} from '@glimmer/interfaces';
