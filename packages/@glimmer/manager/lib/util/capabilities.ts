import { check, CheckNumber } from '@glimmer/debug';
import type {
  AttributeHookCapability,
  Capabilities,
  CapabilityMask,
  ComponentCapabilityName,
  CreateArgsCapability,
  CreateCallerCapability,
  CreateInstanceCapability,
  DynamicLayoutCapability,
  DynamicScopeCapability,
  DynamicTagCapability,
  ElementHookCapability,
  Expand,
  HasFlushHookCapability,
  HasSubOwnerCapability,
  InternalComponentCapability,
  InternalComponentManager,
  MACHINE_BOOL,
  PrepareArgsCapability,
  UpdateHookCapability,
  WillDestroyCapability,
  WithCreateInstance,
  WithDynamicLayout,
  WithFlushHook,
  WithPrepareArgs,
  WithSubOwner,
  WithUpdateHook,
  WrappedCapability,
} from '@glimmer/interfaces';
import {
  ATTRIBUTE_HOOK_CAPABILITY,
  CREATE_ARGS_CAPABILITY,
  CREATE_CALLER_CAPABILITY,
  CREATE_INSTANCE_CAPABILITY,
  DYNAMIC_LAYOUT_CAPABILITY,
  DYNAMIC_SCOPE_CAPABILITY,
  DYNAMIC_TAG_CAPABILITY,
  ELEMENT_HOOK_CAPABILITY,
  EMPTY_CAPABILITY,
  HAS_FLUSH_HOOK_CAPABILITY,
  HAS_SUB_OWNER_CAPABILITY,
  PREPARE_ARGS_CAPABILITY,
  UPDATE_HOOK_CAPABILITY,
  WILL_DESTROY_CAPABILITY,
  WRAPPED_CAPABILITY,
} from '@glimmer/vm-constants';

export const FROM_CAPABILITIES = import.meta.env.DEV ? new WeakSet() : undefined;

export function buildCapabilities<T extends object>(capabilities: T): T & Capabilities {
  if (import.meta.env.DEV) {
    FROM_CAPABILITIES!.add(capabilities);
    Object.freeze(capabilities);
  }

  return capabilities as T & Capabilities;
}

type CapabilityOptions = Expand<{
  [P in ComponentCapabilityName]?: boolean | undefined;
}>;

/**
 * Converts a ComponentCapabilities object into a 32-bit integer representation.
 */
export function capabilityMaskFrom(
  capabilities: CapabilityOptions | CapabilityMask
): CapabilityMask {
  if (typeof capabilities === 'number') return capabilities;

  let mask = EMPTY_CAPABILITY;

  if (capabilities.dynamicLayout) mask |= DYNAMIC_LAYOUT_CAPABILITY;
  if (capabilities.dynamicTag) mask |= DYNAMIC_TAG_CAPABILITY;
  if (capabilities.prepareArgs) mask |= PREPARE_ARGS_CAPABILITY;
  if (capabilities.createArgs) mask |= CREATE_ARGS_CAPABILITY;
  if (capabilities.attributeHook) mask |= ATTRIBUTE_HOOK_CAPABILITY;
  if (capabilities.elementHook) mask |= ELEMENT_HOOK_CAPABILITY;
  if (capabilities.dynamicScope) mask |= DYNAMIC_SCOPE_CAPABILITY;
  if (capabilities.createCaller) mask |= CREATE_CALLER_CAPABILITY;
  if (capabilities.updateHook) mask |= UPDATE_HOOK_CAPABILITY;
  if (capabilities.createInstance) mask |= CREATE_INSTANCE_CAPABILITY;
  if (capabilities.wrapped) mask |= WRAPPED_CAPABILITY;
  if (capabilities.willDestroy) mask |= WILL_DESTROY_CAPABILITY;
  if (capabilities.hasSubOwner) mask |= HAS_SUB_OWNER_CAPABILITY;
  if (capabilities.flushHook) mask |= HAS_FLUSH_HOOK_CAPABILITY;

  return mask as CapabilityMask;
}

export type InternalComponentCapabilityFor<C extends InternalComponentCapability> =
  C extends DynamicLayoutCapability
    ? WithDynamicLayout
    : C extends DynamicTagCapability
    ? InternalComponentManager
    : C extends PrepareArgsCapability
    ? WithPrepareArgs
    : C extends CreateArgsCapability
    ? InternalComponentManager
    : C extends AttributeHookCapability
    ? InternalComponentManager
    : C extends ElementHookCapability
    ? InternalComponentManager
    : C extends DynamicScopeCapability
    ? InternalComponentManager
    : C extends CreateCallerCapability
    ? InternalComponentManager
    : C extends UpdateHookCapability
    ? WithUpdateHook
    : C extends CreateInstanceCapability
    ? WithCreateInstance
    : C extends WrappedCapability
    ? InternalComponentManager
    : C extends WillDestroyCapability
    ? InternalComponentManager
    : C extends HasSubOwnerCapability
    ? WithSubOwner
    : C extends HasFlushHookCapability
    ? WithFlushHook
    : never;

export function managerHasCapability<F extends InternalComponentCapability>(
  _manager: InternalComponentManager,
  capabilities: CapabilityMask,
  capability: F
): _manager is InternalComponentCapabilityFor<F> {
  check(capabilities, /** @__PURE__ */ CheckNumber);
  return !!(capabilities & capability);
}

export function hasCapability(
  capabilities: CapabilityMask,
  capability: InternalComponentCapability
): MACHINE_BOOL {
  check(capabilities, /** @__PURE__ */ CheckNumber);
  return capabilities & capability;
}
