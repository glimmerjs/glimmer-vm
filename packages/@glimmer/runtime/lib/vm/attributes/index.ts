import { Simple, Option, Opaque, NodeToken } from "@glimmer/interfaces";
import { ElementBuilder } from '../element-builder';
import { Environment } from '../../environment';

export interface AppendAttribute {
  element: NodeToken;
  name: string;
  namespace: Option<Simple.Namespace>;
}

export interface UpdateAttribute {
  element: Simple.Element;
  name: string;
  namespace: Option<Simple.Namespace>;
}

export interface AttributeOperation {
  attribute: AppendAttribute | UpdateAttribute;
  set(dom: ElementBuilder, value: Opaque, env: Environment): void;
  update(value: Opaque, env: Environment): void;
}
