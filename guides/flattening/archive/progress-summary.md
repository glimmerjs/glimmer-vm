# Expression Flattening Progress Summary

## Overview

We're implementing expression flattening to transform helper calls from frame-based to stack-based execution, enabling pure stack machine operation for nested helper calls.

## Completed Steps

### Step 1: Add Arity Tracking ✅
- Added `calculateArityCounts` function to analyze argument patterns
- Added LOCAL_DEBUG logging to track helper arity
- No behavioral changes, just analysis capability

### Step 2: Stack-Based Arguments ✅
- Created `compileArgsForStack` function to push arguments directly to stack
- Implemented `VM_CONSTRUCT_ARGS_OP` (opcode 114) to reconstruct Arguments from stack
- Named arguments are pushed as [name, value] pairs where names are primitives
- Updated both `CallResolved` and `CallDynamicValue`
- **All 2043 tests passing!**

### Step 3: VM_PUSH_HELPER_OP (Attempted, Postponed) ❌
- Created VM_PUSH_HELPER_OP (opcode 115) that pushes helper results to stack
- Implemented the opcode handler successfully
- Tests failed when only CallResolved was updated
- **Learning**: All helper uses must be migrated together to avoid stack inconsistencies
- **Decision**: Postpone until we can update all helper paths simultaneously

## Current State

- Helper arguments are now stack-based (major achievement!)
- Still using frames (VM_PUSH_FRAME_OP / VM_POP_FRAME_OP)
- Still using $v0 register for helper results
- System is stable with all tests passing

## Next Steps

### Step 4: Remove Frames from Helper Calls
Now that arguments are stack-based, we should be able to remove frame management.

### Step 5: Future Optimizations
- Implement VM_PUSH_HELPER_OP for all helper uses
- Remove $v0 register usage entirely
- Achieve pure stack machine for expressions

## Key Code Locations

- `calculateArityCounts`: packages/@glimmer/opcode-compiler/lib/opcode-builder/helpers/expr.ts
- `compileArgsForStack`: packages/@glimmer/opcode-compiler/lib/opcode-builder/helpers/expr.ts
- `VM_CONSTRUCT_ARGS_OP`: packages/@glimmer/runtime/lib/compiled/opcodes/expressions.ts:342
- Test file: packages/@glimmer-workspace/integration-tests/test/helpers/stack-args-test.ts

## Important Insights

1. **Incremental migration is key**: We successfully migrated arguments to stack-based while keeping the rest of the system stable
2. **Named arguments convention**: [name, value] pairs with names as primitives works well
3. **Frame removal should be safe**: Since arguments no longer depend on frames, removing them should work
4. **VM_PUSH_HELPER_OP requires complete migration**: Can't mix stack-based and register-based helper results