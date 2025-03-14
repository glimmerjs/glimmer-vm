import {
  VM_ENTER_OP,
  VM_EXIT_OP,
  VM_JUMP_EQ_OP,
  VM_JUMP_OP,
  VM_JUMP_UNLESS_OP,
  VM_POP_FRAME_OP,
  VM_POP_OP,
  VM_PUSH_FRAME_OP,
  VM_RETURN_OP,
  VM_RETURN_TO_OP,
} from '@glimmer/constants';
import { unwrap } from '@glimmer/debug-util';

import type { PushStatementOp } from '../../syntax/compilers';

import { HighLevelBuilderOpcodes } from '../opcodes';
import { labelOperand } from '../operands';

export type When = (match: number, callback: () => void) => void;

export function SwitchCases(
  op: PushStatementOp,
  bootstrap: () => void,
  matcher: (when: When) => void
): void {
  // Setup the switch DSL
  let clauses: Array<{ match: number; label: string; callback: () => void }> = [];

  let count = 0;

  function when(match: number, callback: () => void): void {
    clauses.push({ match, callback, label: `CLAUSE${count++}` });
  }

  // Call the callback
  matcher(when);

  // Emit the opcodes for the switch
  op(VM_ENTER_OP, 1);
  bootstrap();
  op(HighLevelBuilderOpcodes.StartLabels);

  // First, emit the jump opcodes. We don't need a jump for the last
  // opcode, since it bleeds directly into its clause.
  for (let clause of clauses.slice(0, -1)) {
    op(VM_JUMP_EQ_OP, labelOperand(clause.label), clause.match);
  }

  // Enumerate the clauses in reverse order. Earlier matches will
  // require fewer checks.
  for (let i = clauses.length - 1; i >= 0; i--) {
    let clause = unwrap(clauses[i]);

    op(HighLevelBuilderOpcodes.Label, clause.label);
    op(VM_POP_OP, 1);
    clause.callback();

    // The first match is special: it is placed directly before the END
    // label, so no additional jump is needed at the end of it.
    if (i !== 0) {
      op(VM_JUMP_OP, labelOperand('END'));
    }
  }

  op(HighLevelBuilderOpcodes.Label, 'END');
  op(HighLevelBuilderOpcodes.StopLabels);
  op(VM_EXIT_OP);
}

/**
 * A convenience for pushing some arguments on the stack and
 * running some code if the code needs to be re-executed during
 * updating execution if some of the arguments have changed.
 *
 * # Initial Execution
 *
 * The `args` function should push zero or more arguments onto
 * the stack and return the number of arguments pushed.
 *
 * The `body` function provides the instructions to execute both
 * during initial execution and during updating execution.
 *
 * Internally, this function starts by pushing a new frame, so
 * that the body can return and sets the return point ($ra) to
 * the ENDINITIAL label.
 *
 * It then executes the `args` function, which adds instructions
 * responsible for pushing the arguments for the block to the
 * stack. These arguments will be restored to the stack before
 * updating execution.
 *
 * Next, it adds the Enter opcode, which marks the current position
 * in the DOM, and remembers the current $pc (the next instruction)
 * as the first instruction to execute during updating execution.
 *
 * Next, it runs `body`, which adds the opcodes that should
 * execute both during initial execution and during updating execution.
 * If the `body` wishes to finish early, it should Jump to the
 * `FINALLY` label.
 *
 * Next, it adds the FINALLY label, followed by:
 *
 * - the Exit opcode, which finalizes the marked DOM started by the
 *   Enter opcode.
 * - the Return opcode, which returns to the current return point
 *   ($ra).
 *
 * Finally, it adds the ENDINITIAL label followed by the PopFrame
 * instruction, which restores $fp, $sp and $ra.
 *
 * # Updating Execution
 *
 * Updating execution for this `replayable` occurs if the `body` added an
 * assertion, via one of the `JumpIf`, `JumpUnless` or `AssertSame` opcodes.
 *
 * If, during updating executon, the assertion fails, the initial VM is
 * restored, and the stored arguments are pushed onto the stack. The DOM
 * between the starting and ending markers is cleared, and the VM's cursor
 * is set to the area just cleared.
 *
 * The return point ($ra) is set to -1, the exit instruction.
 *
 * Finally, the $pc is set to to the instruction saved off by the
 * Enter opcode during initial execution, and execution proceeds as
 * usual.
 *
 * The only difference is that when a `Return` instruction is
 * encountered, the program jumps to -1 rather than the END label,
 * and the PopFrame opcode is not needed.
 */
