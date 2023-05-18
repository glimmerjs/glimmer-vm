import { associateDestroyableChild, registerDestructor } from '@glimmer/destroyable';
import type {
  Environment,
  LiveBlock,
  RenderResult,
  SimpleElement,
  SimpleNode,
  UpdatingOpcode,
} from '@glimmer/interfaces';

import { clear } from '../bounds';
import { UpdatingVM } from './update';

export default class RenderResultImpl implements RenderResult {
  readonly #drop: object;
  readonly #updating: readonly UpdatingOpcode[];
  readonly #bounds: LiveBlock;

  constructor(
    public env: Environment,
    updating: UpdatingOpcode[],
    bounds: LiveBlock,
    drop: object
  ) {
    this.#drop = drop;
    this.#updating = updating;
    this.#bounds = bounds;
    associateDestroyableChild(this, drop);
    registerDestructor(this, () => clear(this.#bounds));
  }

  _link_(parent: object) {
    associateDestroyableChild(parent, this.#drop);
  }

  rerender({ alwaysRevalidate = false } = { alwaysRevalidate: false }) {
    let { env } = this;
    let vm = new UpdatingVM(env, { alwaysRevalidate });
    vm.execute(this.#updating, this);
  }

  parentElement(): SimpleElement {
    return this.#bounds.parentElement();
  }

  firstNode(): SimpleNode {
    return this.#bounds.firstNode();
  }

  lastNode(): SimpleNode {
    return this.#bounds.lastNode();
  }

  handleException() {
    throw 'this should never happen';
  }
}
