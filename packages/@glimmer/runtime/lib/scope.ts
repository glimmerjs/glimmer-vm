import {
  DynamicScope,
  Dict,
  PartialScope,
  ScopeSlot,
  ScopeBlock,
  Option,
  Scope,
  Owner,
  Source,
} from '@glimmer/interfaces';
import { assign } from '@glimmer/util';
import { UNDEFINED_SOURCE } from '@glimmer/reference';

export class DynamicScopeImpl implements DynamicScope {
  private bucket: Dict<Source>;

  constructor(bucket?: Dict<Source>) {
    if (bucket) {
      this.bucket = assign({}, bucket);
    } else {
      this.bucket = {};
    }
  }

  get(key: string): Source {
    return this.bucket[key];
  }

  set(key: string, reference: Source): Source {
    return (this.bucket[key] = reference);
  }

  child(): DynamicScopeImpl {
    return new DynamicScopeImpl(this.bucket);
  }
}

export function isScopeSource(s: ScopeSlot): s is Source {
  if (s === null || Array.isArray(s)) return false;
  return true;
}

export class PartialScopeImpl implements PartialScope {
  static root(self: Source<unknown>, size = 0, owner: Owner): PartialScope {
    let refs: Source<unknown>[] = new Array(size + 1);

    for (let i = 0; i <= size; i++) {
      refs[i] = UNDEFINED_SOURCE;
    }

    return new PartialScopeImpl(refs, owner, null, null, null).init({ self });
  }

  static sized(size = 0, owner: Owner): Scope {
    let refs: Source<unknown>[] = new Array(size + 1);

    for (let i = 0; i <= size; i++) {
      refs[i] = UNDEFINED_SOURCE;
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
    private partialMap: Dict<Source<unknown>> | null
  ) {}

  init({ self }: { self: Source<unknown> }): this {
    this.slots[0] = self;
    return this;
  }

  getSelf(): Source<unknown> {
    return this.get<Source<unknown>>(0);
  }

  getSymbol(symbol: number): Source<unknown> {
    return this.get<Source<unknown>>(symbol);
  }

  getBlock(symbol: number): Option<ScopeBlock> {
    let block = this.get(symbol);
    return block === UNDEFINED_SOURCE ? null : (block as ScopeBlock);
  }

  getEvalScope(): Option<Dict<ScopeSlot>> {
    return this.evalScope;
  }

  getPartialMap(): Option<Dict<Source<unknown>>> {
    return this.partialMap;
  }

  bind(symbol: number, value: ScopeSlot) {
    this.set(symbol, value);
  }

  bindSelf(self: Source<unknown>) {
    this.set<Source<unknown>>(0, self);
  }

  bindSymbol(symbol: number, value: Source<unknown>) {
    this.set(symbol, value);
  }

  bindBlock(symbol: number, value: Option<ScopeBlock>) {
    this.set<Option<ScopeBlock>>(symbol, value);
  }

  bindEvalScope(map: Option<Dict<ScopeSlot>>) {
    this.evalScope = map;
  }

  bindPartialMap(map: Dict<Source<unknown>>) {
    this.partialMap = map;
  }

  bindCallerScope(scope: Option<Scope>): void {
    this.callerScope = scope;
  }

  getCallerScope(): Option<Scope> {
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
