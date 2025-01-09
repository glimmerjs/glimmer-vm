import type {
  CapabilitiesSymbol,
  OwnerSymbol,
  ReferenceSymbol,
  Tag,
  TagTypeSymbol,
  UpdatableTagId,
} from './lib/types';

import { state } from './lib/state';

export type * from './lib/types';

export type TagMeta = Map<PropertyKey, Tag<UpdatableTagId>>;

export type { DebugState, State } from './lib/state';
export { clock, debug, destroyables, managers, meta, tracking } from './lib/state';

export const symbols: {
  TYPE: TagTypeSymbol;
  REFERENCE: ReferenceSymbol;
  OWNER: OwnerSymbol;
  CAPABILITIES: CapabilitiesSymbol;
} = state;
