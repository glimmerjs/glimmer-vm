import type {
  Arguments,
  SerializedTemplateWithLazyBlock,
  SimpleElement,
} from '@glimmer/interfaces';
import { componentCapabilities, setComponentManager, setComponentTemplate } from '@glimmer/manager';
import { templateFactory } from '@glimmer/opcode-compiler';
import { destroy } from '@glimmer/runtime';
// Component() expects a serialized/precompiled template
import { HTMLSerializer, voidMap } from 'simple-dom';

import { didRender } from '../core';

export type ComponentClass<T extends object> = new (owner: object, args: T) => object;

export function component(template: SerializedTemplateWithLazyBlock) {
  return <This extends ComponentClass<any>>(ComponentClass: This) => {
    define({ template, ComponentClass });

    return ComponentClass;
  };
}

export function define<T extends object>({
  template,
  ComponentClass,
}: {
  template: SerializedTemplateWithLazyBlock;
  ComponentClass: ComponentClass<T>;
}) {
  const factory = templateFactory(template);
  setComponentTemplate(factory, ComponentClass);
  setComponentManager(
    (owner) => ({
      capabilities: componentCapabilities('3.13', {
        destructor: true,
      }),
      createComponent: (component: ComponentClass<T>, args: Arguments) =>
        new component(owner, args.named as T),
      getContext: (component: object) => component,
      destroyComponent: (component: object) => {
        destroy(component);
      },
    }),
    ComponentClass
  );
}

export function serialize(element: SimpleElement): string {
  return new HTMLSerializer(voidMap).serialize(element);
}

export async function rerender(block: () => void): Promise<void> {
  block();
  return didRender();
}