export function Replayable(op: PushStatementOp, args: () => number, body: () => void): void {
  // Start a new label frame, to give END and RETURN
  // a unique meaning.

  op(HighLevelBuilderOpcodes.StartLabels);
  op(VM_PUSH_FRAME_OP);

  // If the body invokes a block, its return will return to
  // END. Otherwise, the return in RETURN will return to END.
  op(VM_RETURN_TO_OP, labelOperand('ENDINITIAL'));

  // Push the arguments onto the stack. The args() function
  // tells us how many stack elements to retain for re-execution
  // when updating.
  let count = args();

  // Start a new updating closure, remembering `count` elements
  // from the stack. Everything after this point, and before END,
  // will execute both initially and to update the block.
  //
  // The enter and exit opcodes also track the area of the DOM
  // associated with this block. If an assertion inside the block
  // fails (for example, the test value changes from true to false
  // in an #if), the DOM is cleared and the program is re-executed,
  // restoring `count` elements to the stack and executing the
  // instructions between the enter and exit.
  op(VM_ENTER_OP, count);

  // Evaluate the body of the block. The body of the block may
  // return, which will jump execution to END during initial
  // execution, and exit the updating routine.
  body();

  // All execution paths in the body should run the FINALLY once
  // they are done. It is executed both during initial execution
  // and during updating execution.
  op(HighLevelBuilderOpcodes.Label, 'FINALLY');

  // Finalize the DOM.
  op(VM_EXIT_OP);

  // In initial execution, this is a noop: it returns to the
  // immediately following opcode. In updating execution, this
  // exits the updating routine.
  op(VM_RETURN_OP);

  // Cleanup code for the block. Runs on initial execution
  // but not on updating.
  op(HighLevelBuilderOpcodes.Label, 'ENDINITIAL');
  op(VM_POP_FRAME_OP);
  op(HighLevelBuilderOpcodes.StopLabels);
}

/**
 * A specialized version of the `replayable` convenience that allows the
 * caller to provide different code based upon whether the item at
 * the top of the stack is true or false.
 *
 * As in `replayable`, the `ifTrue` and `ifFalse` code can invoke `return`.
 *
 * During the initial execution, a `return` will continue execution
 * in the cleanup code, which finalizes the current DOM block and pops
 * the current frame.
 *
 * During the updating execution, a `return` will exit the updating
 * routine, as it can reuse the DOM block and is always only a single
 * frame deep.
 */
export function ReplayableIf(
  op: PushStatementOp,
  args: () => number,
  ifTrue: () => void,
  ifFalse?: () => void
): void {
  return Replayable(op, args, () => {
    // If the conditional is false, jump to the ELSE label.
    op(VM_JUMP_UNLESS_OP, labelOperand('ELSE'));
    // Otherwise, execute the code associated with the true branch.
    ifTrue();
    // We're done, so return. In the initial execution, this runs
    // the cleanup code. In the updating VM, it exits the updating
    // routine.
    op(VM_JUMP_OP, labelOperand('FINALLY'));
    op(HighLevelBuilderOpcodes.Label, 'ELSE');

    // If the conditional is false, and code associatied ith the
    // false branch was provided, execute it. If there was no code
    // associated with the false branch, jumping to the else statement
    // has no other behavior.
    if (ifFalse !== undefined) {
      ifFalse();
    }
  });
}
