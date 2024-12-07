export * from '@glimmer/constants';
export { allowCycles, trackingDebug } from '@glimmer/debug';
export { assert, expect, unwrapTemplate } from '@glimmer/debug-util';
export {
  associateDestroyableChild,
  destroy,
  isDestroyed,
  isDestroying,
  registerDestructor,
  unregisterDestructor,
} from '@glimmer/destroyable';
export {
  consumeTag,
  isTracking,
  upsertTagMetaFor as tagMetaFor,
  upsertTagMetaFor,
  validateTag,
  valueForTag,
} from '@glimmer/fundamental';
export type {
  Arguments,
  CapabilityMask,
  CapturedArguments,
  CapturedNamedArguments,
  CapturedPositionalArguments,
  ClassicResolver,
  CompilableProgram,
  ComponentDefinition,
  ComponentManager,
  CustomRenderNode,
  Destroyable,
  Dict,
  DynamicScope,
  Environment,
  HelperDefinitionState,
  HelperManager,
  InternalComponentCapabilities,
  InternalComponentManager,
  InternalModifierManager,
  ModifierCapabilities,
  ModifierDefinitionState,
  ResolvedComponentDefinition,
  Revision,
  Template,
  TemplateFactory,
  VMArguments,
  WithCreateInstance,
  WithCustomDebugRenderTree,
  WithDynamicLayout,
  WithSubOwner,
} from '@glimmer/interfaces';
export {
  capabilityFlagsFrom,
  componentCapabilities,
  getComponentTemplate,
  getCustomTagFor,
  getInternalComponentManager,
  getInternalHelperManager,
  helperCapabilities,
  modifierCapabilities,
  setComponentManager,
  setComponentTemplate,
  setCustomTagFor,
  setHelperManager,
  setInternalComponentManager,
  setInternalHelperManager,
  setInternalModifierManager,
  setModifierManager,
} from '@glimmer/manager';
export { templateCompilationContext } from '@glimmer/opcode-compiler';
export { artifacts, RuntimeOpImpl } from '@glimmer/program';
export type { Reference } from '@glimmer/reference';
export {
  childRefFromParts,
  createComputeRef,
  createConstRef,
  createDebugAliasRef,
  createInvokableRef,
  createReadOnlyRef,
  createUnboundRef,
  isConstRef,
  isInvokableRef,
  isUpdatableRef,
  UNDEFINED_REFERENCE,
  updateRef,
  valueForRef,
} from '@glimmer/reference';
export type { CurriedValue, EnvironmentDelegate, SafeString } from '@glimmer/runtime';
export {
  array,
  clientBuilder,
  concat,
  createCapturedArgs,
  curry,
  DOMChanges,
  DOMTreeConstruction,
  EMPTY_ARGS,
  EMPTY_POSITIONAL,
  fn,
  get,
  hash,
  inTransaction,
  invokeHelper,
  normalizeProperty,
  on,
  renderMain,
  TEMPLATE_ONLY_COMPONENT_MANAGER,
  templateOnlyComponent,
} from '@glimmer/runtime';
export type { TagMeta } from '@glimmer/state';
export type { DirtyableTag, Tag, UpdatableTag } from '@glimmer/validator';
export {
  CONSTANT_TAG,
  createCache,
  createTag,
  createUpdatableTag,
  CURRENT_TAG,
  dirtyTag,
  dirtyTagFor,
  getValue,
  tagFor,
  track,
  untrack,
  updateTag,
} from '@glimmer/validator';
// for Ember compat
export * as encoder from '@glimmer/encoder';
export { default as setGlobalContext } from '@glimmer/global-context';
export { templateCacheCounters, templateFactory } from '@glimmer/opcode-compiler';
export { dict } from '@glimmer/util';
