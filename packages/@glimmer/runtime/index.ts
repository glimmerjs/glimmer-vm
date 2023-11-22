/**
 * @deprecated use RichIteratorResult<Tick, Return> or TemplateIterator instead
 */
import './lib/bootstrap';

import type { RichIteratorResult } from '@glimmer/interfaces';

// Currently we need to re-export these values for @glimmer/component
// https://github.com/glimmerjs/glimmer.js/issues/319
export { destroy, isDestroyed, isDestroying, registerDestructor } from '@glimmer/destroyable';
export { ConcreteBounds, CursorImpl, clear } from './lib/bounds';
export {
  resetDebuggerCallback,
  setDebuggerCallback,
  type DebugCallback,
} from './lib/compiled/opcodes/debugger';
export {
  TEMPLATE_ONLY_COMPONENT_MANAGER,
  TemplateOnlyComponentDefinition as TemplateOnlyComponent,
  TemplateOnlyComponentManager,
  templateOnlyComponent,
} from './lib/component/template-only';
export { CurriedValue, curry } from './lib/curried-value';
export {
  DOMChanges,
  DOMTreeConstruction,
  DOMChangesImpl as IDOMChanges,
  isWhitespace,
} from './lib/dom/helper';
export { normalizeProperty } from './lib/dom/props';
export {
  EnvironmentImpl,
  inTransaction,
  runtimeContext,
  type EnvironmentDelegate,
} from './lib/environment';
export { array } from './lib/helpers/array';
export { concat } from './lib/helpers/concat';
export { fn } from './lib/helpers/fn';
export { get } from './lib/helpers/get';
export { hash } from './lib/helpers/hash';
export { invokeHelper } from './lib/helpers/invoke';
export { on } from './lib/modifiers/on';
export { renderComponent, renderMain, renderSync } from './lib/render';
export { DynamicScopeImpl, PartialScopeImpl } from './lib/scope';
export type { SafeString } from './lib/upsert';
export { VM as LowLevelVM, UpdatingVM, type InternalVM } from './lib/vm';
export {
  EMPTY_ARGS,
  EMPTY_NAMED,
  EMPTY_POSITIONAL,
  createCapturedArgs,
  reifyArgs,
  reifyNamed,
  reifyPositional,
} from './lib/vm/arguments';
export {
  DynamicAttribute,
  SimpleDynamicAttribute,
  dynamicAttribute,
} from './lib/vm/attributes/dynamic';
export {
  NewElementBuilder,
  RemoteLiveBlock,
  UpdatableBlockImpl,
  clientBuilder,
} from './lib/vm/element-builder';
export {
  RehydrateBuilder,
  SERIALIZATION_FIRST_NODE_STRING,
  isSerializationFirstNode,
  rehydrationBuilder,
} from './lib/vm/rehydrate-builder';

export type IteratorResult<T> = RichIteratorResult<null, T>;
