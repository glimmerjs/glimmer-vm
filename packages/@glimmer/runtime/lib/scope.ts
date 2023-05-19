import type {
  Dict,
  DynamicScope,
  Nullable,
  Owner,
  Scope,
  ScopeBlock,
  ScopeSlot,
} from '@glimmer/interfaces';
import { type Reference, UNDEFINED_REFERENCE } from '@glimmer/reference';
import { unwrap } from '@glimmer/util';

export class DynamicScopeImpl implements DynamicScope {
  readonly #bucket: Dict<Reference>;

  constructor(bucket?: Dict<Reference>) {
    this.#bucket = bucket ? Object.assign({}, bucket) : {};
  }

  get(key: string): Reference {
    return unwrap(this.#bucket[key]);
  }

  set(key: string, reference: Reference): Reference {
    return (this.#bucket[key] = reference);
  }

  child(): DynamicScopeImpl {
    return new DynamicScopeImpl(this.#bucket);
  }
}

export function isScopeReference(s: ScopeSlot): s is Reference {
  if (s === null || Array.isArray(s)) return false;
  return true;
}

export class ScopeImpl implements Scope {
  static root(self: Reference<unknown>, size = 0, owner: Owner): Scope {
    let references: Reference<unknown>[] = new Array(size + 1);

    for (let index = 0; index <= size; index++) {
      references[index] = UNDEFINED_REFERENCE;
    }

    return new ScopeImpl(references, owner).init({ self });
  }

  static sized(size = 0, owner: Owner): Scope {
    let references: Reference<unknown>[] = new Array(size + 1);

    for (let index = 0; index <= size; index++) {
      references[index] = UNDEFINED_REFERENCE;
    }

    return new ScopeImpl(references, owner);
  }

  private constructor(
    // the 0th slot is `self`
    readonly slots: Array<ScopeSlot>,
    readonly owner: Owner
  ) {}

  init({ self }: { self: Reference<unknown> }): this {
    this.slots[0] = self;
    return this;
  }

  getSelf(): Reference<unknown> {
    return this.#get<Reference<unknown>>(0);
  }

  getSymbol(symbol: number): Reference<unknown> {
    return this.#get<Reference<unknown>>(symbol);
  }

  getBlock(symbol: number): Nullable<ScopeBlock> {
    let block = this.#get(symbol);
    return block === UNDEFINED_REFERENCE ? null : (block as ScopeBlock);
  }

  bind(symbol: number, value: ScopeSlot) {
    this.#set(symbol, value);
  }

  bindSelf(self: Reference<unknown>) {
    this.#set<Reference<unknown>>(0, self);
  }

  bindSymbol(symbol: number, value: Reference<unknown>) {
    this.#set(symbol, value);
  }

  bindBlock(symbol: number, value: Nullable<ScopeBlock>) {
    this.#set<Nullable<ScopeBlock>>(symbol, value);
  }

  child(): Scope {
    return new ScopeImpl([...this.slots], this.owner);
  }

  #get<T extends ScopeSlot>(index: number): T {
    if (index >= this.slots.length) {
      throw new RangeError(`BUG: cannot get $${index} from scope; length=${this.slots.length}`);
    }

    return this.slots[index] as T;
  }

  #set<T extends ScopeSlot>(index: number, value: T): void {
    if (index >= this.slots.length) {
      throw new RangeError(`BUG: cannot get $${index} from scope; length=${this.slots.length}`);
    }

    this.slots[index] = value;
  }
}
