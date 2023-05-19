import { debug } from '@glimmer/validator';

// ember/index.ts
// @ember/modifier/index.ts
export { on } from '@glimmer/runtime';

// ember/index.ts
// @ember/helper/index.ts
export { array, concat, fn, get, hash } from '@glimmer/runtime';

// ember/index.ts
// @ember/component/template-only.ts
export { templateOnlyComponent } from '@glimmer/runtime';

// @ember/-internals/glimmer/lib/component.ts
export { normalizeProperty } from '@glimmer/runtime';

// @ember/-internals/glimmer/lib/component.ts
// @ember/-internals/glimmer/lib/utils/process-args.ts
export { isUpdatableRef } from '@glimmer/reference';

// @ember/-internals/glimmer/lib/component.ts
// @ember/-internals/glimmer/lib/utils/process-args.ts
// @ember/-internals/glimmer/lib/views/outlet.ts
export { updateRef } from '@glimmer/reference';

// @ember/-internals/glimmer/lib/environment.ts
export type { EnvironmentDelegate } from '@glimmer/runtime';
export { setGlobalContext } from '@glimmer/global-context';

const setTrackingTransactionEnv = import.meta.env.DEV
  ? debug.setTrackingTransactionEnv!
  : undefined;
/** @deprecated use debbug.setTrackingTransactionEnv instead */
export { setTrackingTransactionEnv };

// @ember/-internals/glimmer/lib/{environment,renderer,component}.ts
// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/component-managers/{outlet,root}.ts
export type { Environment } from '@glimmer/interfaces';

// ember/index.ts
// @ember/template-factory/index.ts
// @ember/-internals/glimmer/lib/index.ts
export { templateFactory } from '@glimmer/opcode-compiler';

// @ember/template-factory/index.ts
// @ember/-internals/glimmer/lib/index.ts
export { templateCacheCounters } from '@glimmer/opcode-compiler';

// @ember/-internals/glimmer/lib/{helper,component}.ts
export type { DirtyableTag } from '@glimmer/validator';

// @ember/-internals/glimmer/lib/{helper,component}.ts
// @ember/-internals/glimmer/lib/views/outlet.ts
export { createTag, dirtyTag } from '@glimmer/validator';

// @ember/routing/lib/dsl.ts
// @ember/-internals/glimmer/lib/renderer.ts
// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/component-managers/{outlet,root}.ts
// @ember/-internals/glimmer/lib/syntax/{mount,utils}.ts
// @ember/-internals/glimmer/lib/utils/iterator.ts
// @ember/-internals/views/lib/system/utils.ts
export type { Nullable as Option } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/renderer.ts
export type { Bounds } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/renderer.ts
// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/component-managers/{outlet}.ts
// @ember/-internals/glimmer/lib/helpers/{action,unique-id}.ts
// @ember/-internals/glimmer/lib/syntax/{mount,outlet}.ts
// @ember/-internals/glimmer/lib/utils/{bindings,process-args}.ts
// @ember/-internals/glimmer/lib/views/outlet.ts
export type { Reference } from '@glimmer/reference';

// @ember/destroyable/index.ts
// @ember/-internals/glimmer/lib/renderer.ts
export { destroy } from '@glimmer/destroyable';

// @ember/-internals/glimmer/lib/renderer.ts
export type {
  CompileTimeCompilationContext,
  Cursor,
  DebugRenderTree,
  ElementBuilder,
  RenderResult,
  RuntimeContext,
} from '@glimmer/interfaces';
export { programCompilationContext } from '@glimmer/opcode-compiler';
export { artifacts } from '@glimmer/program';
export { UNDEFINED_REFERENCE } from '@glimmer/reference';
export { inTransaction, renderMain, runtimeContext } from '@glimmer/runtime';
export type { SimpleDocument, SimpleNode } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/{observer,renderer}.ts
export { CURRENT_TAG } from '@glimmer/validator';

// @ember/-internals/glimmer/lib/syntax/outlet.ts
// @ember/-internals/glimmer/lib/renderer.ts
export type { DynamicScope } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/syntax/{mount,outlet}.ts
// @ember/-internals/glimmer/lib/renderer.ts
export type { CurriedType } from '@glimmer/interfaces';
export type { CurriedValue } from '@glimmer/runtime';
export { curry } from '@glimmer/runtime';

// @ember/-internals/glimmer/lib/{renderer,component}.ts
export type { /** @deprecated */ Namespace } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/{renderer,component,template}.ts
// @ember/-internals/glimmer/lib/component-managers/outlet.ts
// @ember/-internals/glimmer/lib/utils/outlet.ts
// @ember/-internals/glimmer/lib/views/outlet.ts
// @ember/routing/{route,router}.ts
export type { Template } from '@glimmer/interfaces';

