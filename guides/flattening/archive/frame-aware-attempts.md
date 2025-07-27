# Frame-Aware Return: Implementation Attempts

## Attempt 1: Direct Stack Write (Step 5)

**Approach**: Write return value to calculated position before frame pop
**Result**: Failed - complex stack calculations and timing issues

## Attempt 2: Modified Frame Pop (Step 6)

**Approach**: Created VM_POP_FRAME_WITH_RETURN_OP that preserves top value
**Implementation**:
```typescript
popFrameWithReturn() {
  const returnValue = this.stack.get(0, currentSp);
  // Normal frame pop
  this.stack.push(returnValue);
}
```
**Result**: Failed - "Expected value to be present" errors

## Why These Approaches Failed

### Stack State Complexity

When VM_HELPER_FRAME_OP executes:
1. Stack has frame data ($ra, $fp)
2. Arguments object is popped by the helper
3. We push the return value
4. Frame pop needs to find saved registers at specific positions

The issue is that the frame pop operation expects:
- `stack.get(0)` to be $ra
- `stack.get(1)` to be $fp

But after we push the return value, these are at different positions.

### The Fundamental Challenge

The frame mechanism and stack management are tightly coupled. The frame pop operation makes assumptions about stack layout that are violated when we try to insert a return value.

## Option 3: Stack Reservation (Not Attempted)

This might work better because:
1. Reserve space when pushing frame
2. Helper writes to reserved spot
3. Frame pop naturally exposes the value

But this requires modifying:
- Frame push logic
- Helper execution to know about reserved spot
- All code that uses frames

## Conclusion

The frame-aware return optimization is more complex than anticipated. The VM's stack and frame management are deeply intertwined, making it difficult to modify one without affecting the other.

For now, using $v0 + VM_FETCH_OP remains the most reliable approach. A proper implementation would require a more comprehensive redesign of the frame/stack interaction.