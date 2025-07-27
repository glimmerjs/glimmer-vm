# Frame-Aware Return: Implementation Challenges

## The Attempt

We tried to implement VM_HELPER_FRAME_OP that would write the helper return value directly to the stack position that would be exposed after frame pop, eliminating the need for VM_FETCH_OP.

## The Challenge

The exact stack layout and timing proved more complex than anticipated:

1. **Stack State**: When VM_HELPER_FRAME_OP executes, the Arguments object has been popped from the stack
2. **Frame Layout**: We need to know exactly where to write the value so it's at the top after popFrame
3. **Base Calculation**: The relationship between $fp, $sp, and the actual stack positions is intricate

## Current Status

- VM_HELPER_FRAME_OP is implemented but currently falls back to using $v0
- We still need VM_FETCH_OP after frame pop
- All tests pass with this approach

## Why It's Harder Than Expected

1. **Arguments Consumption**: The helper pops its arguments, changing the stack state
2. **Frame Structure**: The exact layout of saved registers affects positioning
3. **Stack.set() API**: Uses base + offset, not absolute positions

## Potential Solutions

### 1. Deep Stack Analysis

- Trace through exact stack states at each instruction
- Calculate precise position for return value
- Account for all stack manipulations

### 2. Modified Frame Pop

- Create a new VM_POP_FRAME_WITH_RETURN_OP
- This opcode would handle both frame pop and positioning return value

### 3. Stack Reservation

- Reserve space for return value before calling helper
- Helper writes to reserved spot
- Frame pop exposes the value

## Recommendation

For now, we should:

1. Keep VM_HELPER_FRAME_OP using $v0 + VM_FETCH_OP
2. Focus on other optimizations
3. Revisit frame-aware return as a separate deep-dive project

The stack-based arguments (Step 2) remain our primary achievement, enabling future optimizations even without frame-aware returns.