// @ember/routing/route.ts
// @ember/template-compilation/index.ts
// @ember/-internals/glimmer/lib/{template_registry,renderer,component,template-registry,template}.ts
// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/templates/{empty,input,link-to,outlet,root,textarea}.d.ts
// @ember/-internals/glimmer/lib/{utils,views}/outlet.ts
export type { TemplateFactory } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/renderer.ts
export { valueForTag, validateTag } from '@glimmer/validator';

// @ember/-internals/glimmer/lib/renderer.ts
// @ember/-internals/glimmer/lib/modifiers/{action,internal}.ts
// @ember/-internals/views/lib/system/utils.ts
export type { SimpleElement } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/{renderer,dom}.ts
export { clientBuilder } from '@glimmer/runtime';
export { DOMChanges, DOMTreeConstruction } from '@glimmer/runtime';

// @ember/-internals/glimmer/lib/template.ts
export type { SerializedTemplateWithLazyBlock } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/utils/bindings.ts
export type { ElementOperations } from '@glimmer/interfaces';
export { childRefFor, createPrimitiveRef } from '@glimmer/reference';

// @ember/-internals/glimmer/lib/utils/iterator.ts
// @ember/routing/router-service.ts
export { tagFor } from '@glimmer/validator';

// @ember/-internals/glimmer/lib/helpers/-in-element-null-check.ts
// @ember/-internals/glimmer/lib/helpers/internal-helper.ts
export type { Helper } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/component-managers/outlet.ts
// @ember/-internals/glimmer/lib/helpers/-disallow-dynamic-resolution.ts
// @ember/-internals/glimmer/lib/helpers/-in-element-null-check.ts
// @ember/-internals/glimmer/lib/helpers/-normalize-class.ts
// @ember/-internals/glimmer/lib/helpers/each-in.ts
// @ember/-internals/glimmer/lib/modifiers/internal.ts
// @ember/-internals/glimmer/lib/syntax/mount.ts
// @ember/-internals/glimmer/lib/syntax/outlet.ts
export type { CapturedArguments } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/helpers/{-disallow-dynamic-resolution,-in-element-null-check,-normalize-class,each-in}.ts
// @ember/-internals/glimmer/lib/syntax/{mount,outlet}.ts
// @ember/-internals/glimmer/lib/utils/bindings.ts
// @ember/-internals/glimmer/lib/views/outlet.ts
export { createComputeRef } from '@glimmer/reference';

// @ember/-internals/glimmer/lib/renderer.ts
// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/component-managers/outlet.ts
// @ember/-internals/glimmer/lib/helpers/-disallow-dynamic-resolution.ts
// @ember/-internals/glimmer/lib/helpers/-in-element-null-check.ts
// @ember/-internals/glimmer/lib/helpers/-normalize-class.ts
// @ember/-internals/glimmer/lib/helpers/each-in.ts
// @ember/-internals/glimmer/lib/modifiers/internal.ts
// @ember/-internals/glimmer/lib/syntax/{mount,outlet}.ts
// @ember/-internals/glimmer/lib/utils/{bindings,process-args}.ts
export { valueForRef } from '@glimmer/reference';

// @ember/routing/router-service.ts
// @ember/-internals/glimmer/lib/{helper,component}.ts
// @ember/-internals/glimmer/lib/component-managers/root.ts
// @ember/-internals/glimmer/lib/helpers/each-in.ts
// @ember/-internals/glimmer/lib/utils/{iterator,to-bool}.ts
// @ember/-internals/glimmer/lib/views/outlet.ts
export { consumeTag } from '@glimmer/validator';

// @ember/-internals/glimmer/lib/utils/process-args.ts
export type { CapturedNamedArguments } from '@glimmer/interfaces';

// @ember/-internals/meta/lib/meta.ts
export type { UpdatableTag } from '@glimmer/validator';

// @ember/-internals/glimmer/lib/modifiers/internal.ts
// @ember/destroyable/index.ts
export { registerDestructor } from '@glimmer/destroyable';

// @ember/-internals/glimmer/lib/syntax/{mount,outlet}.ts
export { createCapturedArgs, EMPTY_POSITIONAL } from '@glimmer/runtime';

// @ember/-internals/glimmer/lib/syntax/outlet.ts
export { createDebugAliasRef } from '@glimmer/reference';
export { dict } from '@glimmer/util';

// @ember/-internals/glimmer/lib/syntax/outlet.ts
// @ember/-internals/glimmer/lib/utils/bindings.ts
export { childRefFromParts } from '@glimmer/reference';

// @ember/-internals/glimmer/lib/syntax/utils.ts
export type { Core, PresentArray } from '@glimmer/interfaces';

