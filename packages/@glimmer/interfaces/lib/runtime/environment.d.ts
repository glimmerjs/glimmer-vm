import type { SimpleDocument } from '@simple-dom/interface';

import type {
  ComponentDefinitionState,
  ComponentInstance,
  ComponentInstanceState,
} from '../components';
import type { Destroyable, Nullable } from '../core';
import type { GlimmerTreeChanges } from '../dom/changes';
import type { DebugRenderTree } from './debug-render-tree';
import type { WithCreateInstance } from '../managers';
import type { DOMTreeBuilder, MinimalCursor } from '../dom/tree-builder';

export interface EnvironmentOptions {
  document?: SimpleDocument;
  appendOperations?: (cursor: MinimalCursor) => DOMTreeBuilder;
  updateOperations?: GlimmerTreeChanges;
}

export type Transaction = object;

declare const TransactionSymbol: unique symbol;
export type TransactionSymbol = typeof TransactionSymbol;

export type ComponentInstanceWithCreate = ComponentInstance<
  ComponentDefinitionState,
  ComponentInstanceState,
  WithCreateInstance
>;

export type AppendOperations = (cursor: MinimalCursor) => DOMTreeBuilder;

interface InstallableModifier {
  readonly element: Element;
  render(): void;
  update(env: Environment): void;
  destroy(): void;
}

export interface Environment {
  [TransactionSymbol]: Nullable<Transaction>;

  didCreate(component: ComponentInstanceWithCreate): void;
  didUpdate(component: ComponentInstanceWithCreate): void;
  didAppend(element: Element): void;

  scheduleInstallModifier(modifier: InstallableModifier, parent: Destroyable): void;
  scheduleUpdateModifier(modifier: InstallableModifier): void;

  begin(): void;
  commit(): void;

  getDOM(): GlimmerTreeChanges;
  getAppendOperations: AppendOperations;

  isInteractive: boolean;
  debugRenderTree?: DebugRenderTree | undefined;
}
