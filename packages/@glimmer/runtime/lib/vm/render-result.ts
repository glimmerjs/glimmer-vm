import { associateDestroyableChild, registerDestructor } from '@glimmer/destroyable';
import type {
  BlockBoundsRef,
  Environment,
  RenderResult,
  RuntimeBlockBounds,
  UpdatingOpcode,
} from '@glimmer/interfaces';

import { UpdatingVM, getBlockBoundsEnd, getBlockBoundsStart } from './update';
import { clearBlockBounds } from '../dom/tree-builder';
import { unwrap } from '@glimmer/util';

export default class RenderResultImpl implements RenderResult {
  readonly #drop: object;
  readonly #updating: readonly UpdatingOpcode[];
  readonly #bounds: BlockBoundsRef;

  constructor(
    public environment: Environment,
    updating: UpdatingOpcode[],
    bounds: BlockBoundsRef,
    drop: object
  ) {
    this.#drop = drop;
    this.#updating = updating;
    this.#bounds = bounds;
    associateDestroyableChild(this, drop);
    registerDestructor(
      this,
      () => this.#bounds.current && clearBlockBounds(this.#bounds.current as RuntimeBlockBounds)
    );
  }

  _link_(parent: object) {
    associateDestroyableChild(parent, this.#drop);
  }

  rerender(options?: { alwaysRevalidate?: boolean }) {
    let { environment } = this;
    let vm = new UpdatingVM(environment, options);
    vm.execute(this.#updating, this);
  }

  get _blockBounds_(): BlockBoundsRef {
    return this.#bounds;
  }

  parentElement(): Element {
    return unwrap(this.#bounds.current?.parent) as Element;
  }

  firstNode(): ChildNode {
    return getBlockBoundsStart(this.#bounds) as ChildNode;
  }

  lastNode(): ChildNode {
    return getBlockBoundsEnd(this.#bounds) as ChildNode;
  }

  handleException() {
    throw 'this should never happen';
  }
}
