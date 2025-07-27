# Step 2: Stack Convention for Arguments

## Goal

Transform how arguments are passed to helpers from the current frame-based system to a stack-based convention.

## Current System

Currently, helper arguments work like this:

1. `VM_PUSH_FRAME_OP` - Creates new frame
2. `callArgs` evaluates expressions and uses `VM_PUSH_ARGS_OP` to create an Arguments object
3. Arguments object is pushed onto stack
4. `VM_HELPER_OP` pops the Arguments object and calls helper
5. Helper result goes to $v0
6. `VM_POP_FRAME_OP` - Restores frame (resets stack pointer!)
7. `VM_FETCH_OP` - Moves $v0 to stack

## Proposed Stack Convention

For `{{join (uppercase "hello") (lowercase "WORLD")}}`:

### Step-by-step execution

1. **Evaluate "hello"** → push to stack: `["hello"]`
2. **Construct args for uppercase** → `[Arguments{positional:["hello"]}]`
3. **Call uppercase** → pops Arguments, pushes result: `["HELLO"]`
4. **Evaluate "WORLD"** → push to stack: `["HELLO", "WORLD"]`
5. **Construct args for lowercase** → `["HELLO", Arguments{positional:["WORLD"]}]`
6. **Call lowercase** → pops Arguments, pushes result: `["HELLO", "world"]`
7. **Construct args for join** → `[Arguments{positional:["HELLO", "world"]}]`
8. **Call join** → pops Arguments, pushes result: `["HELLOworld"]`

### For named arguments

For `{{helper "pos" foo="bar" baz="qux"}}`:

Stack before construction:

```text
[... "pos" "foo" "bar" "baz" "qux"]
     ^pos  ^name ^val  ^name ^val
```

The construction opcode knows:

- 1 positional argument
- 2 named arguments

## Implementation Plan

### 1. Create VM_CONSTRUCT_ARGS_OP

This opcode will:

- Take positional count and named count as operands
- Pop values from stack in reverse order
- Create Arguments object
- Push Arguments back onto stack

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
  
  // Create Arguments object compatible with existing system
  const args = VMArguments.create(positional, named);
  stack.push(args);
});
```

### 2. Create callArgsForStackMachine

A new function that expects arguments already on the stack:

```typescript
function callArgsForStackMachine(
  encode: EncodeOp,
  args: WireFormat.Core.CallArgs,
  positionalCount: number,
  namedCount: number
) {
  // Arguments are already on stack from expression evaluation
  // Just need to construct the Arguments object
  encode.op(VM_CONSTRUCT_ARGS_OP, positionalCount, namedCount);
}
```

### 3. Modify expr compilation

Update `expr` to push arguments to stack:

```typescript
function compilePositionalForStack(encode: EncodeOp, params: WireFormat.Core.Params) {
  for (const param of params) {
    expr(encode, param);  // Each expression pushes its result
  }
}

function compileNamedForStack(encode: EncodeOp, hash: WireFormat.Core.Hash) {
  const [names, values] = hash;
  for (let i = 0; i < names.length; i++) {
    encode.op(VM_PRIMITIVE_OP, encode.string(names[i]));  // Push name
    expr(encode, values[i]);  // Push value
  }
}
```

### 4. Update CallResolved

```typescript
case Op.CallResolved: {
  const [, callee, args] = expression;
  const handle = encode.resolveHelper(callee);
  const [positionalCount, namedCount] = calculateArityCounts(args);
  
  // Still using frames for now (remove in Step 5)
  encode.op(VM_PUSH_FRAME_OP);
  
  // New: args go on stack instead of using callArgs
  compileArgsForStack(encode, args);
  encode.op(VM_CONSTRUCT_ARGS_OP, positionalCount, namedCount);
  
  encode.op(VM_HELPER_OP, handle);
  encode.op(VM_POP_FRAME_OP);
  encode.op(VM_FETCH_OP, $v0);
  return;
}
```

## Key Decisions

1. **Keep Arguments object for now** - Helpers still expect it, so we construct it differently but maintain the interface

2. **Named args convention** - Push as [name, value] pairs to maintain order and simplify construction

3. **No frames yet** - Still using frames in this step, will remove in Step 5

4. **Complete migration in this PR** - Replace old implementation entirely

## Testing Strategy

1. **Unit test VM_CONSTRUCT_ARGS_OP** - Verify it correctly builds Arguments from stack

2. **Test simple helpers** - Start with positional-only helpers like `uppercase`

3. **Test named arguments** - Ensure `foo="bar"` style args work correctly

4. **Test mixed arguments** - Both positional and named together

5. **Verify stack state** - After each helper call, stack should contain just the result

## Success Criteria

- All existing tests pass
- Arguments object created from stack matches one from old system
- Stack depth is correct after helper calls

## Notes from Discussion

1. **No feature flag** - Just implement the new approach directly
2. **Helpers don't have blocks** - Things with blocks are keywords or components, not helpers
3. **No splat args currently** - Helpers don't support ...args, though it would be nice. This approach wouldn't make it harder to add later since we already construct an Arguments object.

Ready to implement VM_CONSTRUCT_ARGS_OP as the first concrete step!
