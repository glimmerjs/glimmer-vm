# Current Helper Call Design in Glimmer VM

This document analyzes how helper calls currently work in Glimmer VM, focusing on the mechanics of frames, $v0, and the instruction sequence.

## High-Level Flow

For a helper call like `{{uppercase "hello"}}`:

1. **Compilation**: Template → Wire Format → VM Instructions
2. **Execution**: Push frame → Push args → Call helper → Pop frame → Fetch result

## Detailed Instruction Sequence

Looking at `CallResolved` in `/packages/@glimmer/opcode-compiler/lib/opcode-builder/helpers/expr.ts:59-68`:

```typescript
case Op.CallResolved: {
  const [, callee, args] = expression;
  const handle = encode.resolveHelper(callee);
  encode.op(VM_PUSH_FRAME_OP);    // 1. Push frame
  callArgs(encode, args);          // 2. Push arguments
  encode.op(VM_HELPER_OP, handle); // 3. Call helper
  encode.op(VM_POP_FRAME_OP);      // 4. Pop frame
  encode.op(VM_FETCH_OP, $v0);     // 5. Fetch result from $v0 to stack
  return;
}
```

## Frame Management

From `/packages/@glimmer/runtime/lib/vm/low-level.ts`:

### Push Frame (lines 83-87)

```typescript
pushFrame() {
  this.stack.push(this.registers[$ra]);  // Save return address
  this.stack.push(this.registers[$fp]);  // Save frame pointer
  this.registers[$fp] = this.registers[$sp] - 1;  // New frame pointer
}
```

### Pop Frame (lines 90-94)

```typescript
popFrame() {
  this.registers[$sp] = this.registers[$fp] - 1;  // Reset stack pointer
  this.registers[$ra] = this.stack.get(0);        // Restore return address
  this.registers[$fp] = this.stack.get(1);        // Restore frame pointer
}
```

## Helper Execution

From `/packages/@glimmer/runtime/lib/compiled/opcodes/expressions.ts`:

```typescript
APPEND_OPCODES.add(VM_HELPER_OP, (vm, { op1: handle }) => {
  let stack = vm.stack;
  let helper = check(vm.constants.getValue(handle), CheckHelper);
  let args = check(stack.pop(), CheckArguments);
  let value = helper(args.capture(), vm.getOwner(), vm.dynamicScope());
  
  if (_hasDestroyableChildren(value)) {
    vm.associateDestroyable(value);
  }
  
  vm.loadValue($v0, value);  // Result goes to $v0, not stack!
});
```

## The $v0 Register

- **Purpose**: Temporary storage for helper return values
- **Usage**: Helper puts result in $v0, then VM_FETCH_OP moves it to stack
- **Location**: One of the VM's registers (alongside $pc, $sp, $fp, $ra)

## Why This Design?

### Frames

- **Isolate arguments**: Each helper call gets its own argument space
- **Save state**: Preserves stack/frame pointers for nested calls
- **Consistent with other calls**: Matches component invocation patterns

### $v0 Register

- **Calling convention**: Separates return values from arguments
- **Compatibility**: Matches traditional calling conventions (like MIPS)
- **Flexibility**: Allows helpers to return without knowing stack layout

## Problems for Expression Flattening

1. **Indirect data flow**: Results go through $v0 instead of directly to stack
2. **Frame overhead**: Each helper call saves/restores frame state
3. **Stack pointer manipulation**: `popFrame()` resets $sp, potentially losing data
4. **Complex state management**: Must track frames, registers, and stack

## Current Nested Call Issue

For `{{join (uppercase "hello") (lowercase "WORLD")}}`:

1. `uppercase` executes, puts "HELLO" in $v0
2. Frame pops, but we haven't fetched from $v0 yet
3. `lowercase` executes, overwrites $v0 with "world"
4. When we finally fetch, we get wrong values

The timing of frame pops vs fetches is critical and currently broken for nested expressions.

## Questions to Explore

1. Do helpers really need frames, or just arguments?
2. Could helpers push directly to stack instead of using $v0?
3. What other parts of the system depend on this calling convention?
4. How do component invocations differ from helper calls?
