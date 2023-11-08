import type {
  Helper as GlimmerHelper,
  InternalModifierManager,
  Nullable,
  ResolutionTimeConstants,
  TemplateFactory,
} from '@glimmer/interfaces';
import type {CurriedValue} from '@glimmer/runtime';
import type { ComponentTypes } from '../../components';
import type {UserHelper} from '../../helpers';
import type {TestModifierConstructor} from '../../modifiers';
import type { DeclaredComponentType } from '../../test-helpers/constants';
import type { TestJitRegistry } from './registry';

import {
  getInternalComponentManager,
  setComponentTemplate,
  setInternalHelperManager,
  setInternalModifierManager,
} from '@glimmer/manager';
import {  curry, templateOnlyComponent } from '@glimmer/runtime';
import { CurriedTypes } from '@glimmer/vm';

import { createTemplate } from '../../compile';
import { EmberishCurlyComponent } from '../../components/emberish-curly';
import { GlimmerishComponent } from '../../components/emberish-glimmer';
import { createHelperRef  } from '../../helpers';
import {
  TestModifierDefinitionState,
  TestModifierManager
} from '../../modifiers';

export function registerTemplateOnlyComponent(
  registry: TestJitRegistry,
  name: string,
  layoutSource: string
): void {
  registerSomeComponent(
    registry,
    name,
    createTemplate(layoutSource),
    templateOnlyComponent(undefined, name)
  );
}

export function registerEmberishCurlyComponent(
  registry: TestJitRegistry,
  name: string,
  Component: Nullable<ComponentTypes['curly']>,
  layoutSource: Nullable<string>
): void {
  let ComponentClass = Component || class extends EmberishCurlyComponent {};

  registerSomeComponent(
    registry,
    name,
    layoutSource !== null ? createTemplate(layoutSource) : null,
    ComponentClass
  );
}

export function registerGlimmerishComponent(
  registry: TestJitRegistry,
  name: string,
  Component: Nullable<ComponentTypes['glimmer']>,
  layoutSource: Nullable<string>
): void {
  if (name.indexOf('-') !== -1) {
    throw new Error('DEPRECATED: dasherized components');
  }
  let ComponentClass = Component || class extends GlimmerishComponent {};

  registerSomeComponent(registry, name, createTemplate(layoutSource), ComponentClass);
}

export function registerHelper(registry: TestJitRegistry, name: string, helper: UserHelper) {
  let state = {};
  let glimmerHelper: GlimmerHelper = (args) => createHelperRef(helper, args);
  setInternalHelperManager(glimmerHelper, state);
  registry.register('helper', name, state);
}

export function registerInternalHelper(
  registry: TestJitRegistry,
  name: string,
  helper: GlimmerHelper
) {
  let state = {};
  setInternalHelperManager(helper, state);
  registry.register('helper', name, state);
}

export function registerInternalModifier(
  registry: TestJitRegistry,
  name: string,
  manager: InternalModifierManager<unknown, object>,
  state: object
) {
  setInternalModifierManager(manager, state);
  registry.register('modifier', name, state);
}

export function registerModifier(
  registry: TestJitRegistry,
  name: string,
  ModifierClass?: TestModifierConstructor
) {
  let state = new TestModifierDefinitionState(ModifierClass);
  let manager = new TestModifierManager();
  setInternalModifierManager(manager, state);
  registry.register('modifier', name, state);
}

export function registerComponent<K extends DeclaredComponentType>(
  registry: TestJitRegistry,
  type: K,
  name: string,
  layout: Nullable<string>,
  Class?: ComponentTypes[K]
): void {
  switch (type) {
    case 'glimmer':
      registerGlimmerishComponent(registry, name, Class as ComponentTypes['glimmer'], layout);
      break;
    case 'curly':
      registerEmberishCurlyComponent(registry, name, Class as ComponentTypes['curly'], layout);
      break;

    case 'dynamic':
      registerEmberishCurlyComponent(registry, name, Class as ComponentTypes['dynamic'], layout);
      break;
    case 'templateOnly':
      registerTemplateOnlyComponent(registry, name, layout ?? '');
      break;
  }
}

function registerSomeComponent(
  registry: TestJitRegistry,
  name: string,
  templateFactory: TemplateFactory | null,
  ComponentClass: object
) {
  if (templateFactory) {
    setComponentTemplate(templateFactory, ComponentClass);
  }

  let manager = getInternalComponentManager(ComponentClass);

  let definition = {
    name,
    state: ComponentClass,
    manager,
    template: null,
  };

  registry.register('component', name, definition);
  return definition;
}

export function componentHelper(
  registry: TestJitRegistry,
  name: string,
  constants: ResolutionTimeConstants
): Nullable<CurriedValue> {
  let definition = registry.lookupComponent(name);

  if (definition === null) return null;

  return curry(
    CurriedTypes.Component,
    constants.resolvedComponent(definition, name),
    {},
    null,
    true
  );
}
