import type { Dict, Nullable, SimpleElement } from '@glimmer/interfaces';

import { assertElementShape, assertEmberishElement } from '../dom/assertions';
import {
  registerEmberishCurlyComponent,
  registerGlimmerishComponent,
  registerTemplateOnlyComponent,
} from '../modes/jit/register';
import type { TestJitRegistry } from '../modes/jit/registry';
import type { DeclaredComponentType } from '../test-helpers/constants';
import {
  BuildCurlyInvoke,
  BuildCurlyTemplate,
  BuildDynamicInvoke,
  BuildDynamicTemplate,
  BuildGlimmerInvoke,
  BuildGlimmerTemplate,
  type BuildInvocation,
  type BuildTemplate,
} from './styles';
import type { ComponentBlueprint, ComponentTypes } from './types';

export function buildTemplate<K extends DeclaredComponentType>(
  delegate: ComponentDelegate<K>,
  component: ComponentBlueprint
): string {
  const build = delegate.build;

  const template = build.template(component);
  QUnit.assert.ok(true, `generated ${delegate.type} layout as ${template}`);

  return template;
}

export function buildInvoke<K extends DeclaredComponentType>(
  delegate: ComponentDelegate<K>,
  component: ComponentBlueprint
): { name: string; invocation: string } {
  const build = delegate.build;

  const invocation = build.invoke(component);
  QUnit.assert.ok(
    true,
    `generated ${delegate.type} invocation as ${invocation.invocation} (name=${invocation.name})`
  );

  return invocation;
}

export interface BuildDelegate {
  style: BuildStyle;
  template: BuildTemplate;
  invoke: BuildInvocation;
}

export interface ComponentDelegate<K extends DeclaredComponentType = DeclaredComponentType> {
  readonly type: K;

  register: (
    registry: TestJitRegistry,
    name: string,
    layout: Nullable<string>,
    Class?: ComponentTypes[K]
  ) => void;

  assert: (element: SimpleElement, tagName: string, attrs?: Dict, contents?: string) => void;

  build: BuildDelegate;
}

export type BuildStyle = 'angle' | 'curlies';

export const GlimmerDelegate: ComponentDelegate<'glimmer'> = {
  type: 'glimmer',
  register: (registry, name, layout, Class) => {
    registerGlimmerishComponent(registry, name, Class ?? null, layout);
  },

  assert: assertElementShape,

  build: {
    style: 'angle',
    template: BuildGlimmerTemplate,
    invoke: BuildGlimmerInvoke,
  },
};

export const CurlyDelegate: ComponentDelegate<'curly'> = {
  type: 'curly',
  register: (registry, name, layout, Class) => {
    registerEmberishCurlyComponent(registry, name, Class ?? null, layout);
  },

  assert: assertEmberishElement,

  build: {
    style: 'curlies',
    template: BuildCurlyTemplate,
    invoke: BuildCurlyInvoke,
  },
};

export const DynamicDelegate: ComponentDelegate<'dynamic'> = {
  type: 'dynamic',
  register: (registry, name, layout, Class) => {
    registerEmberishCurlyComponent(registry, name, Class ?? null, layout);
  },

  assert: assertEmberishElement,

  build: {
    style: 'curlies',
    invoke: BuildDynamicInvoke,
    template: BuildDynamicTemplate,
  },
};

export const TemplateOnlyDelegate: ComponentDelegate<'templateOnly'> = {
  type: 'templateOnly',
  register: (registry, name, layout) => {
    registerTemplateOnlyComponent(registry, name, layout ?? '');
  },

  assert: assertElementShape,

  build: {
    style: 'angle',
    template: BuildGlimmerTemplate,
    invoke: BuildGlimmerInvoke,
  },
};

const DELEGATES = {
  glimmer: GlimmerDelegate,
  curly: CurlyDelegate,
  dynamic: DynamicDelegate,
  templateOnly: TemplateOnlyDelegate,
} as const satisfies { [K in DeclaredComponentType]: ComponentDelegate<K> };
type DELEGATES = typeof DELEGATES;

export const getDelegate = <K extends DeclaredComponentType>(type: K): ComponentDelegate<K> => {
  return DELEGATES[type] as ComponentDelegate<K>;
};
