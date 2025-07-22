# Step 4 Analysis: Why Removing Frames Failed

## The Problem

When we removed VM_PUSH_FRAME_OP and VM_POP_FRAME_OP, all tests failed. The root cause is that the Arguments system depends on the frame pointer ($fp) and stack pointer ($sp) registers.

## How Frames Work

1. **VM_PUSH_FRAME_OP**:
   - Pushes current $ra (return address) to stack
   - Pushes current $fp (frame pointer) to stack  
   - Sets $fp = $sp - 1 (new frame pointer)

2. **VM_POP_FRAME_OP**:
   - Sets $sp = $fp - 1 (restore stack pointer)
   - Pops $fp from stack (restore frame pointer)
   - Pops $ra from stack (restore return address)

## The Arguments Dependency

In `VMArgumentsImpl.setup()`:

```typescript
let namedBase = stack.registers[$sp] - namedCount + 1;
```

The system uses $sp to calculate where arguments are on the stack. Without frames:
- $sp is not properly maintained
- Arguments are read from wrong stack positions
- Helpers get garbage values

## Why VM_CONSTRUCT_ARGS_OP Works

Our new opcode works because it:
1. Manually pops values from stack
2. Reconstructs the layout that args.setup expects
3. Calls args.setup with correct positioning

But it still relies on $sp being correct for the final setup call.

## Solutions

### Option 1: Fix $sp Management (Recommended)
- Update VM_CONSTRUCT_ARGS_OP to manage $sp correctly
- Calculate proper base positions without relying on frames
- This is cleaner and moves us toward pure stack machine

### Option 2: Keep Frames for Now
- Continue using frames until we can refactor the entire Arguments system
- This is the safer incremental approach

## Decision

Let's go with Option 1. We need to update VM_CONSTRUCT_ARGS_OP to:
1. Calculate base positions manually
2. Not rely on $sp register
3. Pass correct base value to args.setup

This way we can remove frames while keeping the Arguments system working.