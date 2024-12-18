import type { SimpleElement } from '@simple-dom/interface';

import type { REFERENCE } from './reference';
import type { Tag, UpdatableTagId } from './tag';
import type { Destroyable } from './types';
import type { Arguments } from './vm';

export interface DynamicScope {
  get(key: string): Reference<unknown>;
  set(key: string, reference: Reference<unknown>): Reference<unknown>;
  child(): DynamicScope;
}

export interface Helper<O extends Owner = Owner> {
  (args: CapturedArguments, owner: O | undefined, dynamicScope?: DynamicScope): Reference;
}

export type Owner = object;

declare const CAPTURED_ARGS: unique symbol;

export interface CapturedArguments {
  positional: CapturedPositionalArguments;
  named: CapturedNamedArguments;
  [CAPTURED_ARGS]: true;
}

export type ConstantReferenceId = 0;
export type ComputeReferenceId = 1;
export type UnboundReferenceId = 2;
export type InvokableReferenceId = 3;

export type ReferenceType =
  | ConstantReferenceId
  | ComputeReferenceId
  | UnboundReferenceId
  | InvokableReferenceId;

export interface Reference<T = unknown> {
  [REFERENCE]: ReferenceType;
  debugLabel?: string | false | undefined;
  compute: null | (() => T);
  children: null | Map<string | Reference, Reference>;
}

export interface CapturedPositionalArguments extends Array<Reference> {
  [CAPTURED_ARGS]: true;
}

export interface CapturedNamedArguments extends Record<string, Reference> {
  [CAPTURED_ARGS]: true;
}

export interface InternalComponentManager<
  TComponentStateBucket = unknown,
  TComponentDefinition = object,
> {
  getCapabilities(state: TComponentDefinition): InternalComponentCapabilities;
  getSelf(state: TComponentStateBucket): Reference;
  getDestroyable(state: TComponentStateBucket): Destroyable | null;
  getDebugName(state: TComponentDefinition): string;
}

/**
 * Describes the capabilities of a particular component. The capabilities are
 * provided to the Glimmer compiler and VM via the ComponentDefinition, which
 * includes a ComponentCapabilities record.
 *
 * Certain features in the VM come with some overhead, so the compiler and
 * runtime use this information to skip unnecessary work for component types
 * that don't need it.
 *
 * For example, a component that is template-only (i.e., it does not have an
 * associated JavaScript class to instantiate) can skip invoking component
 * manager hooks related to lifecycle events by setting the `elementHook`
 * capability to `false`.
 */
export interface InternalComponentCapabilities {
  /**
   * Whether a component's template is static across all instances of that
   * component, or can vary per instance. This should usually be `false` except
   * for cases of backwards-compatibility.
   */
  dynamicLayout: boolean;

  /**
   * Whether a "wrapped" component's root element can change after being
   * rendered. This flag is only used by the WrappedBuilder and should be
   * `false` except for cases of backwards-compatibility.
   */
  dynamicTag: boolean;

  wrapped: boolean;

  /**
   * Setting the `prepareArgs` flag to true enables the `prepareArgs` hook on
   * the component manager, which would otherwise not be called.
   *
   * The component manager's `prepareArgs` hook allows it to programmatically
   * add or remove positional and named arguments for a component before the
   * component is invoked. This flag should usually be `false` except for cases
   * of backwards-compatibility.
   */
  prepareArgs: boolean;

  /**
   * Whether a reified `Arguments` object will get passed to the component
   * manager's `create` hook. If a particular component does not access passed
   * arguments from JavaScript (via the `this.args` property in Glimmer.js, for
   * example), this flag can be set to `false` to avoid the work of
   * instantiating extra data structures to expose the arguments to JavaScript.
   */
  createArgs: boolean;

  /**
   * Whether the component needs the caller component
   */
  createCaller: boolean;

  /**
   * Whether to call the `didSplatAttributes` hook on the component manager.
   */
  attributeHook: boolean;

  /**
   * Whether to call the `didCreateElement` hook on the component manager.
   */
  elementHook: boolean;

  /**
   * Whether the component manager has an update hook.
   */
  updateHook: boolean;

  /**
   * Whether the component needs an additional dynamic scope frame.
   */
  dynamicScope: boolean;

  /**
   * Whether there is a component instance to create. If this is false,
   * the component is a "template only component"
   */
  createInstance: boolean;

  /**
   * Whether or not the component has a `willDestroy` hook that should fire
   * prior to the component being removed from the DOM.
   */
  willDestroy: boolean;

  /**
   * Whether or not the component pushes an owner onto the owner stack. This is
   * used for engines.
   */
  hasSubOwner: boolean;
}

export interface ModifierCapabilities extends Capabilities {
  disableAutoTracking: boolean;
}

export type ModifierInstanceState = unknown;
export type ModifierDefinitionState = object;

export interface InternalModifierManager<
  TModifierInstanceState = ModifierInstanceState,
  TModifierDefinitionState extends ModifierDefinitionState = ModifierDefinitionState,
> {
  // Create is meant to only produce the state bucket
  create(
    owner: Owner,
    element: SimpleElement,
    state: TModifierDefinitionState,
    args: CapturedArguments
  ): TModifierInstanceState;

  // Convert the opaque modifier into a `RevisionTag` that determins when
  // the modifier's update hooks need to be called (if at all).
  getTag(modifier: TModifierInstanceState): Tag<UpdatableTagId> | null;

  getDebugName(Modifier: TModifierDefinitionState): string;
  getDebugInstance(Modifier: TModifierInstanceState): unknown;

  // At initial render, the modifier gets a chance to install itself on the
  // element it is managing. It can also return a bucket of state that
  // it could use at update time. From the perspective of Glimmer, this
  // is an opaque token.
  install(modifier: TModifierInstanceState): void;

  // When the modifier's tag has invalidated, the manager's `update` hook is
  // called.
  update(modifier: TModifierInstanceState): void;

  // Convert the opaque token into an object that implements Destroyable.
  // If it returns null, the modifier will not be destroyed.
  getDestroyable(modifier: TModifierInstanceState): Destroyable | null;
}

export type HelperDefinitionState = object;

export interface InternalHelperManager<TOwner extends Owner> {
  getDelegateFor(owner: TOwner | undefined): HelperManager<unknown>;

  getHelper(definition: HelperDefinitionState): Helper;
}

export interface HelperManager<HelperStateBucket> {
  capabilities: HelperCapabilities;

  createHelper(definition: object, args: Arguments): HelperStateBucket;

  getDebugName?(definition: object): string;
}

export declare const CAPABILITIES: unique symbol;
export type CapabilitiesSymbol = typeof CAPABILITIES;

export interface Capabilities {
  [CAPABILITIES]: true;
}

export interface HelperCapabilities extends Capabilities {
  hasValue: boolean;
  hasDestroyable: boolean;
  hasScheduledEffect: boolean;
}

export type InternalManager<O extends Owner = Owner> =
  | InternalComponentManager
  | InternalModifierManager
  | InternalHelperManager<O>
  | Helper;
