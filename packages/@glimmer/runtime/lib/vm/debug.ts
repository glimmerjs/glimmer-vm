import { debug, debugOpcode, opcodeMetadata, recordStackSize } from '@glimmer/debug';
import type { DebugOperand, NormalizedMetadata } from '@glimmer/debug';
import type {
  Cursor,
  Dict,
  LiveBlock,
  LiveBlockDebug,
  Nullable,
  Optional,
  RuntimeOp,
  DebugVmState,
} from '@glimmer/interfaces';
import {
  LOCAL_DEBUG,
  LOCAL_INTERNALS_LOGGING,
  LOCAL_TRACE_LOGGING,
} from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';

import type { VM } from '../vm';
import { CONSTANTS, DESTROYABLE_STACK, STACKS } from '../symbols';
import { isScopeReference } from '../scope';
import { valueForRef } from '@glimmer/reference';
import { CURSOR_STACK } from './element-builder';
import type { DebugCursor } from '@glimmer/interfaces/lib/runtime/debug-vm';

/**
 * This should code-strip down to inlining `perform` if `import.meta.env.PROD`.
 * // @active
 */
export function debugAround(vm: VM, opcode: RuntimeOp, perform: () => void): void {
  if (LOCAL_DEBUG) {
    const after = debugBefore(debugState(vm), opcode);

    try {
      perform();
      after(debugState(vm));
    } finally {
      LOCAL_LOGGER.groupEnd();
    }
  } else {
    perform();
  }
}

/**
 * Snapshot the current state of the VM for debugging. This function should
 * **never** save off live references to objects managed by the VM, as the state
 * from the `before` debug stage can be used in the `after` debug stage (for
 * example, to perform stack verification).
 */
function debugState(vm: VM): DebugVmState {
  return {
    pc: vm.debug.pc,
    sp: vm.debug.sp,
    ra: vm.debug.ra,
    fp: vm.debug.fp,
    up: vm.debug.up,
    s0: vm.s0,
    s1: vm.s1,
    t0: vm.t0,
    t1: vm.t1,
    v0: vm.v0,
    threw: vm.debug.threw,
    scope: vm[STACKS].scope.current ? [...vm.scope().slots] : null,
    constructing: vm.elements().constructing,
    stacks: {
      eval: vm.debug.stack.all(),
      inserting: debugCursors(vm.elements()[CURSOR_STACK].toArray()),
      blocks: debugBlocks(vm.elements().debugBlocks()),
      destroyable: vm[DESTROYABLE_STACK].toArray(),
    },
    // constants don't need to be snapshotted since they (by definition) can't
    // change.
    constants: vm[CONSTANTS],
  };
}

export function debugBefore(state: DebugVmState, opcode: RuntimeOp): (state: DebugVmState) => void {
  let params: Optional<Dict<DebugOperand>> = undefined;
  let opName: string | undefined = undefined;
  const originalState = state;

  if (LOCAL_DEBUG) {
    let pos = state.pc - opcode.size;
    [opName, params] = debug(state.constants, opcode)!;

    if (LOCAL_TRACE_LOGGING) {
      // console.log(`${typePos(vm['pc'])}.`);
      LOCAL_LOGGER.group(`${pos}. ${debugOpcode(opName, params)}`);

      let debugParams = Object.entries(params).flatMap(([k, v]) =>
        hasDynamicValue(v) ? [k, '=', v.value, '\n'] : []
      );

      LOCAL_LOGGER.debug(...debugParams);
    }
  }

  let sp: number;

  if (LOCAL_DEBUG) {
    sp = state.sp;
  }

  recordStackSize(state.sp);

  {
    const pc = state.pc;
    const name = opName;
    const type = opcode.type;

    return function debugAfter(state: DebugVmState) {
      if (LOCAL_DEBUG) {
        let meta = opcodeMetadata(type);

        if (state.threw) {
          LOCAL_LOGGER.debug('%c -> vm threw', 'color: red');
        } else {
          let actualChange = state.sp - sp;
          const expectedChange = getStackChange(meta, opcode, originalState);

          if (expectedChange !== undefined && expectedChange !== actualChange) {
            if (params) {
              throw new Error(
                `Error in ${opName} (${type}):\n\n${pc}. ${debugOpcode(
                  name!,
                  params
                )}\n\nStack changed by ${actualChange}, expected ${expectedChange}`
              );
            } else {
              throw new Error(
                `Error in ${name}:\n\n${pc}. ${name}\n\nStack changed by ${actualChange}, expected ${expectedChange}`
              );
            }
          }
        }

        if (LOCAL_TRACE_LOGGING) {
          LOCAL_LOGGER.debug(
            '%c -> pc: %d, ra: %d, fp: %d, sp: %d, up: %d, s0: %O, s1: %O, t0: %O, t1: %O, v0: %O',
            'color: orange',
            state.pc,
            state.ra,
            state.fp,
            state.sp,
            state.up,
            state.s0,
            state.s1,
            state.t0,
            state.t1,
            state.v0
          );
          LOCAL_LOGGER.debug('%c -> current frame', 'color: red', state.stacks.eval.frame);
          {
            if (LOCAL_INTERNALS_LOGGING) {
              LOCAL_LOGGER.groupCollapsed('%c -> eval stack internals', 'color: #999');
              try {
                let { before, frame } = state.stacks.eval;
                LOCAL_LOGGER.debug('%c -> before', 'color: #999', before);
                LOCAL_LOGGER.debug('%c -> frame', 'color: #red', frame);
              } finally {
                LOCAL_LOGGER.groupEnd();
              }
            }
          }

          LOCAL_LOGGER.debug('%c -> block stack', 'color: magenta', state.stacks.blocks);
          LOCAL_LOGGER.debug('%c -> destructor stack', 'color: violet', state.stacks.destroyable);
          if (state.scope === null) {
            LOCAL_LOGGER.debug('%c -> scope', 'color: red', 'null');
          } else {
            LOCAL_LOGGER.group('%c -> scope', 'color: green');
            try {
              for (let slot of state.scope) {
                LOCAL_LOGGER.debug(isScopeReference(slot) ? valueForRef(slot) : slot);
              }
            } finally {
              LOCAL_LOGGER.groupEnd();
            }
          }

          LOCAL_LOGGER.debug('%c -> inserting', 'color: blue', state.stacks.inserting);

          LOCAL_LOGGER.debug('%c -> constructing', 'color: aqua', state.constructing);
          LOCAL_LOGGER.groupEnd();
        }
      }
    };
  }
}

function hasDynamicValue(operand: DebugOperand) {
  switch (operand.type) {
    case 'constant':
    case 'dynamic':
      return true;
    case 'array':
      return !('kind' in operand);
    default:
      return false;
  }
}

function getStackChange(
  metadata: Nullable<NormalizedMetadata>,
  op: RuntimeOp,
  state: DebugVmState
): number | undefined {
  if (!metadata) return;

  const stackChange = metadata.stackCheck;

  if (typeof stackChange === 'function') {
    return stackChange(op, state);
  }
}

function debugBlocks(cursors: LiveBlock[]): LiveBlockDebug[] {
  return cursors.map((c) => c.debug?.()).filter((c): c is LiveBlockDebug => c !== undefined);
}

function debugCursors(cursors: Cursor[]): DebugCursor[] {
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
