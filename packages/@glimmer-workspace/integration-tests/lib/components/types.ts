import type { Dict } from '@glimmer/interfaces';
import type { TemplateOnlyComponent } from '@glimmer/runtime';

import type { EmberishCurlyComponent } from './emberish-curly';
import type { GlimmerishComponent } from './emberish-glimmer';

export type EveryComponentKind = ComponentKind | 'Custom';
export type ComponentKind = 'Glimmer' | 'Curly' | 'Dynamic' | 'TemplateOnly';

export interface TestComponentConstructor<T> {
  new (): T;
}

export interface ComponentTypes {
  glimmer: typeof GlimmerishComponent;
  curly: TestComponentConstructor<EmberishCurlyComponent>;
  dynamic: TestComponentConstructor<EmberishCurlyComponent>;
  templateOnly: TemplateOnlyComponent;
  custom: unknown;
  unknown: unknown;
}

export interface ComponentBlueprint {
  layout: string;
  tag?: string;
  else?: string;
  template?: string;
  name?: string;
  args?: Dict;
  attributes?: Dict;
  layoutAttributes?: Dict;
  blockParams?: string[];
}

export const GLIMMER_TEST_COMPONENT = 'TestComponent';
export const CURLY_TEST_COMPONENT = 'test-component';
