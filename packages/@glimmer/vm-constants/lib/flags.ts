import type {
  ARG_SHIFT as IARG_SHIFT,
  AttributeHookCapability,
  CreateArgsCapability,
  CreateCallerCapability,
  CreateInstanceCapability,
  CurriedComponent,
  CurriedHelper,
  CurriedModifier,
  DynamicLayoutCapability,
  DynamicScopeCapability,
  DynamicTagCapability,
  ElementHookCapability,
  EmptyCapability,
  HasSubOwnerCapability,
  MACHINE_MASK as IMACHINE_MASK,
  MAX_SIZE as IMAX_SIZE,
  OPERAND_LEN_MASK as IOPERAND_LEN_MASK,
  PrepareArgsCapability,
  TYPE_MASK as ITYPE_MASK,
  TYPE_SIZE as ITYPE_SIZE,
  UpdateHookCapability,
  WillDestroyCapability,
  WrappedCapability,
} from '@glimmer/interfaces';

export const CURRIED_COMPONENT: CurriedComponent = 0;
export const CURRIED_HELPER: CurriedHelper = 1;
export const CURRIED_MODIFIER: CurriedModifier = 2;

// prettier-ignore
export const EMPTY_CAPABILITY: EmptyCapability = 0;
export const DYNAMIC_LAYOUT_CAPABILITY: DynamicLayoutCapability = 0b0_0000_0000_0001;
export const DYNAMIC_TAG_CAPABILITY: DynamicTagCapability = 0b0_0000_0000_0010;
export const PREPARE_ARGS_CAPABILITY: PrepareArgsCapability = 0b0_0000_0000_0100;
export const CREATE_ARGS_CAPABILITY: CreateArgsCapability = 0b0_0000_0000_1000;
export const ATTRIBUTE_HOOK_CAPABILITY: AttributeHookCapability = 0b0_0000_0001_0000;
export const ELEMENT_HOOK_CAPABILITY: ElementHookCapability = 0b0_0000_0010_0000;
export const DYNAMIC_SCOPE_CAPABILITY: DynamicScopeCapability = 0b0_0000_0100_0000;
export const CREATE_CALLER_CAPABILITY: CreateCallerCapability = 0b0_0000_1000_0000;
export const UPDATE_HOOK_CAPABILITY: UpdateHookCapability = 0b0_0001_0000_0000;
export const CREATE_INSTANCE_CAPABILITY: CreateInstanceCapability = 0b0_0010_0000_0000;
export const WRAPPED_CAPABILITY: WrappedCapability = 0b0_0100_0000_0000;
export const WILL_DESTROY_CAPABILITY: WillDestroyCapability = 0b0_1000_0000_0000;
export const HAS_SUB_OWNER_CAPABILITY: HasSubOwnerCapability = 0b1_0000_0000_0000;

export type InternalComponentCapability =
  | DynamicLayoutCapability
  | DynamicTagCapability
  | PrepareArgsCapability
  | CreateArgsCapability
  | AttributeHookCapability
  | ElementHookCapability
  | DynamicScopeCapability
  | CreateCallerCapability
  | UpdateHookCapability
  | CreateInstanceCapability
  | WrappedCapability
  | WillDestroyCapability
  | HasSubOwnerCapability;

/** @deprecated Use {@linkcode InternalComponentCapability} */
export type InternalComponentCapabilities = InternalComponentCapability;

export const ARG_SHIFT = 8 as const satisfies IARG_SHIFT;
export const MAX_SIZE = 0x7f_ff_ff_ff as const satisfies IMAX_SIZE;
export const TYPE_SIZE = 0b1111_1111 as const satisfies ITYPE_SIZE;
export const TYPE_MASK = 0b0000_0000_0000_0000_0000_0000_1111_1111 as const satisfies ITYPE_MASK;
export const OPERAND_LEN_MASK =
  0b0000_0000_0000_0000_0000_0011_0000_0000 as const satisfies IOPERAND_LEN_MASK;
export const MACHINE_MASK = 0b0000_0000_0000_0000_0000_0100_0000_0000 as const satisfies IMACHINE_MASK;
