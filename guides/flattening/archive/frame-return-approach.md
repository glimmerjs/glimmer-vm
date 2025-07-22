# Frame-Aware Return Value Approach

## The Insight

Instead of pushing the helper result after the frame is popped, we can write it to the correct stack position BEFORE popping the frame. This way, when the frame is popped, the return value is already in the right place.

## How It Works

### Current Approach (with $v0)
```
1. VM_PUSH_FRAME_OP      // stack: [..., $ra, $fp]
2. [push arguments]      // stack: [..., $ra, $fp, args...]
3. VM_HELPER_OP          // executes helper, stores result in $v0
4. VM_POP_FRAME_OP       // stack: [...] (frame removed)
5. VM_FETCH_OP $v0       // stack: [..., result]
```

### New Approach (frame-aware return)
```
1. VM_PUSH_FRAME_OP      // stack: [..., $ra, $fp], $fp points here - 1
2. [push arguments]      // stack: [..., $ra, $fp, args...]
3. VM_HELPER_FRAME_OP    // executes helper, writes result to position $fp - 2
4. VM_POP_FRAME_OP       // stack: [..., result] (frame removed, result exposed)
```

## Implementation

### New Opcode: VM_HELPER_FRAME_OP

```typescript
APPEND_OPCODES.add(VM_HELPER_FRAME_OP, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = check(vm.constants.getValue(handle), CheckHelper);
  let args = check(stack.pop(), CheckArguments);
  let value = helper(args.capture(), vm.getOwner(), vm.dynamicScope());

  if (_hasDestroyableChildren(value)) {
    vm.associateDestroyable(value);
  }

  // Write result to the position that will be top-of-stack after frame pop
  // $fp points to saved $fp value, $fp - 1 has saved $ra, so $fp - 2 is where we write
  const returnPosition = vm.registers[$fp] - 2;
  stack.set(value, 0, returnPosition);
});
```

## Benefits

1. **No VM_FETCH_OP needed** - Result is already on stack after frame pop
2. **Works with existing frame system** - No need to remove frames
3. **Natural stack flow** - Follows traditional calling convention
4. **One less instruction** - More efficient

## Considerations

1. **Stack safety** - Need to ensure the position is valid
2. **All helpers must use same convention** - Can't mix approaches
3. **Debugging** - Stack will look different during helper execution

## Migration Path

1. Create VM_HELPER_FRAME_OP opcode
2. Update CallResolved to use it
3. Test thoroughly
4. Update all other helper call sites
5. Eventually deprecate VM_HELPER_OP + VM_FETCH_OP pattern

This approach elegantly solves the problem while working within the existing frame system!