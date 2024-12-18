import type {
  ARG_SHIFT as IARG_SHIFT,
  AttributeHookCapability,
  CreateArgsCapability,
  CreateCallerCapability,
  CreateInstanceCapability,
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

export const InternalComponentCapabilities: {
  readonly Empty: EmptyCapability;
  readonly dynamicLayout: DynamicLayoutCapability;
  readonly dynamicTag: DynamicTagCapability;
  readonly prepareArgs: PrepareArgsCapability;
  readonly createArgs: CreateArgsCapability;
  readonly attributeHook: AttributeHookCapability;
  readonly elementHook: ElementHookCapability;
  readonly dynamicScope: DynamicScopeCapability;
  readonly createCaller: CreateCallerCapability;
  readonly updateHook: UpdateHookCapability;
  readonly createInstance: CreateInstanceCapability;
  readonly wrapped: WrappedCapability;
  readonly willDestroy: WillDestroyCapability;
  readonly hasSubOwner: HasSubOwnerCapability;
} = {
  Empty: 0,
  dynamicLayout: 0b0000000000001,
  dynamicTag: 0b0000000000010,
  prepareArgs: 0b0000000000100,
  createArgs: 0b0000000001000,
  attributeHook: 0b0000000010000,
  elementHook: 0b0000000100000,
  dynamicScope: 0b0000001000000,
  createCaller: 0b0000010000000,
  updateHook: 0b0000100000000,
  createInstance: 0b0001000000000,
  wrapped: 0b0010000000000,
  willDestroy: 0b0100000000000,
  hasSubOwner: 0b1000000000000,
} as const;

export const ARG_SHIFT: IARG_SHIFT = 8;
export const MAX_SIZE: IMAX_SIZE = 0x7fffffff;
export const TYPE_SIZE: ITYPE_SIZE = 0b11111111;
export const TYPE_MASK: ITYPE_MASK = 0b00000000000000000000000011111111;
export const OPERAND_LEN_MASK: IOPERAND_LEN_MASK = 0b00000000000000000000001100000000;
export const MACHINE_MASK: IMACHINE_MASK = 0b00000000000000000000010000000000;
