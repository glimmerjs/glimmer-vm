import { Opaque, Option, Simple } from '@glimmer/interfaces';
import { Environment } from '../../environment';
import { ElementBuilder } from '../element-builder';

export interface Attribute {
  element: Simple.Element;
  name: string;
  namespace: Option<string>;
}

export interface AttributeOperation {
  attribute: Attribute;
  set(dom: ElementBuilder, value: Opaque, env: Environment): void;
  update(value: Opaque, env: Environment): void;
}
