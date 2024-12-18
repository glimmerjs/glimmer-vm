import type { Tag, UpdatableTagId } from './lib/types';

import { state } from './lib/state';

export type TagMeta = Map<PropertyKey, Tag<UpdatableTagId>>;

export type { DebugState, State } from './lib/state';
export type * from './lib/types';
export default state;

export const OWNER: typeof state.OWNER = state.OWNER;
