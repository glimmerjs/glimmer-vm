import type {
  Helper,
  InternalComponentManager,
  InternalModifierManager,
} from '@glimmer/interfaces';
import type { CustomHelperManager } from '@glimmer/manager';

export type InternalManager =
  | InternalComponentManager
  | InternalModifierManager
  | CustomHelperManager
  | Helper;

export const COMPONENT_MANAGERS = new WeakMap<object, InternalComponentManager>();

export const MODIFIER_MANAGERS = new WeakMap<object, InternalModifierManager>();

export const HELPER_MANAGERS = new WeakMap<object, CustomHelperManager | Helper>();
