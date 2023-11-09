import type { Dict, Nullable } from '../core';
import type { Reactive } from '../references';
import type { CompilableBlock } from '../template';
import type { BlockSymbolTable } from '../tier1/symbol-table';
import type { Owner } from './owner';

export type Block = CompilableBlock | number;

export type ScopeBlock = [CompilableBlock, Scope, BlockSymbolTable];
export type BlockValue = ScopeBlock[0 | 1 | 2];
export type ScopeSlot = Reactive | ScopeBlock | null;

export interface Scope {
  // for debug only
  readonly slots: Array<ScopeSlot>;
  readonly owner: Owner;

  getSelf(): Reactive;
  getSymbol(symbol: number): Reactive;
  getBlock(symbol: number): Nullable<ScopeBlock>;
  getEvalScope(): Nullable<Dict<ScopeSlot>>;
  getPartialMap(): Nullable<Dict<Reactive>>;
  bind(symbol: number, value: ScopeSlot): void;
  bindSelf(self: Reactive): void;
  bindSymbol(symbol: number, value: Reactive): void;
  bindBlock(symbol: number, value: Nullable<ScopeBlock>): void;
  bindEvalScope(map: Nullable<Dict<ScopeSlot>>): void;
  bindPartialMap(map: Dict<Reactive>): void;
  child(): Scope;
}

export interface PartialScope extends Scope {
  bindEvalScope(scope: Nullable<Dict<ScopeSlot>>): void;
}

export interface DynamicScope {
  get(key: string): Reactive<unknown>;
  set(key: string, reference: Reactive<unknown>): Reactive<unknown>;
  child(): DynamicScope;
}
