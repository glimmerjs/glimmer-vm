import type {
  CapturedArguments,
  DynamicScope,
  InternalComponentManager,
  Owner,
  Reference,
} from '@glimmer/state';

import type { ComponentInstanceState, PreparedArguments } from '../../components.js';
import type { Nullable } from '../../core.js';
import type { Bounds } from '../../dom/bounds.js';
import type { SimpleElement } from '../../dom/simple.js';
import type { ClassicResolver } from '../../program.js';
import type { VMArguments } from '../../runtime/arguments.js';
import type { RenderNode } from '../../runtime/debug-render-tree.js';
import type { ElementOperations } from '../../runtime/element.js';
import type { Environment } from '../../runtime/environment.js';
import type { CompilableProgram } from '../../template.js';
import type { ProgramSymbolTable } from '../../tier1/symbol-table.js';

/**
 * Enum used for bit flags version of the capabilities, used once the component
 * has been loaded for the first time
 */
export type EmptyCapability = 0b0000000000000;
export type DynamicLayoutCapability = 0b0000000000001;
export type DynamicTagCapability = 0b0000000000010;
export type PrepareArgsCapability = 0b0000000000100;
export type CreateArgsCapability = 0b0000000001000;
export type AttributeHookCapability = 0b0000000010000;
export type ElementHookCapability = 0b0000000100000;
export type DynamicScopeCapability = 0b0000001000000;
export type CreateCallerCapability = 0b0000010000000;
export type UpdateHookCapability = 0b0000100000000;
export type CreateInstanceCapability = 0b0001000000000;
export type WrappedCapability = 0b0010000000000;
export type WillDestroyCapability = 0b0100000000000;
export type HasSubOwnerCapability = 0b1000000000000;

export type InternalComponentCapability =
  | EmptyCapability
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

////////////

export interface CustomRenderNode extends RenderNode {
  bucket: object;
}

export interface WithCustomDebugRenderTree<
  ComponentInstanceState = unknown,
  ComponentDefinitionState = unknown,
> extends InternalComponentManager<ComponentInstanceState, ComponentDefinitionState> {
  // APIs for hooking into the debug render tree, used by components that
  // represent multiple logical components. Specifically, {{mount}} and {{outlet}}
  getDebugCustomRenderTree(
    definition: ComponentDefinitionState,
    state: ComponentInstanceState,
    args: CapturedArguments,
    template?: string
  ): CustomRenderNode[];
}

export interface WithPrepareArgs<
  ComponentInstanceState = unknown,
  ComponentDefinitionState = unknown,
> extends InternalComponentManager<ComponentInstanceState, ComponentDefinitionState> {
  // The component manager is asked to prepare the arguments needed
  // for `create`. This allows for things like closure> components where the
  // args need to be curried before constructing the instance of the state
  // bucket.
  prepareArgs(state: ComponentDefinitionState, args: VMArguments): Nullable<PreparedArguments>;
}

export interface WithSubOwner<ComponentInstanceState = unknown, ComponentDefinitionState = unknown>
  extends InternalComponentManager<ComponentInstanceState, ComponentDefinitionState> {
  getOwner(state: ComponentInstanceState): Owner;
}

export interface WithCreateInstance<
  ComponentInstanceState = unknown,
  ComponentDefinitionState = unknown,
  O extends Owner = Owner,
> extends InternalComponentManager<ComponentInstanceState, ComponentDefinitionState> {
  // The component manager is asked to create a bucket of state for
  // the supplied arguments. From the perspective of Glimmer, this is
  // an opaque token, but in practice it is probably a component object.
  create(
    owner: O,
    state: ComponentDefinitionState,
    args: Nullable<VMArguments>,
    env: Environment,
    dynamicScope: Nullable<DynamicScope>,
    caller: Nullable<Reference>,
    hasDefaultBlock: boolean
  ): ComponentInstanceState;

  // This hook is run after the entire layout has been rendered.
  //
  // Hosts should use `didCreate`, which runs asynchronously after the rendering
  // process, to provide hooks for user code.
  didRenderLayout(state: ComponentInstanceState, bounds: Bounds): void;

  // This hook is run after the entire layout has been updated.
  //
  // Hosts should use `didUpdate`, which runs asynchronously after the rendering
  // process, to provide hooks for user code.
  didUpdateLayout(state: ComponentInstanceState, bounds: Bounds): void;

  // Once the whole top-down rendering process is complete, Glimmer invokes
  // the `didCreate` callbacks.
  didCreate(state: ComponentInstanceState): void;

  // Finally, once top-down revalidation has completed, Glimmer invokes
  // the `didUpdate` callbacks on components that changed.
  didUpdate(state: ComponentInstanceState): void;
}

export interface WithUpdateHook<ComponentInstanceState = unknown>
  extends InternalComponentManager<ComponentInstanceState> {
  // When the component's tag has invalidated, the manager's `update` hook is
  // called.
  update(state: ComponentInstanceState, dynamicScope: Nullable<DynamicScope>): void;
}

export interface WithDynamicLayout<
  I = ComponentInstanceState,
  R extends Nullable<ClassicResolver> = Nullable<ClassicResolver>,
> extends InternalComponentManager<I> {
  // Return the compiled layout to use for this component. This is called
  // *after* the component instance has been created, because you might
  // want to return a different layout per-instance for optimization reasons
  // or to implement features like Ember's "late-bound" layouts.
  getDynamicLayout(component: I, resolver: R): CompilableProgram | null;
}

export interface WithDynamicTagName<ComponentInstanceState>
  extends InternalComponentManager<ComponentInstanceState> {
  // If the component asks for the dynamic tag name capability, ask for
  // the tag name to use. (Only used in the "WrappedBuilder".)
  getTagName(component: ComponentInstanceState): Nullable<string>;
}

export interface WithAttributeHook<ComponentInstanceState>
  extends InternalComponentManager<ComponentInstanceState> {
  didSplatAttributes(
    component: ComponentInstanceState,
    element: ComponentInstanceState,
    operations: ElementOperations
  ): void;
}

export interface WithElementHook<ComponentInstanceState>
  extends InternalComponentManager<ComponentInstanceState> {
  // The `didCreateElement` hook is run for non-tagless components after the
  // element as been created, but before it has been appended ("flushed") to
  // the DOM. This hook allows the manager to save off the element, as well as
  // install other dynamic attributes via the ElementOperations object.
  //
  // Hosts should use `didCreate`, which runs asynchronously after the rendering
  // process, to provide hooks for user code.
  didCreateElement(
    component: ComponentInstanceState,
    element: SimpleElement,
    operations: ElementOperations
  ): void;
}

export interface Invocation {
  handle: number;
  symbolTable: ProgramSymbolTable;
}
