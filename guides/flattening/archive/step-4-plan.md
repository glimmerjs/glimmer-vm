# Step 4 Plan: Remove Frames from Helper Calls

## Goal

Remove VM_PUSH_FRAME_OP and VM_POP_FRAME_OP from helper calls now that arguments are stack-based. This simplifies the instruction sequence and moves us closer to a pure stack machine.

## Current State

```typescript
// Current CallResolved implementation
case Op.CallResolved: {
  const [, callee, args] = expression;
  const handle = encode.resolveHelper(callee);
  const [positionalCount, namedCount] = calculateArityCounts(args);
  
  encode.op(VM_PUSH_FRAME_OP);        // <-- We want to remove this
  compileArgsForStack(encode, args);
  encode.op(VM_CONSTRUCT_ARGS_OP, positionalCount, namedCount);
  encode.op(VM_HELPER_OP, handle);
  encode.op(VM_POP_FRAME_OP);         // <-- And this
  encode.op(VM_FETCH_OP, $v0);
  return;
}
```

## Target State

```typescript
// Target CallResolved implementation
case Op.CallResolved: {
  const [, callee, args] = expression;
  const handle = encode.resolveHelper(callee);
  const [positionalCount, namedCount] = calculateArityCounts(args);
  
  // No frame operations!
  compileArgsForStack(encode, args);
  encode.op(VM_CONSTRUCT_ARGS_OP, positionalCount, namedCount);
  encode.op(VM_HELPER_OP, handle);
  encode.op(VM_FETCH_OP, $v0);
  return;
}
```

## Why This Should Work

1. **Arguments are self-contained**: With Step 2 complete, `compileArgsForStack` pushes all arguments directly to the stack
2. **VM_CONSTRUCT_ARGS_OP handles reconstruction**: It pops values from stack and creates the Arguments object
3. **No frame-dependent operations**: The helper execution doesn't rely on frame state
4. **Stack remains balanced**: Same number of pushes and pops, just without frame overhead

## Implementation Steps

### 1. Remove frames from CallResolved

- Remove VM_PUSH_FRAME_OP before args
- Remove VM_POP_FRAME_OP after helper

### 2. Remove frames from CallDynamicValue

- Same pattern as CallResolved
- Currently has frames around dynamic helper calls

### 3. Check other helper-related operations

- Log helper (uses frames)
- Any other expression compilation that uses frames

### 4. Run tests

- All tests should continue passing
- Stack should remain balanced

## Risk Analysis

### Low Risk

- Arguments are already stack-based (proven in Step 2)
- Frame operations are just overhead at this point
- Stack discipline should be maintained

### Potential Issues

1. **Hidden frame dependencies**: Some part of the system might expect frames
2. **Dynamic scope**: Might be affected by frame removal
3. **Error handling**: Stack traces might change

### Mitigation

- Run full test suite after each change
- Test nested helper calls specifically
- Monitor stack balance

## Test Strategy

1. **Existing tests**: All should continue passing
2. **Nested helpers**: Our key test case `{{join (uppercase "hello") (lowercase "WORLD")}}`
3. **Error cases**: Ensure error handling still works
4. **Performance**: Should see slight improvement without frame overhead

## Success Criteria

- All 2043 tests pass
- Nested helper calls work correctly
- No stack corruption or imbalance
- Cleaner, simpler instruction sequence

## Alternative Approach

If removing frames causes issues, we could:

1. Keep frames temporarily but make them no-ops
2. Remove frames from one operation at a time
3. Add debug assertions to verify stack state

## Confirmed: Frames Can Be Safely Removed

Based on Yehuda's confirmation:

- ✅ Frames serve no purpose for helpers beyond argument passing
- ✅ No error handling or debugging features depend on helper frames
- ✅ Stack traces and error messages are unrelated to helper frames

## Final Plan - Ready to Execute

This is a safe and straightforward change:

1. **Remove frames from all helper calls**:
   - CallResolved
   - CallDynamicValue
   - Log helper

2. **Expected outcome**:
   - All tests pass (no behavioral change)
   - Simpler instruction sequence
   - One step closer to pure stack machine

3. **No risks identified** - frames are purely overhead for helpers

## Ready to Proceed ✅

The plan is locked in. We will systematically remove VM_PUSH_FRAME_OP and VM_POP_FRAME_OP from all helper call sites.
