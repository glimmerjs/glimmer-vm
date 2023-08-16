import type {
  Environment,
  Nullable,
  RenderResult,
  SimpleElement,
  SimpleNode,
  UpdatingOpcode,
} from '@glimmer/interfaces';
import { associateDestroyableChild, registerDestructor } from '@glimmer/destroyable';

import type { BlockOpcode, TryOpcode } from './update';

import { clear } from '../bounds';
import { UpdatingVM } from './update';

export default class RenderResultImpl implements BlockOpcode, RenderResult {
  private updating: UpdatingOpcode[];
  readonly drop: object;

  constructor(
    public env: Environment,
    private block: TryOpcode
  ) {
    associateDestroyableChild(this, block);
    registerDestructor(this, () => clear(block));
    this.updating = [block];
    this.drop = block;
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
    return this.block.parentElement();
  }

  get first(): Nullable<SimpleNode> {
    return this.block.first;
  }

  firstNode(): SimpleNode {
    return this.block.firstNode();
  }

  get last(): Nullable<SimpleNode> {
    return this.block.last;
  }

  lastNode(): SimpleNode {
    return this.block.lastNode();
  }

  handleException(): void {
    // @fixme
  }

  unwind() {
    return false;
  }
}
