# Step 2 Complete: Stack-Based Argument Passing

## What We Accomplished

Successfully implemented stack-based argument passing for all helper calls, maintaining full compatibility with the existing system.

### Implementation Details

1. **Added `VM_CONSTRUCT_ARGS_OP` (opcode 114)**
   - Reconstructs `Arguments` object from stack values
   - Handles both positional and named arguments
   - Named arguments are pushed as [name, value] pairs where names are primitives

2. **Created `compileArgsForStack` function**
   - Replaces `callArgs` for pushing arguments to stack
   - Pushes positional arguments directly
   - Pushes named arguments as alternating name/value pairs
   - Names are pushed using `VM_PRIMITIVE_OP`

3. **Updated `CallResolved` and `CallDynamicValue`**
   - Both now use the stack-based approach
   - Calculate arity using `calculateArityCounts`
   - Pass positional and named counts to `VM_CONSTRUCT_ARGS_OP`

### Key Code Changes

```typescript
// In expr.ts - compileArgsForStack
case POSITIONAL_AND_NAMED_ARGS_OPCODE: {
  // Push positional args
  for (const arg of pos) {
    expr(encode, arg);
  }
  
  // Push name/value pairs
  for (let i = 0; i < namedKeys.length; i++) {
    encode.op(VM_PRIMITIVE_OP, encode.constant(namedKeys[i]));
    expr(encode, namedValues[i]);
  }
  break;
}

// In expressions.ts - VM_CONSTRUCT_ARGS_OP
APPEND_OPCODES.add(VM_CONSTRUCT_ARGS_OP, (vm, { op1: positionalCount, op2: namedCount }) => {
  const stack = vm.stack;
  const totalCount = positionalCount + (namedCount * 2);
  const values: unknown[] = [];
  
  // Pop all values
  for (let i = 0; i < totalCount; i++) {
    values.unshift(stack.pop());
  }
  
  // Push positional args back
  for (let i = 0; i < positionalCount; i++) {
    stack.push(values[i]);
  }
  
  // Extract names and push values
  const namedKeys: string[] = [];
  for (let i = 0; i < namedCount; i++) {
    const nameIndex = positionalCount + (i * 2);
    const valueIndex = nameIndex + 1;
    namedKeys.push(String(values[nameIndex]));  // Names are primitives
    stack.push(values[valueIndex]);
  }
  
  vm.args.setup(stack, namedKeys, [], positionalCount, false);
  stack.push(vm.args);
});
```

## Test Results

✅ All 2043 tests passing!

Including:
- All helper tests
- Nested helper calls (the key test case)
- Hash helper tests
- Array helper tests  
- Component invocation tests
- Strict mode tests

## Key Insights

1. **Named argument keys must be primitives**: The original issue was trying to treat them as references
2. **Stack layout matters**: [positional args, name1, value1, name2, value2, ...]
3. **Compatibility preserved**: Still creates `Arguments` objects that existing code expects

## Next Steps

Now that arguments are stack-based, we can proceed to:
- Step 3: Create `VM_PUSH_HELPER_OP` that pushes results directly to stack
- Step 4: Update all helper calls to use new opcode
- Step 5: Remove frames from helper calls
- Step 6: Verify everything works together
- Step 7: Apply same approach to other expression types