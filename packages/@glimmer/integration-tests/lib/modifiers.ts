import { SimpleElement } from '@simple-dom/interface';
import {
  Dict,
  ModifierManager,
  GlimmerTreeChanges,
  DynamicScope,
  VMArguments,
  CapturedArguments,
} from '@glimmer/interfaces';
import { Tag, consumeTag } from '@glimmer/validator';

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
  constructor(public Class: TestModifierConstructor) {}
}

export class TestModifierManager
  implements ModifierManager<TestModifier, TestModifierDefinitionState> {
  create(
    element: SimpleElement,
    state: TestModifierDefinitionState,
    args: VMArguments,
    _dynamicScope: DynamicScope,
    dom: GlimmerTreeChanges
  ) {
    let { Class } = state;

    return new TestModifier(element, new Class(), args.capture(), dom);
  }

  getTag({ args: { tag } }: TestModifier): Tag {
    return tag;
  }

  install({ element, args, instance }: TestModifier) {
    consumeTag(args.tag);

    if (instance && instance.didInsertElement) {
      instance.element = element;
      instance.didInsertElement(args.positional.value(), args.named.value());
    }

    return;
  }

  update({ args, instance }: TestModifier) {
    consumeTag(args.tag);

    if (instance && instance.didUpdate) {
      instance.didUpdate(args.positional.value(), args.named.value());
    }

    return;
  }

  teardown(modifier: TestModifier): void {
    let { instance } = modifier;
    if (instance && instance.willDestroyElement) {
      instance.willDestroyElement();
    }
  }
}

export class TestModifier {
  constructor(
    public element: SimpleElement,
    public instance: TestModifierInstance,
    public args: CapturedArguments,
    public dom: GlimmerTreeChanges
  ) {}
}
