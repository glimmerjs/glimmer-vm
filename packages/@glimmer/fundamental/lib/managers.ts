import type {
  Helper,
  InternalComponentManager,
  InternalHelperManager,
  InternalModifierManager,
  Owner,
} from '@glimmer/state';

export type InternalManager<O extends Owner = Owner> =
  | InternalComponentManager
  | InternalModifierManager
  | InternalHelperManager<O>
  | Helper;

export const COMPONENT_MANAGERS: WeakMap<
  object,
  InternalComponentManager<unknown, object>
> = new WeakMap<object, InternalComponentManager>();

export const MODIFIER_MANAGERS: WeakMap<
  object,
  InternalModifierManager<unknown, object>
> = new WeakMap<object, InternalModifierManager>();

export const HELPER_MANAGERS: WeakMap<object, InternalHelperManager<object> | Helper<object>> =
  new WeakMap<object, InternalHelperManager<Owner> | Helper>();
