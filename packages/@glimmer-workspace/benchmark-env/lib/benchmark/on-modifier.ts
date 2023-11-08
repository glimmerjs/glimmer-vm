import type {
  CapturedArguments,
  DevMode,
  InternalModifierManager,
  Owner,
  SimpleElement,
  TagDescription,
} from '@glimmer/interfaces';
import { type SomeReactive, unwrapReactive } from '@glimmer/reference';
import { castToBrowser, devmode, getDescription, setDescription } from '@glimmer/util';
import { createUpdatableTag } from '@glimmer/validator';

interface OnModifierState {
  element: SimpleElement;
  nameRef: SomeReactive<string>;
  listenerRef: SomeReactive<EventListener>;
  name: string | null;
  listener: EventListener | null;
  description: DevMode<TagDescription>;
}

class OnModifierManager implements InternalModifierManager<OnModifierState, object> {
  create(_owner: Owner, element: SimpleElement, _: {}, args: CapturedArguments) {
    const state = {
      element,
      nameRef: args.positional[0] as SomeReactive<string>,
      listenerRef: args.positional[1] as SomeReactive<EventListener>,
      name: null,
      listener: null,
    };
    setDescription(
      state,
      devmode(
        () =>
          ({
            kind: 'modifier',
            label: ['on'],
            fallible: true,
          readonly: true,
          }) satisfies TagDescription
      )
    );
    return state;
  }

  getDebugName() {
    return 'on-modifier';
  }

  install(state: OnModifierState) {
    const name = unwrapReactive(state.nameRef);
    const listener = unwrapReactive(state.listenerRef);
    castToBrowser(state.element, 'ELEMENT').addEventListener(name, listener);
    state.listener = listener;
    state.name = name;
  }

  update(state: OnModifierState) {
    const element = castToBrowser(state.element, 'ELEMENT');
    const name = unwrapReactive(state.nameRef);
    const listener = unwrapReactive(state.listenerRef);
    if (name !== state.name || listener !== state.listener) {
      element.removeEventListener(state.name!, state.listener!);
      element.addEventListener(name, listener);
      state.name = name;
      state.listener = listener;
    }
  }

  getDestroyable(state: OnModifierState) {
    return state;
  }

  getTag(state: OnModifierState) {
    return createUpdatableTag(getDescription(state));
  }
}

const onModifier: InternalModifierManager<unknown, object> = new OnModifierManager();

export default onModifier;
