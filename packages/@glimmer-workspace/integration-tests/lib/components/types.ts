import type { Dict } from '@glimmer/interfaces';
import type { TemplateOnlyComponent } from '@glimmer/runtime';

import type { EmberishCurlyComponent } from './emberish-curly';
import type { GlimmerishComponent } from './emberish-glimmer';

export type ComponentKind = 'Glimmer' | 'Curly' | 'Dynamic' | 'TemplateOnly' | 'Custom' | 'unknown';

export interface TestComponentConstructor<T> {
  new (): T;
}

export interface ComponentTypes {
  Glimmer: typeof GlimmerishComponent;
  Curly: TestComponentConstructor<EmberishCurlyComponent>;
  Dynamic: TestComponentConstructor<EmberishCurlyComponent>;
  TemplateOnly: TemplateOnlyComponent;
  Custom: unknown;
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
