import { symbolFor, getGlobal } from './lib/utils';

const GLIMMER_VALIDATOR_REGISTRATION = symbolFor('GLIMMER_VALIDATOR_REGISTRATION');

const globalObj = getGlobal();

if (globalObj[GLIMMER_VALIDATOR_REGISTRATION] === true) {
  throw new Error(
    'The `@glimmer/validator` library has been included twice in this application. It could be different versions of the package, or the same version included twice by mistake. `@glimmer/validator` depends on having a single copy of the package in use at any time in an application, even if they are the same version. You must dedupe your build to remove the duplicate packages in order to prevent this error.'
  );
}

globalObj[GLIMMER_VALIDATOR_REGISTRATION] = true;

export { storageFor, storageMetaFor, notifyStorageFor, StorageMeta } from './lib/meta';

export {
  createStorage,
  createConstStorage,
  resetTracking,
  isTracking,
  untrack,
  createCache,
  isConst,
  getValue,
  setValue,
  setDeps,
  addDeps,
  getDebugLabel,
  isSourceImpl,
  TrackFrameOpcode,
  EndTrackFrameOpcode,
} from './lib/cache';

export { tracked } from './lib/tracked';

export {
  logTrackingStack,
  runInTrackingTransaction,
  beginTrackingTransaction,
  endTrackingTransaction,
  deprecateMutationsInTrackingTransaction,
} from './lib/debug';
