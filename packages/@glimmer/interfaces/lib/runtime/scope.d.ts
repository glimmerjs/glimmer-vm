import { CompilableBlock } from '../template';
import { Source } from '../tracking';
import { Option, Dict } from '../core';
import { BlockSymbolTable } from '../tier1/symbol-table';
import { Owner } from './owner';

export type Block = CompilableBlock | number;

export type ScopeBlock = [CompilableBlock, Scope, BlockSymbolTable];
export type BlockValue = ScopeBlock[0 | 1 | 2];
export type ScopeSlot = Source | ScopeBlock | null;

export interface Scope {
  // for debug only
  readonly slots: Array<ScopeSlot>;
  readonly owner: Owner;

  getSelf(): Source;
  getSymbol(symbol: number): Source;
  getBlock(symbol: number): Option<ScopeBlock>;
  getEvalScope(): Option<Dict<ScopeSlot>>;
  getPartialMap(): Option<Dict<Source>>;
  bind(symbol: number, value: ScopeSlot): void;
  bindSelf(self: Source): void;
  bindSymbol(symbol: number, value: Source): void;
  bindBlock(symbol: number, value: Option<ScopeBlock>): void;
  bindEvalScope(map: Option<Dict<ScopeSlot>>): void;
  bindPartialMap(map: Dict<Source>): void;
  child(): Scope;
}

export interface PartialScope extends Scope {
  bindEvalScope(scope: Option<Dict<ScopeSlot>>): void;
}

export interface DynamicScope {
  get(key: string): Source<unknown>;
  set(key: string, reference: Source<unknown>): Source<unknown>;
  child(): DynamicScope;
}