// @ember/-internals/meta/lib/meta.ts
export type { Revision } from '@glimmer/validator';

// @ember/-internals/utils/lib/mandatory-setter.ts
export type { Tag } from '@glimmer/validator';

// @ember/-internals/glimmer/lib/utils/iterator.ts
export type { IteratorDelegate } from '@glimmer/reference';

// @ember/-internals/glimmer/lib/utils/iterator.ts
export { isTracking } from '@glimmer/validator';

// @ember/-internals/glimmer/lib/utils/string.ts
export type { SafeString } from '@glimmer/runtime';

// @ember/-internals/meta/lib/meta.ts
// @ember/destroyable/index.ts
export { isDestroyed } from '@glimmer/destroyable';

// @ember/-internals/owner/index.ts
export { getOwner, setOwner } from '@glimmer/owner';

// @ember/-internals/views/lib/system/utils.ts
export type { Dict } from '@glimmer/interfaces';

// @ember/destroyable/index.ts
export { assertDestroyablesDestroyed, enableDestroyableTracking } from '@glimmer/destroyable';
export { unregisterDestructor } from '@glimmer/destroyable';

// @ember/destroyable/index.ts
export { isDestroying } from '@glimmer/destroyable';

// @ember/helper/index.ts
// ember/index.ts
export { invokeHelper } from '@glimmer/runtime';

// FIXME: restore compat for this API
// export { OWNER } from '@glimmer/owner';

// @ember/-internals/glimmer/index.ts
// @ember/application/tests/visit_test.ts
// ember/index.ts
// ember/tests/reexports_test.js
export { isSerializationFirstNode } from '@glimmer/runtime';

export { debug };

//////////////////////////////
////////// MANAGERS //////////
//////////////////////////////

// @ember/-internals/glimmer/lib/modifiers/internal.ts
export type { InternalModifierManager } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/component-managers.ts
export type { WithSubOwner } from '@glimmer/interfaces';

// @ember/destroyable/index.ts
// @ember/-internals/glimmer/lib/component-managers.ts
export { associateDestroyableChild } from '@glimmer/destroyable';

// @ember/modifier/index.ts
export { setModifierManager } from '@glimmer/manager';
export type { ModifierManager } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/utils/managers.ts
export type { ComponentManager } from '@glimmer/interfaces';
export { componentCapabilities, modifierCapabilities, setComponentManager } from '@glimmer/manager';

// @ember/-internals/glimmer/lib/helpers/internal-helper.ts
export type { HelperDefinitionState } from '@glimmer/interfaces';
export { setInternalHelperManager } from '@glimmer/manager';

// @ember/-internals/glimmer/lib/component.ts
export { setInternalComponentManager } from '@glimmer/manager';

// @ember/-internals/glimmer/lib/helper.ts
export type { Arguments, HelperManager } from '@glimmer/interfaces';
export { getInternalHelperManager } from '@glimmer/manager';

// @ember/helper/index.ts
// @ember/-internals/glimmer/lib/helper.ts
export { helperCapabilities, setHelperManager } from '@glimmer/manager';

// @ember/-internals/glimmer/lib/component-managers/outlet.ts
export type { InternalComponentCapability } from '@glimmer/interfaces';
export { EMPTY_ARGS } from '@glimmer/runtime';

// @ember/-internals/glimmer/lib/component-managers.ts
export type { WithDynamicLayout } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/component-managers/outlet.ts
// @ember/-internals/glimmer/lib/modifiers/internal.ts
export type { Destroyable, WithCreateInstance } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/component-managers/outlet.ts
// @ember/-internals/glimmer/lib/component-managers/root.ts
export type {
  CapabilityMask as InternalComponentCapabilities,
  VMArguments,
} from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/renderer.ts
// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/component-managers/outlet.ts
export { unwrapTemplate } from '@glimmer/util';

// @ember/-internals/glimmer/lib/renderer.ts
// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/component-managers/outlet.ts
// @ember/-internals/glimmer/lib/helpers/unique-id.ts
export { createConstRef } from '@glimmer/reference';

// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/component-managers/outlet.ts
export type { CustomRenderNode, WithCustomDebugRenderTree } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/component-managers.ts
// @ember/-internals/glimmer/lib/component-managers/outlet.ts
// @ember/-internals/glimmer/lib/component-managers/root.ts
export { capabilityMaskFrom } from '@glimmer/manager';
export type { ComponentDefinition } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/component-managers/outlet.ts
export type { CompilableProgram, WithDynamicTagName } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/component-managers/root.ts
export type { Owner } from '@glimmer/interfaces';

// @ember/-internals/glimmer/lib/component-managers/root.ts
export { CONSTANT_TAG } from '@glimmer/validator';
