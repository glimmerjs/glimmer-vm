import {
  CapturedArguments,
  ComponentManager,
  WithStaticLayout,
  Environment,
  Arguments,
  Invocation,
} from '@glimmer/runtime';
import { Opaque, ComponentCapabilities, Dict } from '@glimmer/interfaces';
import { PathReference, Tag, combine, createTag, DirtyableTag, dirty } from '@glimmer/reference';
import { UpdatableReference } from '@glimmer/object-reference';
import { Destroyable } from '@glimmer/util';

import { createTemplate } from '../shared';
import { BASIC_CAPABILITIES } from './basic';
import { TestComponentDefinitionState } from '../components';
import LazyRuntimeResolver from '../modes/lazy/runtime-resolver';
import EagerRuntimeResolver from '../modes/eager/runtime-resolver';
import {} from '@glimmer/bundle-compiler';

export type BasicCurlyArgs = {
  named: Dict<Opaque>;
  positional: Opaque[];
};

export const BASIC_CURLY_CAPABILITIES = {
  ...BASIC_CAPABILITIES,
  createArgs: true,
  updateHook: true,
};

export interface BasicCurlyComponentState {
  args: CapturedArguments;
  component: BasicCurlyComponent;
}

export class BasicCurlyComponentManager
  implements
    ComponentManager<BasicCurlyComponentState, TestComponentDefinitionState>,
    WithStaticLayout<
      BasicCurlyComponentState,
      TestComponentDefinitionState,
      Opaque,
      LazyRuntimeResolver
    > {
  getCapabilities(state: TestComponentDefinitionState): ComponentCapabilities {
    return state.capabilities;
  }

  prepareArgs(): null {
    return null;
  }

  create(
    _environment: Environment,
    definition: TestComponentDefinitionState,
    _args: Arguments,
    _dynamicScope: any,
    _callerSelf: PathReference<Opaque>,
    _hasDefaultBlock: boolean
  ): BasicCurlyComponentState {
    let args = _args.capture();
    let klass: typeof BasicCurlyComponent = definition.ComponentClass || BaseBasicCurlyComponent;
    let invocationArgs = { named: args.named.value(), positional: args.positional.value() };
    let component = new klass(invocationArgs);

    return { args, component };
  }

  getTag({ args: { tag }, component: { dirtinessTag } }: BasicCurlyComponentState): Tag {
    return combine([tag, dirtinessTag]);
  }

  getLayout(
    state: TestComponentDefinitionState,
    resolver: LazyRuntimeResolver | EagerRuntimeResolver
  ): Invocation {
    let { name, locator } = state;
    if (resolver instanceof LazyRuntimeResolver) {
      let compile = (source: string) => {
        let template = createTemplate(source);
        let layout = template.create(resolver.compiler).asLayout();

        return {
          handle: layout.compile(),
          symbolTable: layout.symbolTable,
        };
      };

      let handle = resolver.lookup('template-source', name)!;

      return resolver.compileTemplate(handle, name, compile);
    }

    return resolver.getInvocation(locator.meta);
  }

  getSelf({ component }: BasicCurlyComponentState): PathReference<Opaque> {
    return new UpdatableReference(component);
  }

  didCreateElement(): void {}
  didRenderLayout(): void {}
  didCreate(): void {}

  update({ args, component }: BasicCurlyComponentState): void {
    component.args = { named: args.named.value(), positional: args.positional.value() };
    component.recompute();
  }

  didUpdateLayout(): void {}
  didUpdate(): void {}

  getDestructor({ component }: BasicCurlyComponentState): Destroyable {
    return {
      destroy() {
        component.destroy();
      },
    };
  }
}

export class BasicCurlyComponent {
  public dirtinessTag: DirtyableTag = createTag();

  constructor(public args: BasicCurlyArgs) {}

  recompute() {
    dirty(this.dirtinessTag);
  }

  destroy() {}
}

const BaseBasicCurlyComponent = class extends BasicCurlyComponent {};
