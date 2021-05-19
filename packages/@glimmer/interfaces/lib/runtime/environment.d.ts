import { SimpleDocument } from '@simple-dom/interface';
import { GlimmerTreeChanges, GlimmerTreeConstruction } from '../dom/changes';
import { DebugRenderTree } from './debug-render-tree';
import { EffectPhase } from '../..';

// eslint-disable-next-line node/no-extraneous-import
import { Cache } from '@glimmer/validator';

export interface EnvironmentOptions {
  document?: SimpleDocument;
  appendOperations?: GlimmerTreeConstruction;
  updateOperations?: GlimmerTreeChanges;
}

declare const TransactionSymbol: unique symbol;
export type TransactionSymbol = typeof TransactionSymbol;

export interface Environment {
  [TransactionSymbol]: boolean;

  registerEffect(phase: EffectPhase, cache: Cache): void;

  begin(): void;
  commit(): void;

  getDOM(): GlimmerTreeChanges;
  getAppendOperations(): GlimmerTreeConstruction;

  isInteractive: boolean;
  debugRenderTree?: DebugRenderTree;
}
