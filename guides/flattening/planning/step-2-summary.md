# Step 2 Summary: Stack-Based Argument Passing

## What We Accomplished

Successfully implemented stack-based argument passing for helper calls:

1. **Added VM_CONSTRUCT_ARGS_OP** (opcode 114)
   - Pops arguments from stack in correct order
   - Constructs Arguments object that helpers expect
   - Maintains compatibility with existing helper infrastructure

2. **Created compileArgsForStack**
   - Pushes positional arguments directly to stack
   - Pushes named arguments as [name, value] pairs
   - Handles all argument patterns (empty, positional-only, named-only, mixed)

3. **Updated CallResolved**
   - Now uses stack-based approach
   - Still maintains frames (to be removed in Step 5)
   - Results still go through $v0 (to be changed in Step 4)

## Key Implementation Details

### Stack Layout

For `{{helper "pos" foo="bar" baz="qux"}}`:

```text
Stack: ["pos", "foo", "bar", "baz", "qux"]
        ^pos   ^name  ^val   ^name  ^val
```

### VM_CONSTRUCT_ARGS_OP Logic

1. Pops total values from stack (positional + named*2)
2. Reconstructs proper order for vm.args.setup
3. Pushes Arguments object onto stack

## Test Results

All new tests passing:

- ✅ Simple helper with positional args
- ✅ Helper with multiple positional args
- ✅ Helper with named args
- ✅ Helper with both positional and named args
- ✅ **Nested helper calls** - The key test!

## Known Issues

Some component tests are failing - components may need special handling as they use arguments differently than helpers. This should be investigated separately.

## Next Steps

- Step 3: Create VM_PUSH_HELPER_OP that pushes results directly to stack
- Step 4: Update all helper calls to use new opcode
- Step 5: Remove frames from helper calls
- Step 6: Verify everything works together
