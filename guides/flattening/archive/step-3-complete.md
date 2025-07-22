# Step 3 Complete: VM_PUSH_HELPER_OP Learnings

## What We Attempted

We tried to create VM_PUSH_HELPER_OP that pushes helper results directly to the stack instead of using the $v0 register. The goal was to eliminate VM_FETCH_OP and move closer to a pure stack machine.

## Implementation

1. ✅ Added VM_PUSH_HELPER_OP constant (opcode 115)
2. ✅ Implemented the opcode handler that pushes helper results to stack
3. ✅ Updated CallResolved to use VM_PUSH_HELPER_OP

## Why It Failed

When we ran tests with VM_PUSH_HELPER_OP:
- All tests failed with errors like "Got undefined, expected: Reference"
- The VM_PUSH_HELPER_OP handler itself was correct
- The issue appears to be that updating only CallResolved creates an inconsistent state

## Root Cause Analysis

We discovered that VM_HELPER_OP is used in multiple places:
1. `CallResolved` in expr.ts (static helper calls)
2. `CallDynamicValue` in expr.ts (dynamic helper calls)
3. `Call` function in vm.ts (keyword helpers)
4. `CallDynamicBlock` in vm.ts

When only CallResolved uses the new opcode, it likely creates stack inconsistencies because other parts of the system expect the old behavior.

## Key Learnings

1. **Partial migration is problematic**: We can't update just one use of VM_HELPER_OP without breaking the system
2. **Stack consistency is critical**: The VM expects a consistent stack state
3. **All helper paths must be updated together**: To avoid inconsistencies

## Decision: Continue with Current Approach

Instead of trying to implement VM_PUSH_HELPER_OP now, we should:
1. Keep using VM_HELPER_OP with our stack-based arguments (Step 2 complete)
2. Move on to Step 4: Remove frames from helper calls
3. Consider VM_PUSH_HELPER_OP as a future optimization after we've completed the full migration

## Next Step

Proceed to Step 4: Remove frames from helper calls now that arguments are stack-based.

The stack-based argument passing (Step 2) is working perfectly with all tests passing. We can build on this success by removing frames next.