# Step 3: Frame-Aware Return Value Optimization

## Goal

Eliminate the `VM_FETCH_OP` instruction after helper calls by having helper return values naturally positioned on the stack when the frame is popped. This optimization reduces the number of opcodes executed for every helper call.

## Key Insight

By pushing a reserved slot onto the stack *before* pushing the frame, and having helpers write their return value to that slot, the normal frame pop operation will naturally leave the return value at the top of the stack.

## How It Works

### The Stack Layout

Understanding the stack layout is crucial. Here's what happens step by step:

```text
1. Initial state:
   [...existing stack...]
   $sp points to top of stack

2. VM_PUSH_FRAME_WITH_RESERVED_OP executes:
   [...existing stack...]
   [reserved_slot]        <- Push null placeholder
   [$ra]                  <- Push saved return address  
   [$fp]                  <- Push saved frame pointer
   $fp = $sp - 1          <- $fp now points to the $ra position

3. Arguments are pushed and helper executes:
   [...existing stack...]
   [reserved_slot]        <- Helper writes return value here ($fp - 1)
   [$ra]                  <- Saved return address ($fp points here)
   [$fp]                  <- Saved frame pointer
   
4. VM_POP_FRAME_OP executes:
   $sp = $fp - 1          <- This points to the $ra position
   [...existing stack...]
   [return_value]         <- But wait! That's our reserved slot!
```

**The Magic:** The standard `popFrame()` sets `$sp = $fp - 1`. Since we pushed an extra slot before the frame, this naturally points to our reserved slot containing the return value!

### Why This Works for Nested Helpers

The beauty of this approach is that it works naturally with nested helpers. Each helper call gets its own frame with its own reserved slot:

```text
For {{join (uppercase "hello") (lowercase "WORLD")}}:

1. Evaluate (uppercase "hello"):
   - Push reserved slot, push frame
   - Execute helper, writes "HELLO" to its reserved slot
   - Pop frame → "HELLO" is now on stack

2. Evaluate (lowercase "WORLD"):  
   - Push reserved slot, push frame
   - Execute helper, writes "world" to its reserved slot
   - Pop frame → "world" is now on stack
   
3. Stack now has ["HELLO", "world"] ready for join
```

Each frame's `$fp` points to its own saved return address, so `$fp - 1` always points to that frame's reserved slot.

## Implementation Plan

### New Opcodes Required

1. **VM_PUSH_FRAME_WITH_RESERVED_OP** (opcode 7)
   - Pushes a null placeholder onto the stack
   - Then performs normal frame push
   - Result: reserved slot is always at `$fp - 1`

2. **VM_HELPER_WITH_RESERVED_OP** (opcode 118)
   - Executes helper like normal
   - Writes return value to `$fp - 1` instead of `$v0`
   - No need to track position with a register

**Key Point:** We use the regular `VM_POP_FRAME_OP` - no special pop needed!

### Compiler Changes

#### Update CallResolved (`packages/@glimmer/opcode-compiler/lib/opcode-builder/helpers/expr.ts`)

In the `expr()` function, find the `Op.CallResolved` case and update it:

```typescript
// Before optimization:
case Op.CallResolved: {
  const [, callee, args] = expression;
  const handle = encode.resolveHelper(callee);
  
  encode.op(VM_PUSH_FRAME_OP);
  callArgs(encode, args, 0b000);
  encode.op(VM_HELPER_OP, handle);
  encode.op(VM_POP_FRAME_OP);
  encode.op(VM_FETCH_OP, $v0);  // <-- We eliminate this!
  return;
}

// After optimization:
case Op.CallResolved: {
  const [, callee, args] = expression;
  const handle = encode.resolveHelper(callee);
  
  encode.op(VM_PUSH_FRAME_WITH_RESERVED_OP);
  callArgs(encode, args, 0b000);
  encode.op(VM_HELPER_WITH_RESERVED_OP, handle);
  encode.op(VM_POP_FRAME_OP);
  // Return value is already on stack - no fetch needed!
  return;
}
```

Also add these imports at the top of the file:

```typescript
import {
  // ... existing imports ...
  VM_PUSH_FRAME_WITH_RESERVED_OP,
  VM_HELPER_WITH_RESERVED_OP,
} from '@glimmer/constants';
```

### Runtime Implementation

#### 1. Add methods to LowLevelVM (`packages/@glimmer/runtime/lib/vm/low-level.ts`)

