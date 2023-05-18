// @ember/object/{core,mixin}.ts
/** @deprecated use WeakSet instead */
export const _WeakSet = WeakSet;

// @ember/object/core.ts
export { destroy } from '@glimmer/destroyable';
export { registerDestructor } from '@glimmer/destroyable';
export { isDestroyed } from '@glimmer/destroyable';
export { isDestroying } from '@glimmer/destroyable';

// @ember/object/compat.ts
export { tagFor } from '@glimmer/validator';
export { consumeTag } from '@glimmer/validator';
export type { UpdatableTag } from '@glimmer/validator';
export { updateTag } from '@glimmer/validator';
export { track } from '@glimmer/validator';
