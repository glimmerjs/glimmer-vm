# Step 4 Findings: Frames Cannot Be Removed Yet

## Summary

We attempted to remove VM_PUSH_FRAME_OP and VM_POP_FRAME_OP from helper calls, but discovered that the entire Arguments system depends on the frame pointer mechanism.

## Why Frames Are Still Needed

### 1. Arguments System Dependency

The `VMArgumentsImpl` class uses `stack.registers[$sp]` to calculate argument positions:

```typescript
// In VMArgumentsImpl.setup()
let namedBase = stack.registers[$sp] - namedCount + 1;

// In VMArgumentsImpl.empty()
let base = stack.registers[$sp] + 1;
```

### 2. Stack Pointer Management

- VM_PUSH_FRAME_OP sets up $fp and $sp registers
- VM_POP_FRAME_OP restores them
- Without frames, $sp is not properly maintained
- Arguments are read from incorrect stack positions

### 3. Deep Integration

The frame mechanism is used throughout:
- Component invocation
- Block invocation  
- Helper calls
- Dynamic expressions

## What We Achieved

1. **Stack-based arguments work!** - Step 2 successfully converted arguments to stack-based
2. **VM_CONSTRUCT_ARGS_OP works** - Our new opcode correctly reconstructs Arguments
3. **All tests pass** - With frames in place, everything works correctly

## Next Steps

### Option 1: Redesign Arguments System (Major)
- Create new Arguments implementation that doesn't rely on $sp
- Calculate positions based on actual stack size
- This is a major refactoring

### Option 2: Accept Frames for Now (Recommended)
- Keep frames as part of helper calling convention
- Focus on other optimizations
- Revisit when we redesign the entire VM

### Option 3: Implement VM_PUSH_HELPER_OP (Step 5)
- Push helper results directly to stack
- Eliminate VM_FETCH_OP
- This still provides value even with frames

## Conclusion

Frames are deeply integrated into the VM's calling convention. Removing them requires redesigning the Arguments system, which is beyond the scope of expression flattening.

We recommend:
1. Keep frames for now
2. Move forward with VM_PUSH_HELPER_OP (Step 5)
3. Consider frame removal as a separate, larger project

The stack-based arguments (Step 2) are still a major win, enabling future optimizations.