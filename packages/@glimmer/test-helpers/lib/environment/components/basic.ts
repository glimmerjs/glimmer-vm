import { TestResolver, TestSpecifier } from '../lazy-env';
import { GenericComponentDefinition, GenericComponentManager, createTemplate } from '../shared';

import { Opaque } from '@glimmer/interfaces';
import { UpdatableReference } from '@glimmer/object-reference';
import { ComponentCapabilities, TemplateOptions } from '@glimmer/opcode-compiler';
import { CONSTANT_TAG, PathReference, Tag } from '@glimmer/reference';
import { Bounds, Environment, Invocation, ScannableTemplate, WithStaticLayout } from '@glimmer/runtime';
import { unreachable } from '@glimmer/util';

export class BasicComponentManager extends GenericComponentManager implements WithStaticLayout<BasicComponent, BasicComponentDefinition, TestSpecifier, TestResolver> {
  prepareArgs(): null {
    throw unreachable();
  }

  create(_env: Environment, definition: BasicComponentDefinition): BasicComponent {
    let klass = definition.ComponentClass || BasicComponent;
    return new klass();
  }

  getLayout({ name }: BasicComponentDefinition, resolver: TestResolver): Invocation {
    let compile = (source: string, options: TemplateOptions<TestSpecifier>) => {
      let layout = createTemplate(source);
      let template = new ScannableTemplate(options, layout).asLayout();

      return {
        handle: template.compile(),
        symbolTable: template.symbolTable
      };
    };

    let handle = resolver.lookup('template-source', name)!;

    return resolver.compileTemplate(handle, name, compile);
  }

  getSelf(component: BasicComponent): PathReference<Opaque> {
    return new UpdatableReference(component);
  }

  getTag(): Tag {
    return CONSTANT_TAG;
  }

  didCreateElement(component: BasicComponent, element: Element): void {
    component.element = element;
  }

  didRenderLayout(component: BasicComponent, bounds: Bounds): void {
    component.bounds = bounds;
  }

  didCreate(): void { }

  update(): void { }

  didUpdateLayout(): void { }

  didUpdate(): void { }

  getDestructor(): null {
    return null;
  }
}

export const BASIC_COMPONENT_MANAGER = new BasicComponentManager();

export interface BasicComponentFactory {
  new (): BasicComponent;
}

export class BasicComponentDefinition extends GenericComponentDefinition<BasicComponent> {
  name: string;
  ComponentClass: BasicComponentFactory;
  capabilities: ComponentCapabilities = {
    staticDefinitions: false,
    dynamicLayout: false,
    dynamicTag: false,
    prepareArgs: false,
    createArgs: false,
    attributeHook: true,
    elementHook: false
  };
}

export class BasicComponent {
  element: Element;
  bounds: Bounds;
}
