import { VersionedPathReference as PathReference } from '@glimmer/reference';
import { Option, Dict, CompilableBlock, BlockSymbolTable } from '@glimmer/interfaces';
import { UNDEFINED_REFERENCE } from './references';

export type ScopeBlock = [number | CompilableBlock, Scope, BlockSymbolTable];
export type BlockValue = ScopeBlock[0 | 1 | 2];
export type ScopeSlot = Option<PathReference<unknown>> | Option<ScopeBlock>;

export interface Scope {
  getSelf(): PathReference<unknown>;
  getSymbol(symbol: number): PathReference<unknown>;
  getBlock(symbol: number): Option<ScopeBlock>;
  getEvalScope(): Option<Dict<ScopeSlot>>;
  getPartialMap(): Option<Dict<PathReference<unknown>>>;
  child(): Scope & MutScope;
}

export interface MutScope {
  bind(symbol: number, value: ScopeSlot): void;
  bindSelf(self: PathReference<unknown>): void;
  bindSymbol(symbol: number, value: PathReference<unknown>): void;
  bindBlock(symbol: number, value: Option<ScopeBlock>): void;
  bindEvalScope(map: Option<Dict<ScopeSlot>>): void;
  bindPartialMap(map: Dict<PathReference<unknown>>): void;
}

export type OwnedScope = Scope & MutScope;

export class ScopeImpl implements Scope, MutScope {
  static root(self: PathReference<unknown>, size = 0): ScopeImpl {
    let refs: PathReference<unknown>[] = new Array(size + 1);

    for (let i = 0; i <= size; i++) {
      refs[i] = UNDEFINED_REFERENCE;
    }

    return new ScopeImpl(refs, null, null, null).init({ self });
  }

  static sized(size = 0): ScopeImpl {
    let refs: PathReference<unknown>[] = new Array(size + 1);

    for (let i = 0; i <= size; i++) {
      refs[i] = UNDEFINED_REFERENCE;
    }

    return new ScopeImpl(refs, null, null, null);
  }

  constructor(
    // the 0th slot is `self`
    private slots: ScopeSlot[],
    private callerScope: Option<Scope>,
    // named arguments and blocks passed to a layout that uses eval
    private evalScope: Option<Dict<ScopeSlot>>,
    // locals in scope when the partial was invoked
    private partialMap: Option<Dict<PathReference<unknown>>>
  ) {}

  init({ self }: { self: PathReference<unknown> }): this {
    this.slots[0] = self;
    return this;
  }

  getSelf(): PathReference<unknown> {
    return this.get<PathReference<unknown>>(0);
  }

  getSymbol(symbol: number): PathReference<unknown> {
    return this.get<PathReference<unknown>>(symbol);
  }

  getBlock(symbol: number): Option<ScopeBlock> {
    let block = this.get(symbol);
    return block === UNDEFINED_REFERENCE ? null : (block as ScopeBlock);
  }

  getEvalScope(): Option<Dict<ScopeSlot>> {
    return this.evalScope;
  }

  getPartialMap(): Option<Dict<PathReference<unknown>>> {
    return this.partialMap;
  }

  bind(symbol: number, value: ScopeSlot) {
    this.set(symbol, value);
  }

  bindSelf(self: PathReference<unknown>) {
    this.set<PathReference<unknown>>(0, self);
  }

  bindSymbol(symbol: number, value: PathReference<unknown>) {
    this.set(symbol, value);
  }

  bindBlock(symbol: number, value: Option<ScopeBlock>) {
    this.set<Option<ScopeBlock>>(symbol, value);
  }

  bindEvalScope(map: Option<Dict<ScopeSlot>>) {
    this.evalScope = map;
  }

  bindPartialMap(map: Dict<PathReference<unknown>>) {
    this.partialMap = map;
  }

  child(): Scope & MutScope {
    return new ScopeImpl(this.slots.slice(), this.callerScope, this.evalScope, this.partialMap);
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
