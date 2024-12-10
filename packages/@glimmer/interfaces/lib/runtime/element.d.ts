import type { Reference } from '@glimmer/state';

import type { Nullable } from '../core.js';

export interface ElementOperations {
  setAttribute(
    name: string,
    value: Reference,
    trusting: boolean,
    namespace: Nullable<string>
  ): void;

  setStaticAttribute(name: string, value: string, namespace: Nullable<string>): void;
}
