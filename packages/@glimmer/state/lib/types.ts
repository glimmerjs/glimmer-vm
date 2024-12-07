import type { Tag } from '@glimmer/interfaces';

export interface TransactionEnv {
  debugMessage?: (obj?: unknown, keyName?: string) => string;
}

export interface DebugTransaction {
  beginTrackingTransaction: (debuggingContext?: string | false, deprecate?: boolean) => void;
  endTrackingTransaction: () => void;
  runInTrackingTransaction: <T>(fn: () => T, debuggingContext?: string | false) => T;

  resetTrackingTransaction: () => string;
  setTrackingTransactionEnv: (env: TransactionEnv) => void;
  assertTagNotConsumed: <T>(tag: Tag, obj?: T, keyName?: keyof T | string | symbol) => void;

  markTagAsConsumed: (_tag: Tag) => void;

  logTrackingStack: (transaction?: DebugTransactionFrame) => string;
}

export interface DebugTransactionFrame {
  parent: DebugTransactionFrame | null;
  debugLabel?: string | undefined;
}

export interface TrackerState {
  current: Tracker | null;
  stack: (Tracker | null)[];
}

export interface Tracker {
  add(tag: Tag): void;
  combine(): Tag;
}
