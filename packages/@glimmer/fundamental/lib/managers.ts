import type {
  Helper,
  InternalComponentManager,
  InternalHelperManager,
  InternalModifierManager,
  Owner,
} from '@glimmer/interfaces';

export type InternalManager<O extends Owner = Owner> =
  | InternalComponentManager
  | InternalModifierManager
  | InternalHelperManager<O>
  | Helper;

export const COMPONENT_MANAGERS = new WeakMap<object, InternalComponentManager>();

export const MODIFIER_MANAGERS = new WeakMap<object, InternalModifierManager>();

export const HELPER_MANAGERS = new WeakMap<object, InternalHelperManager<Owner> | Helper>();
