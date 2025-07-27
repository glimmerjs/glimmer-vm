# Step 3 Status: VM_PUSH_HELPER_OP Implementation

## What We've Done

1. ✅ Added VM_PUSH_HELPER_OP constant (opcode 115)
2. ✅ Implemented VM_PUSH_HELPER_OP handler that pushes helper results directly to stack
3. ✅ Updated CallResolved to use VM_PUSH_HELPER_OP
4. ❌ Tests are failing when using VM_PUSH_HELPER_OP

## Why Tests Are Failing

The issue appears to be that helpers return `Reference` objects, and our implementation correctly pushes these to the stack. The VM_PUSH_HELPER_OP handler is doing the right thing.

## Other Uses of VM_HELPER_OP

We discovered that VM_HELPER_OP is also used in:
1. `CallDynamicValue` in expr.ts (for dynamic helpers)
2. `Call` function in vm.ts (for keyword helpers like `{{if}}`)
3. `CallDynamicBlock` in vm.ts

## Next Steps

We have a choice:
1. Update ALL uses of VM_HELPER_OP at once
2. Make VM_PUSH_HELPER_OP and VM_HELPER_OP coexist temporarily

Given that all tests pass with VM_HELPER_OP but fail with VM_PUSH_HELPER_OP when only CallResolved is updated, it seems we need to update all uses together.

## Recommendation

Let's pause and reconsider our approach. The issue might be that we're creating an inconsistent state where some helpers push to stack directly while others use $v0. This could be causing the stack to be in an unexpected state.

Options:
1. Update all helper calls at once to use VM_PUSH_HELPER_OP
2. Keep using VM_HELPER_OP for now and move to the next step (removing frames)
3. Debug the specific test failure to understand what's happening

I recommend option 3 - let's debug one specific test failure to understand the root cause.