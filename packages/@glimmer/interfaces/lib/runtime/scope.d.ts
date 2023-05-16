import type { Nullable } from '../core';
import type { Reference } from '../references';
import type { CompilableBlock } from '../template';
import type { BlockSymbolTable } from '../tier1/symbol-table';
import type { Owner } from './owner';

export type Block = CompilableBlock | number;

export type ScopeBlock = [CompilableBlock, Scope, BlockSymbolTable];
export type BlockValue = ScopeBlock[0 | 1 | 2];
export type ScopeSlot = Reference | ScopeBlock | null;

export interface Scope {
  // for debug only
  readonly slots: Array<ScopeSlot>;
  readonly owner: Owner;

  getSelf(): Reference;
  getSymbol(symbol: number): Reference;
  getBlock(symbol: number): Nullable<ScopeBlock>;
  bind(symbol: number, value: ScopeSlot): void;
  bindSelf(self: Reference): void;
  bindSymbol(symbol: number, value: Reference): void;
  bindBlock(symbol: number, value: Nullable<ScopeBlock>): void;
  child(): Scope;
}

export interface DynamicScope {
  get(key: string): Reference<unknown>;
  set(key: string, reference: Reference<unknown>): Reference<unknown>;
  child(): DynamicScope;
}
