import type { SimpleElement } from '@glimmer/interfaces';
// Component() expects a serialized/precompiled template
import HTMLSerializer from '@simple-dom/serializer';
import voidMap from '@simple-dom/void-map';

import type { GlimmerRuntime } from '../core';

export type ComponentClass<T extends object> = new (owner: object, args: T) => object;

export function serialize(element: SimpleElement): string {
  return new HTMLSerializer(voidMap).serialize(element);
}

export async function rerender(runtime: GlimmerRuntime, block: () => void): Promise<void> {
  block();
  return runtime.didRender();
}
