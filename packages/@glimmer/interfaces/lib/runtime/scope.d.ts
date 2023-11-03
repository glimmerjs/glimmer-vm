import type { Dict, Nullable } from '../core';
import type { SomeReactive } from '../references';
import type { CompilableBlock } from '../template';
import type { BlockSymbolTable } from '../tier1/symbol-table';
import type { Owner } from './owner';

export type Block = CompilableBlock | number;

export type ScopeBlock = [CompilableBlock, Scope, BlockSymbolTable];
export type BlockValue = ScopeBlock[0 | 1 | 2];
export type ScopeSlot = SomeReactive | ScopeBlock | null;

export interface Scope {
  // for debug only
  readonly slots: Array<ScopeSlot>;
  readonly owner: Owner;

  getSelf(): SomeReactive;
  getSymbol(symbol: number): SomeReactive;
  getBlock(symbol: number): Nullable<ScopeBlock>;
  getEvalScope(): Nullable<Dict<ScopeSlot>>;
  getPartialMap(): Nullable<Dict<SomeReactive>>;
  bind(symbol: number, value: ScopeSlot): void;
  bindSelf(self: SomeReactive): void;
  bindSymbol(symbol: number, value: SomeReactive): void;
  bindBlock(symbol: number, value: Nullable<ScopeBlock>): void;
  bindEvalScope(map: Nullable<Dict<ScopeSlot>>): void;
  bindPartialMap(map: Dict<SomeReactive>): void;
  child(): Scope;
}

export interface PartialScope extends Scope {
  bindEvalScope(scope: Nullable<Dict<ScopeSlot>>): void;
}

export interface DynamicScope {
  get(key: string): SomeReactive<unknown>;
  set(key: string, reference: SomeReactive<unknown>): SomeReactive<unknown>;
  child(): DynamicScope;
}
