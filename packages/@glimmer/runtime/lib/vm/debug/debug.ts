import {
  recordStackSize,
  getOpSnapshot,
  snapshotVM,
  frag,
  intoFragment,
  as,
  DebugLogger,
  value,
  prepend,
  tuple,
  record,
  DebugState,
  DiffState,
  DebugOpState,
} from '@glimmer/debug';
import type { OpSnapshot } from '@glimmer/debug';
import type { RuntimeOp, DebugVmSnapshot, BlockMetadata } from '@glimmer/interfaces';
import {
  LOCAL_DEBUG,
  LOCAL_INTERNALS_LOGGING,
  LOCAL_SUBTLE_LOGGING,
  LOCAL_TRACE_LOGGING,
} from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';

import type { VM } from '../../vm';

let lastState: DebugVmSnapshot;

export function debugInit(vm: VM): void {
  if (LOCAL_TRACE_LOGGING) {
    lastState = snapshotVM(vm);

    const options = { showSubtle: LOCAL_SUBTLE_LOGGING } as const;
    const logger = new DebugLogger(LOCAL_LOGGER, options);
    const state = new DebugState(lastState);
    const diff = new DiffState(undefined, undefined, state);

    const registers = state.registers;

    const done = logger.group(frag`Initial VM State`).expanded();
    logger.log(diff.up);
    logger.log(diff.ra);
    logger.log(diff.return);
    logger.log(prepend(frag`${as.label('saved')} `.styleAll('kw'), diff.saved));
    logger.log(prepend(frag`${as.label('temporaries')} `.styleAll('kw'), diff.temporaries));

    logger.log(tuple(registers.frame, { as: intoFragment }).subtle());

    done();
  }
}

/**
 * This should code-strip down to inlining `perform` if `import.meta.env.PROD`.
 * // @active
 */
export function debugAround(vm: VM, op: RuntimeOp, perform: () => void): void {
  if (LOCAL_DEBUG) {
    const prev = lastState;
    const after = debugBefore(snapshotVM(vm), prev, getOpSnapshot(op), vm.debug.block.metadata);

    try {
      perform();
      lastState = snapshotVM(vm);
      after(lastState);
    } finally {
      LOCAL_LOGGER.groupEnd();
    }
  } else {
    perform();
  }
}

export function debugBefore(
  currentSnapshot: DebugVmSnapshot,
  prevSnapshot: DebugVmSnapshot,
  opSnapshot: OpSnapshot,
  metadata: BlockMetadata | null
): (state: DebugVmSnapshot) => void {
  if (LOCAL_DEBUG) {
    const options = { showSubtle: LOCAL_SUBTLE_LOGGING } as const;
    const logger = new DebugLogger(LOCAL_LOGGER, options);
    const prevState = new DebugState(prevSnapshot);
    const beforeState = new DebugState(currentSnapshot);
    const op = new DebugOpState(beforeState.constants, opSnapshot, metadata);

    // [opName, params] = debug(debugState.constants, opcode)!;
    let done: undefined | (() => void);

    if (LOCAL_TRACE_LOGGING) {
      // console.log(`${typePos(vm['pc'])}.`);'
      done = logger.group(frag`${op.pos(beforeState)}. ${op.describe()}`).expanded();

      if (LOCAL_INTERNALS_LOGGING) {
        logger.internals(record(currentSnapshot, { as: value }));
      }

      const dynamicParams = op.dynamicParams;

      if (dynamicParams) {
        logger.log(record(dynamicParams, { as: value }));
      }
    }

    recordStackSize(currentSnapshot.$sp);

    return (debugState) => {
      if (LOCAL_TRACE_LOGGING) {
        const afterState = new DebugState(debugState);
        const diff = new DiffState(prevState, beforeState, afterState);

        if (debugState.threw) {
          logger.log(frag`${as.error('vm threw')}`);
        }

        let actualChange = afterState.sp - beforeState.sp;
        const expectedChange = op.expectedStackDelta(beforeState);

        if (expectedChange !== undefined && expectedChange !== actualChange) {
          done?.();
          throw new Error(
            `Error in ${op.name} (${opSnapshot.type}):\n\n${afterState.nextPc}. ${op
              .describe()
              .stringify(options)}\n\nStack changed by ${actualChange}, expected ${expectedChange}`
          );
        }

        if (LOCAL_TRACE_LOGGING) {
          const registers = afterState.registers;

          logger.log(diff.up);
          logger.log(diff.ra);
          logger.log(diff.return);
          logger.log(prepend(frag`${as.label('saved')} `.styleAll('kw'), diff.saved));
          logger.log(prepend(frag`${as.label('temporaries')} `.styleAll('kw'), diff.temporaries));

          logger.log(tuple(registers.frame, { as: intoFragment }).subtle());
          logger.log(
            prepend(frag`${as.label('frame')} `.styleAll('kw'), diff.frame(op.stack(beforeState)))
          );
          logger.log(prepend(frag`${as.label('scope')} `.styleAll('kw'), diff.scope));

          done?.();
        }
      }
    };
  }

  return () => {};
}
