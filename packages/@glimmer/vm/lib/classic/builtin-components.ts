// @ember/-internals/glimmer/lib/components/abstract-input.ts
export { isUpdatableRef } from '@glimmer/reference';

// @ember/-internals/glimmer/lib/components/{abstract-input,internal}.ts
export type { Reference } from '@glimmer/reference';
export { isConstRef } from '@glimmer/reference';

// @ember/-internals/glimmer/lib/components/{input,internal,link-to}.ts
export { untrack } from '@glimmer/validator';

// @ember/-internals/glimmer/lib/components/internal.ts
export { setInternalComponentManager } from '@glimmer/manager';
export type { Environment } from '@glimmer/interfaces';
export type { DynamicScope } from '@glimmer/interfaces';
export type { TemplateFactory } from '@glimmer/interfaces';
export type {
  CapabilityMask as InternalComponentCapabilities,
  VMArguments,
} from '@glimmer/interfaces';
export { createConstRef } from '@glimmer/reference';
export type { InternalComponentManager } from '@glimmer/interfaces';
export { setComponentTemplate } from '@glimmer/manager';

// @ember/-internals/glimmer/lib/components/link-to.ts
export type { Nullable as Option } from '@glimmer/interfaces';
export { tagFor } from '@glimmer/validator';
export type { Optional as Maybe } from '@glimmer/interfaces';
export { createCache, getValue } from '@glimmer/validator';
export { consumeTag } from '@glimmer/validator';
