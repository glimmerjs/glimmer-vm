import { Source } from '../tracking';
import { Option } from '../core';

export interface ElementOperations {
  setAttribute(name: string, value: Source, trusting: boolean, namespace: Option<string>): void;

  setStaticAttribute(name: string, value: string, namespace: Option<string>): void;
}
