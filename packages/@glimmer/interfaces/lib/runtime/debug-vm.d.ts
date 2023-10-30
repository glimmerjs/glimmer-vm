import type { DebugConstants } from '@glimmer/debug';
import type {
  BlockMetadata,
  LiveBlockDebug,
  Nullable,
  RuntimeHeap,
  ScopeSlot,
  SimpleElement,
  SimpleNode,
} from '@glimmer/interfaces';

// Make assignment fail in both directions (univariant).
type SnapshotArray<T = unknown> = readonly T[] & { push? :never };

export interface DebugVmSnapshot {
  $pc: number;
  $sp: number;
  $ra: number;
  $fp: number;
  $up: unknown;
  $s0: unknown;
  $s1: unknown;
  $t0: unknown;
  $t1: unknown;
  $v0: unknown;
  currentPc: number;

  // these values don't need to be snapshotted since they (by definition) can't
  // change.
  readonly constant: {
    // The runtime heap is append-only, so it's safe to cache.
    readonly heap: RuntimeHeap;
    // Constants are created by deserializing the wire format.
    // The `DebugConstants` value is readonly.
    readonly constants: DebugConstants;
    // The VM's meta pointer changes when the block changes, but
    // the internals of `BlockMetadata` never change.
    readonly block: BlockMetadata | null;
  };

  readonly dom: {
    readonly constructing: SimpleElement | null;
    readonly inserting: SnapshotArray<DebugCursor>;
    readonly blocks: SnapshotArray<LiveBlockDebug>;
  };

  readonly frame: {
    scope: SnapshotArray<ScopeSlot> | null;
    stack: SnapshotArray;
    before: SnapshotArray;
  };

  readonly threw: boolean;
  readonly destroyable: SnapshotArray<object>;
}

export interface ReadonlyStack {
  get<T = number>(position: number, base?: number): T;
  top<T>(offset?: number): T;
}

export interface CleanStack extends ReadonlyStack {
  push(...values: unknown[]): void;
  pop<T>(count?: number): T;
  dup(position?: number): void;
}

export interface InternalStack extends CleanStack {
  reset(): void;
}

export interface DebugStack extends InternalStack {
  /** @snapshots */
  frame(): readonly unknown[];
  /** @snapshots */
  all(): { before: readonly unknown[]; readonly frame: readonly unknown[] };
}
export interface DebugCursor {
  readonly parent: SimpleElement;
  readonly next?: Nullable<SimpleNode>;
}