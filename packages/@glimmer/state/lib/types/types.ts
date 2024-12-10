import type { Tag } from './tag';

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

export type Destroyable = object;
export type Destructor<T extends Destroyable> = (destroyable: T) => void;

export type OneOrMany<T> = null | T | T[];

export type LiveState = 0;
export type DestroyingState = 1;
export type DestroyedState = 2;
export type DestroyableState = LiveState | DestroyingState | DestroyedState;

export interface DestroyableMeta<T extends Destroyable> {
  source?: T | undefined;
  parents: OneOrMany<Destroyable>;
  children: OneOrMany<Destroyable>;
  eagerDestructors: OneOrMany<Destructor<T>>;
  destructors: OneOrMany<Destructor<T>>;
  state: DestroyableState;
}
