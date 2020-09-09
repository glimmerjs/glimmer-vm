// eslint-disable-next-line node/no-extraneous-import
import { Reference } from '@glimmer/reference';
import { Optional } from '../core';

export interface ElementOperations {
  setAttribute(
    name: string,
    value: Reference,
    trusting: boolean,
    namespace: Optional<string>
  ): void;

  setStaticAttribute(name: string, value: string, namespace: Optional<string>): void;
}
