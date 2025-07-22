# Step 3 Plan: VM_PUSH_HELPER_OP Implementation

## Goal

Create a new helper opcode that pushes results directly to the stack instead of using the $v0 register. This eliminates the need for VM_FETCH_OP and moves us closer to a pure stack machine.

## Current Flow (with $v0)

```text
1. Push arguments to stack
2. VM_CONSTRUCT_ARGS_OP creates Arguments object
3. VM_HELPER_OP executes helper, stores result in $v0
4. VM_FETCH_OP pushes $v0 value to stack
```

## New Flow (stack-based)

```text
1. Push arguments to stack
2. VM_CONSTRUCT_ARGS_OP creates Arguments object
3. VM_PUSH_HELPER_OP executes helper, pushes result directly to stack
```

## Implementation Steps

### 1. Add VM_PUSH_HELPER_OP constant

Since vm-opcodes.d.ts is generated, we have two options:

- Option A: Run the build/debug.js script to regenerate the file with the new opcode
- Option B: Temporarily work around the type issue and fix it properly later

For now, we'll go with Option B:

- Add to `@glimmer/constants` syscall-ops.ts as opcode 115
- Use a type assertion to work around the missing type temporarily

FEEDBACK: I think we should go with Option A and regenerate the file properly. It will help maintain type safety and consistency across the codebase.

### 2. Implement VM_PUSH_HELPER_OP handler

Based on current VM_HELPER_OP:

```typescript
APPEND_OPCODES.add(VM_PUSH_HELPER_OP, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = check(vm.constants.getValue(handle), CheckHelper);
  let args = check(stack.pop(), CheckArguments);
  let value = helper(args.capture(), vm.getOwner(), vm.dynamicScope());

  if (_hasDestroyableChildren(value)) {
    vm.associateDestroyable(value);
  }

  // KEY DIFFERENCE: Push to stack instead of storing in $v0
  stack.push(value);
});
```

### 3. Update CallResolved

Change from:

```typescript
encode.op(VM_HELPER_OP, handle);
encode.op(VM_POP_FRAME_OP);
encode.op(VM_FETCH_OP, $v0);
```

To:

```typescript
encode.op(VM_PUSH_HELPER_OP, handle);
encode.op(VM_POP_FRAME_OP);
// No VM_FETCH_OP needed!
```

### 4. Handle CallDynamicValue

VM_DYNAMIC_HELPER_OP also uses $v0. We need to consider:

- Should we create VM_PUSH_DYNAMIC_HELPER_OP too?
- Or modify the existing opcode to push to stack?
- For now, keep it using $v0 and VM_FETCH_OP

## Testing Strategy

1. Run existing helper tests to ensure compatibility
2. Verify nested helper calls still work
3. Check that the stack remains balanced

## Benefits

- Eliminates VM_FETCH_OP for helper calls
- More efficient instruction sequence
- Moves us closer to removing $v0 register entirely
- Natural data flow through stack

## Risks

- Need to ensure stack ordering is preserved
- Must maintain compatibility with existing code
- Dynamic helpers need separate consideration

## Alternative Approach: Modify VM_HELPER_OP

Instead of creating a new opcode, we could modify the existing VM_HELPER_OP to push to stack:

- Pros: No new opcode needed, simpler migration
- Cons: Would break existing code that expects $v0
- Decision: Create new opcode for gradual migration
