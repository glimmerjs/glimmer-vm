import { associateDestroyableChild, registerDestructor } from '@glimmer/destroyable';
import type {
  BlockBounds,
  Environment,
  Nullable,
  RenderResult,
  SimpleElement,
  SimpleNode,
  UpdatingOpcode,
} from '@glimmer/interfaces';

import { clear } from '../bounds';
import { type BlockOpcode, UpdatingVM } from './update';

export default class RenderResultImpl implements BlockOpcode, RenderResult {
  constructor(
    public env: Environment,
    private updating: UpdatingOpcode[],
    private bounds: BlockBounds,
    readonly drop: object
  ) {
    associateDestroyableChild(this, drop);
    registerDestructor(this, () => clear(this.bounds));
  }

  get children() {
    return this.updating;
  }

  evaluate(vm: UpdatingVM): void {
    vm.execute(this.updating, this);
  }

  rerender({ alwaysRevalidate = false } = { alwaysRevalidate: false }) {
    let { env, updating } = this;
    let vm = new UpdatingVM(env, { alwaysRevalidate });
    vm.execute(updating, this);
  }

  parentElement(): SimpleElement {
    return this.bounds.parentElement();
  }

  get first(): Nullable<SimpleNode> {
    return this.bounds.first;
  }

  firstNode(): SimpleNode {
    return this.bounds.firstNode();
  }

  get last(): Nullable<SimpleNode> {
    return this.bounds.last;
  }

  lastNode(): SimpleNode {
    return this.bounds.lastNode();
  }

  handleException(): void {
    // @fixme
  }

  unwind() {
    return false;
  }
}
