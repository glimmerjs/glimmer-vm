import { SimpleElement } from '@simple-dom/interface';
import {
  Dict,
  Option,
  InternalModifierManager,
  Destroyable,
  CapturedArguments,
  Owner,
} from '@glimmer/interfaces';
import { registerDestructor } from '@glimmer/destroyable';
import { reifyPositional, reifyNamed } from '@glimmer/runtime';

export interface TestModifierConstructor {
  new (): TestModifierInstance;
}

export interface TestModifierInstance {
  element?: SimpleElement;
  didInsertElement?(_params: unknown[], _hash: Dict<unknown>): void;
  didUpdate?(_params: unknown[], _hash: Dict<unknown>): void;
  willDestroyElement?(): void;
}

export class TestModifierDefinitionState {
  constructor(public Klass?: TestModifierConstructor) {}
}

export class TestModifierManager
  implements InternalModifierManager<TestModifier, TestModifierDefinitionState> {
  create(
    _owner: Owner,
    element: SimpleElement,
    state: TestModifierDefinitionState,
    args: CapturedArguments
  ) {
    let instance = state.Klass ? new state.Klass() : undefined;
    return new TestModifier(element, instance, args);
  }

  getDebugName() {
    return '<unknown>';
  }

  install({ element, args, instance }: TestModifier) {
    // Do this eagerly to ensure they are tracked
    let positional = reifyPositional(args.positional);
    let named = reifyNamed(args.named);

    if (instance && instance.didInsertElement) {
      instance.element = element;
      instance.didInsertElement(positional, named);
    }

    if (instance && instance.willDestroyElement) {
      registerDestructor(instance, () => instance!.willDestroyElement!(), true);
    }
  }

  update({ args, instance }: TestModifier) {
    // Do this eagerly to ensure they are tracked
    let positional = reifyPositional(args.positional);
    let named = reifyNamed(args.named);

    if (instance && instance.didUpdate) {
      instance.didUpdate(positional, named);
    }
  }

  getDestroyable(modifier: TestModifier): Option<Destroyable> {
    return modifier.instance || null;
  }
}

export class TestModifier {
  constructor(
    public element: SimpleElement,
    public instance: TestModifierInstance | undefined,
    public args: CapturedArguments
  ) {}
}
