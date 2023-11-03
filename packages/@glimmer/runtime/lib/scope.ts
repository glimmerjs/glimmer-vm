import type {
  Dict,
  DynamicScope,
  Nullable,
  Owner,
  PartialScope,
  Scope,
  ScopeBlock,
  ScopeSlot,
} from "@glimmer/interfaces";
import { type SomeReactive, UNDEFINED_REFERENCE } from '@glimmer/reference';
import { assign, unwrap } from '@glimmer/util';

export class DynamicScopeImpl implements DynamicScope {
  private bucket: Dict<SomeReactive>;

  constructor(bucket?: Dict<SomeReactive>) {
    if (bucket) {
      this.bucket = assign({}, bucket);
    } else {
      this.bucket = {};
    }
  }

  get(key: string): SomeReactive {
    return unwrap(this.bucket[key]);
  }

  set(key: string, reference: SomeReactive): SomeReactive {
    return (this.bucket[key] = reference);
  }

  child(): DynamicScopeImpl {
    return new DynamicScopeImpl(this.bucket);
  }
}

export function isScopeReference(s: ScopeSlot): s is SomeReactive {
  if (s === null || Array.isArray(s)) return false;
  return true;
}

export class PartialScopeImpl implements PartialScope {
  static root(self: SomeReactive<unknown>, size = 0, owner: Owner): PartialScope {
    let refs: SomeReactive<unknown>[] = new Array(size + 1);

    for (let i = 0; i <= size; i++) {
      refs[i] = UNDEFINED_REFERENCE;
    }

    return new PartialScopeImpl(refs, owner, null, null, null).init({ self });
  }

  static sized(size = 0, owner: Owner): Scope {
    let refs: SomeReactive<unknown>[] = new Array(size + 1);

    for (let i = 0; i <= size; i++) {
      refs[i] = UNDEFINED_REFERENCE;
    }

    return new PartialScopeImpl(refs, owner, null, null, null);
  }

  constructor(
    // the 0th slot is `self`
    readonly slots: Array<ScopeSlot>,
    readonly owner: Owner,
    private callerScope: Scope | null,
    // named arguments and blocks passed to a layout that uses eval
    private evalScope: Dict<ScopeSlot> | null,
    // locals in scope when the partial was invoked
    private partialMap: Dict<SomeReactive<unknown>> | null
  ) {}

  init({ self }: { self: SomeReactive<unknown> }): this {
    this.slots[0] = self;
    return this;
  }

  getSelf(): SomeReactive<unknown> {
    return this.get<SomeReactive<unknown>>(0);
  }

  getSymbol(symbol: number): SomeReactive<unknown> {
    return this.get<SomeReactive<unknown>>(symbol);
  }

  getBlock(symbol: number): Nullable<ScopeBlock> {
    let block = this.get(symbol);
    return block === UNDEFINED_REFERENCE ? null : (block as ScopeBlock);
  }

  getEvalScope(): Nullable<Dict<ScopeSlot>> {
    return this.evalScope;
  }

  getPartialMap(): Nullable<Dict<SomeReactive<unknown>>> {
    return this.partialMap;
  }

  bind(symbol: number, value: ScopeSlot) {
    this.set(symbol, value);
  }

  bindSelf(self: SomeReactive<unknown>) {
    this.set<SomeReactive<unknown>>(0, self);
  }

  bindSymbol(symbol: number, value: SomeReactive<unknown>) {
    this.set(symbol, value);
  }

  bindBlock(symbol: number, value: Nullable<ScopeBlock>) {
    this.set<Nullable<ScopeBlock>>(symbol, value);
  }

  bindEvalScope(map: Nullable<Dict<ScopeSlot>>) {
    this.evalScope = map;
  }

  bindPartialMap(map: Dict<SomeReactive<unknown>>) {
    this.partialMap = map;
  }

  bindCallerScope(scope: Nullable<Scope>): void {
    this.callerScope = scope;
  }

  getCallerScope(): Nullable<Scope> {
    return this.callerScope;
  }

  child(): Scope {
    return new PartialScopeImpl(
      this.slots.slice(),
      this.owner,
      this.callerScope,
      this.evalScope,
      this.partialMap
    );
  }

  private get<T extends ScopeSlot>(index: number): T {
    if (index >= this.slots.length) {
      throw new RangeError(`BUG: cannot get $${index} from scope; length=${this.slots.length}`);
    }

    return this.slots[index] as T;
  }

  private set<T extends ScopeSlot>(index: number, value: T): void {
    if (index >= this.slots.length) {
      throw new RangeError(`BUG: cannot get $${index} from scope; length=${this.slots.length}`);
    }

    this.slots[index] = value;
  }
}
