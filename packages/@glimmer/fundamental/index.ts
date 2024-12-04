export { allowCycles, allowsCycles } from './lib/debug';
export { debug } from './lib/debug';
export { combine, dirtyTag, isConstTag, isTag, TagImpl, validateTag, valueForTag } from './lib/tag';
export type { TagMeta } from './lib/tag-meta';
export { getTagMeta, upsertTagMetaFor } from './lib/tag-meta';
export type { Revision } from './lib/timestamp';
export { bump, now } from './lib/timestamp';
export {
  beginTrackFrame,
  beginUntrackFrame,
  consumeTag,
  endTrackFrame,
  endUntrackFrame,
  isTracking,
  resetTracking,
} from './lib/tracking';
