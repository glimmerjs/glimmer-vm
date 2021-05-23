import { CapturedArguments, InternalModifierManager, Owner, Source } from '@glimmer/interfaces';
import { getValue } from '@glimmer/validator';
import { castToBrowser } from '@glimmer/util';
import { SimpleElement } from '@simple-dom/interface';

interface OnModifierState {
  element: SimpleElement;
  nameRef: Source<string>;
  listenerRef: Source<EventListener>;
  name: string | null;
  listener: EventListener | null;
}

class OnModifierManager implements InternalModifierManager<OnModifierState, object> {
  create(_owner: Owner, element: SimpleElement, _: {}, args: CapturedArguments) {
    return {
      element,
      nameRef: args.positional[0] as Source<string>,
      listenerRef: args.positional[1] as Source<EventListener>,
      name: null,
      listener: null,
    };
  }

  getDebugName() {
    return 'on-modifier';
  }

  install(state: OnModifierState) {
    const name = getValue(state.nameRef);
    const listener = getValue(state.listenerRef);
    castToBrowser(state.element, 'ELEMENT').addEventListener(name, listener);
    state.listener = listener;
    state.name = name;
  }

  update(state: OnModifierState) {
    const element = castToBrowser(state.element, 'ELEMENT');
    const name = getValue(state.nameRef);
    const listener = getValue(state.listenerRef);
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
}

const onModifier: InternalModifierManager<unknown, object> = new OnModifierManager();

export default onModifier;
