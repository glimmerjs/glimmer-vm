import type {
  Bounds,
  CapturedRenderNode,
  DebugRenderTree,
  Nullable,
  RenderNode,
} from '@glimmer/interfaces';
import { expect, Stack } from '@glimmer/util';

import { reifyArgs } from './vm/arguments';

interface InternalRenderNode<T extends object> extends RenderNode {
  bounds: Nullable<Bounds>;
  refs: Set<Ref<T>>;
  parent?: InternalRenderNode<T>;
}

let GUID = 0;

export class Ref<T extends object> {
  readonly id: number = GUID++;
  #value: Nullable<T>;

  constructor(value: T) {
    this.#value = value;
  }

  get(): Nullable<T> {
    return this.#value;
  }

  release(): void {
    if (import.meta.env.DEV && this.#value === null) {
      throw new Error('BUG: double release?');
    }

    this.#value = null;
  }

  toString(): string {
    if (import.meta.env.DEV) {
      let label = `Ref ${this.id}`;

      if (this.#value === null) {
        return `${label} (released)`;
      } else {
        try {
          return `${label}: ${this.#value}`;
        } catch {
          return label;
        }
      }
    }

    return `Ref ${this.id}`;
  }
}

export default class DebugRenderTreeImpl<TBucket extends object>
  implements DebugRenderTree<TBucket>
{
  readonly #stack = new Stack<TBucket>();

  readonly #refs = new WeakMap<TBucket, Ref<TBucket>>();
  readonly #roots = new Set<Ref<TBucket>>();
  readonly #nodes = new WeakMap<TBucket, InternalRenderNode<TBucket>>();

  begin(): void {
    this.#reset();
  }

  create(state: TBucket, node: RenderNode): void {
    let internalNode: InternalRenderNode<TBucket> = { ...node, bounds: null,
      refs: new Set<Ref<TBucket>>(),};
    this.#nodes.set(state, internalNode);
    this.#appendChild(internalNode, state);
    this.#enter(state);
  }

  update(state: TBucket): void {
    this.#enter(state);
  }

  didRender(state: TBucket, bounds: Bounds): void {
    if (import.meta.env.DEV && this.#stack.current !== state) {
      throw new Error(`BUG: expecting ${this.#stack.current}, got ${state}`);
    }

    this.#nodeFor(state).bounds = bounds;
    this.#exit();
  }

  willDestroy(state: TBucket): void {
    expect(this.#refs.get(state), 'BUG: missing ref').release();
  }

  commit(): void {
    this.#reset();
  }

  capture(): CapturedRenderNode[] {
    return this.#captureRefs(this.#roots);
  }

  #reset(): void {
    if (this.#stack.size > 0) {
      // We probably encountered an error during the rendering loop. This will
      // likely trigger undefined behavior and memory leaks as the error left
      // things in an inconsistent state. It is recommended that the user
      // refresh the page.

      // TODO: We could warn here? But this happens all the time in our tests?

      // Clean up the root reference to prevent errors from happening if we
      // attempt to capture the render tree (Ember Inspector may do this)
      let root = expect(this.#stack.toArray()[0], 'expected root state when resetting render tree');
      let reference = this.#refs.get(root);

      if (reference !== undefined) {
        this.#roots.delete(reference);
      }

      while (!this.#stack.isEmpty()) {
        this.#stack.pop();
      }
    }
  }

  #enter(state: TBucket): void {
    this.#stack.push(state);
  }

  #exit(): void {
    if (import.meta.env.DEV && this.#stack.size === 0) {
      throw new Error('BUG: unbalanced pop');
    }

    this.#stack.pop();
  }

  #nodeFor(state: TBucket): InternalRenderNode<TBucket> {
    return expect(this.#nodes.get(state), 'BUG: missing node');
  }

  #appendChild(node: InternalRenderNode<TBucket>, state: TBucket): void {
    if (import.meta.env.DEV && this.#refs.has(state)) {
      throw new Error('BUG: child already appended');
    }

    let parent = this.#stack.current;
    let reference = new Ref(state);

    this.#refs.set(state, reference);

    if (parent) {
      let parentNode = this.#nodeFor(parent);
      parentNode.refs.add(reference);
      node.parent = parentNode;
    } else {
      this.#roots.add(reference);
    }
  }

  #captureRefs(references: Set<Ref<TBucket>>): CapturedRenderNode[] {
    let captured: CapturedRenderNode[] = [];

    for (let reference of references) {
      let state = reference.get();

      if (state) {
        captured.push(this.#captureNode(`render-node:${reference.id}`, state));
      } else {
        references.delete(reference);
      }
    }

    return captured;
  }

  #captureNode(id: string, state: TBucket): CapturedRenderNode {
    let node = this.#nodeFor(state);
    let { type, name, args, instance, refs } = node;
    let template = this.#captureTemplate(node);
    let bounds = this.#captureBounds(node);
    let children = this.#captureRefs(refs);
    return { id, type, name, args: reifyArgs(args), instance, template, bounds, children };
  }

  #captureTemplate({ template }: InternalRenderNode<TBucket>): Nullable<string> {
    return template || null;
  }

  #captureBounds(node: InternalRenderNode<TBucket>): CapturedRenderNode['bounds'] {
    let bounds = expect(node.bounds, 'BUG: missing bounds');
    let parentElement = bounds.parentElement();
    let firstNode = bounds.firstNode();
    let lastNode = bounds.lastNode();
    return { parentElement, firstNode, lastNode };
  }
}
