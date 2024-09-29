import type {
  Arguments,
  SerializedTemplateWithLazyBlock,
  SimpleElement,
} from '@glimmer/interfaces';
import { precompile } from '@glimmer/compiler';
import { componentCapabilities, setComponentManager, setComponentTemplate } from '@glimmer/manager';
import { templateFactory } from '@glimmer/opcode-compiler';
import { destroy } from '@glimmer/runtime';
// Component() expects a serialized/precompiled template
import { HTMLSerializer, voidMap } from 'simple-dom';

export function compile(
  source: string,
  locals: Record<string, unknown>,
  options: { module: string }
): SerializedTemplateWithLazyBlock {
  const output = precompile(source, {
    strictMode: true,
    lexicalScope: (v: string) => v in locals,
    meta: { moduleName: options.module },
  });

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(...Object.keys(locals), `return ${output};`);
  return fn(...Object.values(locals));
}

export type ComponentClass = new (owner: object, args: Record<string, unknown>) => object;

export function define({
  template,
  ComponentClass,
}: {
  template: SerializedTemplateWithLazyBlock;
  ComponentClass: ComponentClass;
}) {
  const factory = templateFactory(template);
  setComponentTemplate(factory, ComponentClass);
  setComponentManager(
    (owner) => ({
      capabilities: componentCapabilities('3.13', {
        destructor: true,
      }),
      createComponent: (component: ComponentClass, args: Arguments) =>
        new component(owner, args.named),
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
