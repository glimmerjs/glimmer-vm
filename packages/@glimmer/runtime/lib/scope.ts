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
import type {Reactive} from '@glimmer/reference';
import {  UNDEFINED_REFERENCE } from '@glimmer/reference';
import { assign, unwrap } from '@glimmer/util';

export class DynamicScopeImpl implements DynamicScope {
  private bucket: Dict<Reactive>;

  constructor(bucket?: Dict<Reactive>) {
    if (bucket) {
      this.bucket = assign({}, bucket);
    } else {
      this.bucket = {};
    }
  }

  get(key: string): Reactive {
    return unwrap(this.bucket[key]);
  }

  set(key: string, reference: Reactive): Reactive {
    return (this.bucket[key] = reference);
  }

  child(): DynamicScopeImpl {
    return new DynamicScopeImpl(this.bucket);
  }
}

export function isScopeReference(s: ScopeSlot): s is Reactive {
  if (s === null || Array.isArray(s)) return false;
  return true;
}

export class PartialScopeImpl implements PartialScope {
  static root(self: Reactive<unknown>, size = 0, owner: Owner): PartialScope {
    let refs: Reactive<unknown>[] = new Array(size + 1);

    for (let i = 0; i <= size; i++) {
      refs[i] = UNDEFINED_REFERENCE;
    }

    return new PartialScopeImpl(refs, owner, null, null, null).init({ self });
  }

  static sized(size = 0, owner: Owner): Scope {
    let refs: Reactive<unknown>[] = new Array(size + 1);

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
    private partialMap: Dict<Reactive<unknown>> | null
  ) {}

  init({ self }: { self: Reactive<unknown> }): this {
    this.slots[0] = self;
    return this;
  }

  getSelf(): Reactive<unknown> {
    return this.get<Reactive<unknown>>(0);
  }

  getSymbol(symbol: number): Reactive<unknown> {
    return this.get<Reactive<unknown>>(symbol);
  }

  getBlock(symbol: number): Nullable<ScopeBlock> {
    let block = this.get(symbol);
    return block === UNDEFINED_REFERENCE ? null : (block as ScopeBlock);
  }

  getEvalScope(): Nullable<Dict<ScopeSlot>> {
    return this.evalScope;
  }

  getPartialMap(): Nullable<Dict<Reactive<unknown>>> {
    return this.partialMap;
  }

  bind(symbol: number, value: ScopeSlot) {
    this.set(symbol, value);
  }

  bindSelf(self: Reactive<unknown>) {
    this.set<Reactive<unknown>>(0, self);
  }

  bindSymbol(symbol: number, value: Reactive<unknown>) {
    this.set(symbol, value);
  }

  bindBlock(symbol: number, value: Nullable<ScopeBlock>) {
    this.set<Nullable<ScopeBlock>>(symbol, value);
  }

  bindEvalScope(map: Nullable<Dict<ScopeSlot>>) {
    this.evalScope = map;
  }

  bindPartialMap(map: Dict<Reactive<unknown>>) {
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
