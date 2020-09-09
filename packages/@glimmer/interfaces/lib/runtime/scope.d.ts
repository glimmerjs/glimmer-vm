import { CompilableBlock } from '../template';
// eslint-disable-next-line node/no-extraneous-import
import { Reference } from '@glimmer/reference';
import { Optional, Dict } from '../core';
import { BlockSymbolTable } from '../tier1/symbol-table';

export type Block = CompilableBlock | number;

export type ScopeBlock = [CompilableBlock, Scope, BlockSymbolTable];
export type BlockValue = ScopeBlock[0 | 1 | 2];
export type ScopeSlot = Reference | ScopeBlock | null;

export interface Scope {
  // for debug only
  readonly slots: Array<ScopeSlot>;

  getSelf(): Reference;
  getSymbol(symbol: number): Reference;
  getBlock(symbol: number): Optional<ScopeBlock>;
  getEvalScope(): Optional<Dict<ScopeSlot>>;
  getPartialMap(): Optional<Dict<Reference>>;
  bind(symbol: number, value: ScopeSlot): void;
  bindSelf(self: Reference): void;
  bindSymbol(symbol: number, value: Reference): void;
  bindBlock(symbol: number, value: Optional<ScopeBlock>): void;
  bindEvalScope(map: Optional<Dict<ScopeSlot>>): void;
  bindPartialMap(map: Dict<Reference>): void;
  child(): Scope;
}

export interface PartialScope extends Scope {
  bindEvalScope(scope: Optional<Dict<ScopeSlot>>): void;
}

export interface DynamicScope {
  get(key: string): Reference<unknown>;
  set(key: string, reference: Reference<unknown>): Reference<unknown>;
  child(): DynamicScope;
}
