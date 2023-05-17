// @ember/-internals/glimmer/tests/integration/application/debug-render-tree-test.ts
export type { CapturedRenderNode } from '@glimmer/interfaces';
export { componentCapabilities } from '@glimmer/manager';
export { expect } from '@glimmer/util';
export type { SimpleElement, SimpleNode } from '@glimmer/interfaces';

// @ember/-internals/glimmer/tests/unit/runtime-resolver-cache-test.js
// @ember/-internals/glimmer/tests/unit/template-factory-test.js
export { templateCacheCounters } from '@glimmer/opcode-compiler';

// internal-test-helpers/lib/compile.ts
export { precompileJSON } from '@glimmer/compiler';
export type { SerializedTemplateWithLazyBlock, TemplateFactory } from '@glimmer/interfaces';
export { templateFactory } from '@glimmer/opcode-compiler';

// internal-test-helpers/lib/define-template-values.ts
export {
  helperCapabilities,
  modifierCapabilities,
  setHelperManager,
  setModifierManager,
} from '@glimmer/manager';

// internal-test-helpers/lib/module-for.ts
export { enableDestroyableTracking, assertDestroyablesDestroyed } from '@glimmer/destroyable';

// internal-test-helpers/lib/run.ts
export { destroy } from '@glimmer/destroyable';

// internal-test-helpers/lib/define-template-values.ts
// @ember/-internals/glimmer/tests/integration/application/debug-render-tree-test.ts
export { setComponentTemplate } from '@glimmer/manager';
export { templateOnlyComponent } from '@glimmer/runtime';
