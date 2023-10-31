import type { Dict, Nullable, SimpleElement } from '@glimmer/interfaces';
import type { TestJitRegistry } from '../modes/jit/registry';
import {
  BuildCurlyComponent,
  BuildDynamicComponent,
  BuildGlimmerComponent,
  type ComponentStyle,
} from './styles';
import type { ComponentBlueprint, ComponentKind, ComponentTypes } from './types';
import {
  registerEmberishCurlyComponent,
  registerGlimmerishComponent,
  registerTemplateOnlyComponent,
} from '../modes/jit/register';
import { assertElementShape, assertEmberishElement } from '../dom/assertions';

type Register<K extends ComponentKind> = (
  type: K,
  name: string,
  layout: Nullable<string>,
  Class?: ComponentTypes[K]
) => void;

export function build<K extends ComponentKind>(
  delegate: ComponentDelegate<K>,
  component: ComponentBlueprint,
  register: Register<K>
): string {
  const build = delegate.build;

  const { name, invocation, template } = build.component(component);
  QUnit.assert.ok(true, `generated ${delegate.type} layout as ${template}`);
  QUnit.assert.ok(true, `generated ${delegate.type} invocation as ${invocation}`);

  register(delegate.type, name, template);

  return invocation;
}

export interface BuildDelegate {
  style: BuildStyle;
  component: ComponentStyle;
}

export interface ComponentDelegate<K extends ComponentKind = ComponentKind> {
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

export const GlimmerDelegate: ComponentDelegate<'Glimmer'> = {
  type: 'Glimmer',
  register: (registry, name, layout, Class) => {
    registerGlimmerishComponent(registry, name, Class ?? null, layout);
  },

  assert: assertElementShape,

  build: {
    style: 'angle',
    component: BuildGlimmerComponent,
  },
};

export const CurlyDelegate: ComponentDelegate<'Curly'> = {
  type: 'Curly',
  register: (registry, name, layout, Class) => {
    registerEmberishCurlyComponent(registry, name, Class ?? null, layout);
  },

  assert: assertEmberishElement,

  build: {
    style: 'curlies',
    component: BuildCurlyComponent,
  },
};

export const DynamicDelegate: ComponentDelegate<'Dynamic'> = {
  type: 'Dynamic',
  register: (registry, name, layout, Class) => {
    registerEmberishCurlyComponent(registry, name, Class ?? null, layout);
  },

  assert: assertEmberishElement,

  build: {
    style: 'curlies',
    component: BuildDynamicComponent,
  },
};

export const TemplateOnlyDelegate: ComponentDelegate<'TemplateOnly'> = {
  type: 'TemplateOnly',
  register: (registry, name, layout) => {
    registerTemplateOnlyComponent(registry, name, layout ?? '');
  },

  assert: assertElementShape,

  build: {
    style: 'angle',
    component: BuildGlimmerComponent,
  },
};

const DELEGATES = {
  Glimmer: GlimmerDelegate,
  Curly: CurlyDelegate,
  Dynamic: DynamicDelegate,
  TemplateOnly: TemplateOnlyDelegate,
} as const satisfies { [K in ComponentKind]: ComponentDelegate<K> };
type DELEGATES = typeof DELEGATES;

export const getDelegate = <K extends ComponentKind>(type: K): ComponentDelegate<K> => {
  return DELEGATES[type] as ComponentDelegate<K>;
};
