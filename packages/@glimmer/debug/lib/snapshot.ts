import type {
  BlockMetadata,
  Cursor,
  DebugCursor,
  DebugStack,
  DebugVmSnapshot,
  LiveBlock,
  LiveBlockDebug,
  Nullable,
  RuntimeHeap,
  ScopeSlot,
  SimpleElement,
} from '@glimmer/interfaces';
import type { UnwindTarget } from '@glimmer/runtime/lib/vm/unwind';

import type { DebugConstants } from '..';

/**
 * Snapshot the current state of the VM for debugging. This function should
 * **never** save off live references to objects managed by the VM, as the state
 * from the `before` debug stage can be used in the `after` debug stage (for
 * example, to perform stack verification).
 */
export function snapshotVM(vm: SnapshottableVM): DebugVmSnapshot {
  const debug = vm.debug;
  const dom = debug.dom;
  const stack = debug.stack.all();

  return {
    $pc: debug.pc,
    $sp: debug.sp,
    $ra: debug.ra,
    $fp: debug.fp,
    $up: debug.up,
    $s0: vm.s0,
    $s1: vm.s1,
    $t0: vm.t0,
    $t1: vm.t1,
    $v0: vm.v0,
    currentPc: debug.currentPc,

    // these values don't need to be snapshotted since they (by definition)
    // can't change.
    constant: {
      ...debug.constant,
      block: debug.block.metadata,
    },

    dom: {
      constructing: dom.constructing,
      inserting: snapshotCursors(dom.inserting),
      blocks: snapshotBlocks(dom.blocks),
    },

    frame: {
      scope: debug.scope ? ([...debug.scope] as const) : [],
      stack: stack.frame,
      before: stack.before,
    },

    threw: debug.threw,
    destroyable: [...debug.destroyable] as const,
  };
}

export interface VmDebugState {
  readonly fp: number;
  readonly ra: number;
  readonly pc: number;
  readonly sp: number;
  readonly up: UnwindTarget;
  /**
   * even though the scope object itself doesn't change, its
   * current scope values do.
   *
   * @mutable
   */
  readonly scope: Nullable<ScopeSlot[]>;

  /** @mutable */
  readonly destroyable: object[];

  // The value of $pc minus the size of the current op. Since
  // $pc represents the *next* op, this produces the position
  // of the current op.
  readonly currentPc: number;

  readonly dom: {
    readonly constructing: Nullable<SimpleElement>;
    /** @mutable */
    readonly inserting: Cursor[];
    /** @mutable */
    readonly blocks: LiveBlock[];
  };

  // these values change only when the current block changes,
  // so they can be cached and reused whenever a block change
  // occurs.
  readonly block: {
    metadata: BlockMetadata | null;
  };

  // these values don't ever need to be snapshotted and
  // this object can be cached up front when the VM is created.
  readonly constant: {
    readonly constants: DebugConstants;
    readonly heap: RuntimeHeap;
  };

  /** @mutable */
  readonly stack: DebugStack;
  readonly threw: Error | undefined;
}

export interface SnapshottableVM {
  debug: VmDebugState;
  s0: unknown;
  s1: unknown;
  t0: unknown;
  t1: unknown;
  v0: unknown;
}

function snapshotCursors(cursors: readonly Cursor[]): readonly DebugCursor[] {
  return cursors.map((cursor) => {
    const { element, nextSibling } = cursor;
    if (nextSibling) {
      return new (class InsertAt {
        readonly parent = element;
        readonly next = nextSibling;
      })();
    } else {
      return new (class AppendTo {
        readonly parent = element;
      })();
    }
  });
}

function snapshotBlocks(cursors: LiveBlock[]): readonly LiveBlockDebug[] {
  return cursors.map((c) => c.debug?.()).filter((c): c is LiveBlockDebug => c !== undefined);
}
