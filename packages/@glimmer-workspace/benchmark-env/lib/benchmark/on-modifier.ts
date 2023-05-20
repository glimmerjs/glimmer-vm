import type {
  CapturedArguments,
  InternalModifierManager,
  Owner,
  SimpleElement,
} from '@glimmer/interfaces';
import { type Reference, valueForRef } from '@glimmer/reference';
import { castToBrowser } from '@glimmer/util';
import { createUpdatableTag } from '@glimmer/validator';

interface OnModifierState {
  element: SimpleElement;
  nameRef: Reference<string>;
  listenerRef: Reference<EventListener>;
  name: string | null;
  listener: EventListener | null;
}

class OnModifierManager implements InternalModifierManager<OnModifierState, object> {
  create(_owner: Owner, element: SimpleElement, _: {}, captured: CapturedArguments) {
    return {
      element,
      nameRef: captured.positional[0] as Reference<string>,
      listenerRef: captured.positional[1] as Reference<EventListener>,
      name: null,
      listener: null,
    };
  }

  getDebugName() {
    return 'on-modifier';
  }

  install(state: OnModifierState) {
    let name = valueForRef(state.nameRef);
    let listener = valueForRef(state.listenerRef);
    castToBrowser(state.element, 'ELEMENT').addEventListener(name, listener);
    state.listener = listener;
    state.name = name;
  }

  update(state: OnModifierState) {
    let element = castToBrowser(state.element, 'ELEMENT');
    let name = valueForRef(state.nameRef);
    let listener = valueForRef(state.listenerRef);
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

  getTag() {
    return createUpdatableTag();
  }
}

const onModifier: InternalModifierManager<unknown, object> = new OnModifierManager();

export default onModifier;
