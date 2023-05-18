// @ember/-internals/glimmer/lib/resolver.ts
export type {
  CompileTimeResolver,
  HelperDefinitionState,
  ModifierDefinitionState,
  Nullable as Option,
  ResolvedComponentDefinition,
  RuntimeResolver,
  Template,
  TemplateFactory,
} from '@glimmer/interfaces';
export {
  getComponentTemplate,
  getInternalComponentManager,
  setInternalHelperManager,
} from '@glimmer/manager';
export {
  TEMPLATE_ONLY_COMPONENT_MANAGER,
  array,
  concat,
  fn,
  get,
  hash,
  on,
  templateOnlyComponent,
} from '@glimmer/runtime';

export const _WeakSet = WeakSet;

// @ember/-internals/glimmer/lib/helpers/-resolve.ts
export { createConstRef } from '@glimmer/reference';
export { isConstRef } from '@glimmer/reference';
export type { CapturedArguments } from '@glimmer/interfaces';
export { valueForRef } from '@glimmer/reference';