Add these methods after the existing `pushFrame()` method (line 94):

```typescript
pushFrameWithReserved() {
  this.stack.push(null);  // Reserve slot
  this.pushFrame();       // Use existing frame push logic
}

setReturnValue(value: unknown) {
  this.stack.set(value, -1, this.registers[$fp]);
}
```

Also update the import to include `VM_PUSH_FRAME_WITH_RESERVED_OP` from `@glimmer/constants`.

#### 2. Add VM_PUSH_FRAME_WITH_RESERVED_OP handler (`packages/@glimmer/runtime/lib/compiled/opcodes/vm.ts`)

Add this after line 133:

```typescript
APPEND_OPCODES.add(VM_PUSH_FRAME_WITH_RESERVED_OP, (vm) => {
  vm.lowlevel.pushFrameWithReserved();
});
```

Also add `VM_PUSH_FRAME_WITH_RESERVED_OP` to the imports from `@glimmer/constants`.

#### 3. Add VM_HELPER_WITH_RESERVED_OP handler (`packages/@glimmer/runtime/lib/compiled/opcodes/expressions.ts`)

Add this after the `VM_HELPER_OP` handler (after line 193):

```typescript
APPEND_OPCODES.add(VM_HELPER_WITH_RESERVED_OP, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = check(vm.constants.getValue(handle), CheckHelper);
  let args = check(stack.pop(), CheckArguments);
  let value = helper(args.capture(), vm.getOwner(), vm.dynamicScope());
  
  if (_hasDestroyableChildren(value)) {
    vm.associateDestroyable(value);
  }
  
  vm.lowlevel.setReturnValue(value);
});
```

Note: `VM_HELPER_WITH_RESERVED_OP` is already imported in this file.

## Why This Design Works

### The Frame Pointer Math

The key to understanding this optimization is the frame pointer math:

- `$fp` points to where we saved `$ra` (because `$fp = $sp - 1` after pushing both)
- `$fp - 1` points to our reserved slot

When `popFrame()` sets `$sp = $fp - 1`, it's restoring the stack pointer. Since `$fp` points to the `$ra` position, `$fp - 1` points to our reserved slot - exactly where we want the return value to be!

### No Extra Registers Needed

We don't need a `$ret` register because:

- Each frame has its own `$fp`
- The reserved slot is always at `$fp - 1` relative to that frame
- Nested helpers work naturally - each has its own frame and reserved slot

## Benefits

1. **Performance**: Eliminates one opcode (`VM_FETCH_OP`) per helper call
2. **Simplicity**: Leverages existing frame mechanics rather than adding complexity
3. **Compatibility**: Works with existing helper infrastructure
4. **Scalability**: Naturally handles nested helpers without special cases

## Testing Approach

### Key Test Cases

1. **Simple helper**: `{{uppercase "hello"}}` → "HELLO"
2. **Nested helpers**: `{{join (uppercase "hello") (lowercase "WORLD")}}` → "HELLOworld"  
3. **Deep nesting**: Multiple levels of helper composition
4. **Edge cases**: Empty args, null returns, exceptions

### Success Criteria

- All 2043+ existing tests pass
- Stack remains balanced after operations
- Performance improvement measurable in benchmarks

## Implementation Checklist

- [ ] Add `pushFrameWithReserved()` method to `LowLevelVM` in `low-level.ts`
- [ ] Add `setReturnValue()` method to `LowLevelVM` in `low-level.ts`
- [ ] Update imports in `vm.ts` to include `VM_PUSH_FRAME_WITH_RESERVED_OP`
- [ ] Add handler for `VM_PUSH_FRAME_WITH_RESERVED_OP` in `vm.ts`
- [ ] Add handler for `VM_HELPER_WITH_RESERVED_OP` in `expressions.ts`
- [ ] Update imports in `expr.ts` to include both new opcodes
- [ ] Update `Op.CallResolved` case to use new opcodes
- [ ] Run tests to verify all 2043+ tests pass

## Summary

This optimization eliminates the `VM_FETCH_OP` instruction after helper calls by:

1. Reserving a stack slot before pushing the frame
2. Having helpers write their return value to that slot (`$fp - 1`)
3. Leveraging the fact that normal frame pop naturally leaves this slot at the top of stack

The elegance lies in working *with* the existing stack mechanics rather than against them. No special registers, no complex tracking - just one extra push before the frame and the math works out perfectly.
