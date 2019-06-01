import { Environment, RenderResult, LiveBlock } from '@glimmer/interfaces';
import { associate, DESTROY, LinkedList } from '@glimmer/util';
import { SimpleElement, SimpleNode } from '@simple-dom/interface';
import { clear } from '../bounds';
import { inTransaction } from '../environment';
import { asyncDestroy } from '../lifetime';
import { UpdatingOpcode } from '../opcodes';
import UpdatingVM from './sync-update';
import AsyncUpdatingVM from './async-update';

export default class RenderResultImpl implements RenderResult {
  constructor(
    public env: Environment,
    private updating: LinkedList<UpdatingOpcode>,
    private bounds: LiveBlock,
    readonly drop: object
  ) {
    associate(this, drop);
  }

  rerender(
    { alwaysRevalidate = false, async = false } = { alwaysRevalidate: false, async: false }
  ) {
    let { env, updating } = this;
    let vm = async
      ? new AsyncUpdatingVM(env, { alwaysRevalidate })
      : new UpdatingVM(env, { alwaysRevalidate });
    return vm.execute(updating, this);
  }

  parentElement(): SimpleElement {
    return this.bounds.parentElement();
  }

  firstNode(): SimpleNode {
    return this.bounds.firstNode();
  }

  lastNode(): SimpleNode {
    return this.bounds.lastNode();
  }

  handleException() {
    throw 'this should never happen';
  }

  [DESTROY]() {
    clear(this.bounds);
  }

  // compat, as this is a user-exposed API
  destroy() {
    inTransaction(this.env, () => asyncDestroy(this, this.env));
  }
}
