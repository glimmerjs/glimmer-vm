# Proper Incremental Approach to Stack-Based Helpers

A careful step-by-step transformation that maintains correctness throughout.

## Step 1: Add Arity to Wire Format ✅ COMPLETE

Modify the wire format to include arity information:

```typescript
// Current wire format
[Op.CallResolved, callee, args]

// New wire format  
[Op.CallResolved, callee, args, positionalCount, namedCount]
```

In the compiler:
```typescript
case Op.CallResolved: {
  const [, callee, args] = expression;
  const handle = encode.resolveHelper(callee);
  const [positionalCount, namedCount] = calculateArityCounts(args);
  
  // Still generate same opcodes for now
  encode.op(VM_PUSH_FRAME_OP);
  callArgs(encode, args);
  encode.op(VM_HELPER_OP, handle);
  encode.op(VM_POP_FRAME_OP);
  encode.op(VM_FETCH_OP, $v0);
  return;
}
```

## Step 2: Arguments on Stack with Convention ✅ COMPLETE

Named arguments take two stack slots: [name, value]

Stack layout for `{{helper "foo" bar="baz"}}`:
```
[... "foo" "bar" "baz"]
     ^pos  ^name ^value
```

**Implementation notes:**
- Created `compileArgsForStack` to push arguments to stack
- Named argument keys are pushed as primitives using `VM_PRIMITIVE_OP`
- Created `VM_CONSTRUCT_ARGS_OP` that reconstructs Arguments from stack
- Updated both `CallResolved` and `CallDynamicValue`
- All tests passing!

## Step 3: VM_PUSH_HELPER_OP (Attempted, Postponed)

We attempted to create VM_PUSH_HELPER_OP that pushes helper results directly to stack.

**Result**: Tests failed because updating only CallResolved creates inconsistencies.
**Learning**: All helper uses must be updated together.
**Decision**: Postpone this optimization and proceed to Step 4.

```typescript
function callArgsWithStackConvention(
  encode: EncodeOp, 
  positionalCount: number,
  namedCount: number
) {
  // New opcode that knows how to construct Arguments from stack
  encode.op(VM_CONSTRUCT_ARGS_OP, positionalCount, namedCount);
}
```

Implementation:
```typescript
APPEND_OPCODES.add(VM_CONSTRUCT_ARGS_OP, (vm, { op1: posCount, op2: namedCount }) => {
  const stack = vm.stack;
  
  // Pop named args (in reverse order)
  const named: Dict<unknown> = dict();
  for (let i = 0; i < namedCount; i++) {
    const value = stack.pop();
    const name = check(stack.pop(), CheckString);
    named[name] = value;
  }
  
  // Pop positional args (in reverse order)
  const positional: unknown[] = [];
  for (let i = 0; i < posCount; i++) {
    positional.unshift(stack.pop());
  }
  
  // Create Arguments object and push it
  const args = createArguments(positional, named);
  stack.push(args);
});
```

## Step 4: Remove Frames from Helper Calls

Now that arguments are stack-based, we can remove frame management:

```typescript
case Op.CallResolved: {
  const [, callee, args] = expression;
  const handle = encode.resolveHelper(callee);
  const [positionalCount, namedCount] = calculateArityCounts(args);
  
  // No more VM_PUSH_FRAME_OP!
  compileArgsForStack(encode, args);
  encode.op(VM_CONSTRUCT_ARGS_OP, positionalCount, namedCount);
  encode.op(VM_HELPER_OP, handle);
  // No more VM_POP_FRAME_OP!
  encode.op(VM_FETCH_OP, $v0);
  return;
}
```

## Step 5: Future - VM_PUSH_HELPER_OP

Once everything works without frames, we can consider creating VM_PUSH_HELPER_OP that pushes directly to stack. This requires updating ALL helper uses at once:

```typescript
case Op.CallResolved: {
  const [, callee, args] = expression;
  const handle = encode.resolveHelper(callee);
  const [positionalCount, namedCount] = calculateArityCounts(args);
  
  // No more frames!
  callArgs(encode, args);
  encode.op(VM_PUSH_HELPER_OP, handle);
  return;
}
```

## Step 6: Verify

Test with nested helpers:
```typescript
{{join (uppercase "hello") (lowercase "WORLD")}}
```

Should produce:
1. Push "hello"
2. Construct args (1, 0)
3. Call uppercase (pops args, pushes "HELLO")
4. Push "WORLD"
5. Construct args (1, 0)
6. Call lowercase (pops args, pushes "world")
7. Construct args (2, 0)
8. Call join (pops args, pushes "HELLOworld")

## Step 7: Repeat for Other Calls

Apply same pattern to:
- `CallDynamicValue`
- `CallDynamic`
- `Curry` operations
- Component invocations (if applicable)

## Why This Works

1. **No behavior change initially** - Just adding information
2. **Each step is testable** - Can verify correctness at each stage
3. **Gradual migration** - Old and new opcodes can coexist
4. **Clean transition** - Once all uses migrate, rename opcodes
5. **Stack discipline** - Arguments flow naturally through stack

## Migration Strategy

1. Add new opcodes alongside old ones
2. Migrate one expression type at a time
3. Run full test suite after each migration
4. Only remove old opcodes when no longer used
5. Rename new opcodes to standard names