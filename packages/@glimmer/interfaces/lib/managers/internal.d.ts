import type { Helper, Owner } from '../runtime.js';
import type { InternalComponentManager } from './internal/component.js';
import type { InternalHelperManager } from './internal/helper.js';
import type { InternalModifierManager } from './internal/modifier.js';

export * from './internal/component.js';
export * from './internal/helper.js';
export * from './internal/modifier.js';

export type InternalManager<O extends Owner = Owner> =
  | InternalComponentManager
  | InternalModifierManager
  | InternalHelperManager<O>
  | Helper;
