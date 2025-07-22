# Stack Structure for Helper Calls

This document describes the stack structure and calling conventions for both resolved and dynamic helper calls in Glimmer VM.

## Overview

Both resolved and dynamic helpers use a similar stack-based calling convention where:

- Arguments are pushed onto the stack
- A frame is created to manage the call
- The return value is placed at `$fp - 1` (the "reserved slot")
- When the frame is popped, the return value remains on the stack

## Resolved Helpers

For helpers known at compile time, the process is:

1. **Push frame with reserved slot**

   ```text
   pushFrameWithReserved():
   - Push null (reserved slot for return value)
   - Push $ra (return address)
   - Push $fp (old frame pointer)
   - Set new $fp = $sp - 1
   ```

2. **Stack state after frame push**

   ```text
   Stack: [..., null, $ra, $fp]
                 ↑
                 $fp - 1 (reserved slot)
   ```

3. **Execute helper**
   - Push arguments onto stack
   - Call helper with compile-time handle
   - Helper writes return value to reserved slot using `setReturnValue`

4. **Pop frame**

   ```text
   popFrame():
   - Restore $sp = $fp - 1
   - Restore $ra and $fp from stack
   
   Stack: [..., return_value]
   ```

## Dynamic Helpers

For helpers determined at runtime, we use an elegant variation where the helper reference itself serves as the reserved slot:

1. **Initial state**

   ```text
   Stack: [..., helper_ref]
   ```

2. **Push regular frame** (not `pushFrameWithReserved`)

   ```text
   pushFrame():
   - Push $ra (return address)
   - Push $fp (old frame pointer)
   - Set new $fp = $sp - 1
   
   Stack: [..., helper_ref, $ra, $fp]
                    ↑
                    $fp - 1 (helper ref is the reserved slot)
   ```

3. **Key insight**: The helper reference naturally ends up at `$fp - 1`, the same position where resolved helpers have their null reserved slot. This is intentional - we're using the helper ref as both:
   - The value to invoke (what to call)
   - The location for the return value (where to put the result)

4. **Execute dynamic helper** (`VM_DYNAMIC_HELPER_OP`)
   - Get helper ref from `$fp - 1`
   - Push arguments onto stack
   - Call the helper
   - Use `setReturnValue` to write result back to `$fp - 1` (replacing the helper ref)

5. **Stack state after execution**

   ```text
   Stack: [..., return_value, $ra, $fp]
                      ↑
                      Same position as helper_ref, now contains result
   ```

6. **Pop frame**

   ```text
   Stack: [..., return_value]
   ```

## Comparison

| Aspect | Resolved Helper | Dynamic Helper |
|--------|----------------|----------------|
| Frame type | `pushFrameWithReserved` | `pushFrame` |
| Reserved slot | Explicit `null` | Helper reference |
| Helper location | Compile-time constant | `$fp - 1` |
| Return location | `$fp - 1` | `$fp - 1` |
| Final stack | `[..., return_value]` | `[..., return_value]` |

## Benefits

This design ensures that:

1. Dynamic helpers have the same stack behavior as resolved helpers
2. No extra stack slots are needed - the helper ref dual-purposes as the return slot
3. The calling convention is consistent regardless of whether the helper is known at compile time
4. Frame management is simplified since both types of calls result in the same stack state

## Implementation Notes

### VM_DYNAMIC_HELPER_OP

This opcode must:

1. Pop arguments from the stack
2. Get the helper reference from `stack.get(-1)` (which accesses `$fp - 1`)
3. Execute the helper
4. Use `vm.lowlevel.setReturnValue(result)` to place the result at `$fp - 1`

### CallDynamicAsHelper

When compiling dynamic helper calls:

1. The helper expression is evaluated first, leaving the helper ref on the stack
2. Use regular `VM_PUSH_FRAME_OP` (not the reserved variant)
3. Push arguments
4. Execute `VM_DYNAMIC_HELPER_OP`
5. Pop frame
6. The return value is now on top of the stack, ready for subsequent operations

## Current Problem (July 2025)

### Context

We've been working on migrating dynamic helpers from the old wire format to the new StackExpression format. This involves converting `CallDynamicValue` expressions to use a flattened stack-based approach instead of nested expressions.

### Test Failures

After implementing the changes to support dynamic helpers with the new stack structure, we're seeing test failures. A simple test case that's failing:

```handlebars
{{hello}}
```

Where `hello` is a helper class that should be invoked dynamically. This test was passing before the recent changes to implement the StackExpression format.

### Symptoms

1. **Helper reference not found**: `VM_DYNAMIC_HELPER_OP` is getting incorrect values when trying to retrieve the helper reference from the stack
2. **Stack underflow**: "can't pop an empty stack" errors in the updating opcode stack, suggesting an imbalance in Enter/Exit operations

### Where to Look

To understand what changed:
1. Check git history for recent changes to:
   - `packages/@glimmer/compiler/lib/passes/2-encoding/expressions.ts` (buildDynamicHelperCall)
   - `packages/@glimmer/opcode-compiler/lib/opcode-builder/helpers/vm.ts` (CallDynamicAsHelper)
   - `packages/@glimmer/runtime/lib/compiled/opcodes/expressions.ts` (VM_DYNAMIC_HELPER_OP)

2. The test file: `packages/@glimmer-workspace/integration-tests/test/managers/helper-manager-test.ts`

3. Compare the old `CallDynamicValue` implementation with the new `StackExpression` approach

The core issue appears to be related to how the helper reference is positioned on the stack relative to the frame pointer after `pushFrame()` is called.
