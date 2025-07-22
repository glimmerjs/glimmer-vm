# Step 1: Add Arity Information

First step: Calculate and pass arity without changing any behavior.

## Implementation

### 1. Add calculateArityCounts helper

In `/packages/@glimmer/opcode-compiler/lib/opcode-builder/helpers/expr.ts`:

```typescript
function calculateArityCounts(args: WireFormat.Core.CallArgs): [positional: number, named: number] {
  const opcode = args[0];
  
  switch (opcode) {
    case EMPTY_ARGS_OPCODE:
      return [0, 0];
      
    case POSITIONAL_ARGS_OPCODE:
      return [args[1].length, 0];
      
    case NAMED_ARGS_OPCODE:
      const [names] = args[1];
      return [0, names.length];
      
    case POSITIONAL_AND_NAMED_ARGS_OPCODE:
      const positional = args[1].length;
      const [namedKeys] = args[2];
      return [positional, namedKeys.length];
      
    default:
      throw new Error(`Unknown args opcode: ${opcode}`);
  }
}
```

### 2. Update CallResolved to calculate arity

```typescript
case Op.CallResolved: {
  const [, callee, args] = expression;
  const handle = encode.resolveHelper(callee);
  
  // NEW: Calculate arity
  const [positionalCount, namedCount] = calculateArityCounts(args);
  
  // Log for verification during development
  if (import.meta.env.DEV) {
    console.log(`Helper ${callee}: ${positionalCount} positional, ${namedCount} named`);
  }
  
  // Everything else stays the same
  encode.op(VM_PUSH_FRAME_OP);
  callArgs(encode, args);
  encode.op(VM_HELPER_OP, handle);
  encode.op(VM_POP_FRAME_OP);
  encode.op(VM_FETCH_OP, $v0);
  return;
}
```

### 3. Test to verify arity calculation

Create a test to ensure we're calculating correctly:

```typescript
@test
'arity calculation for various helper patterns'() {
  // Positional only
  this.registerHelper('oneArg', ([arg]) => `got: ${arg}`);
  this.render('{{oneArg "hello"}}');
  // Should log: "Helper oneArg: 1 positional, 0 named"
  
  // Multiple positional
  this.registerHelper('twoArgs', ([a, b]) => `${a} and ${b}`);
  this.render('{{twoArgs "foo" "bar"}}');
  // Should log: "Helper twoArgs: 2 positional, 0 named"
  
  // Named only
  this.registerHelper('named', ([], hash) => hash.name);
  this.render('{{named name="value"}}');
  // Should log: "Helper named: 0 positional, 1 named"
  
  // Mixed
  this.registerHelper('mixed', ([pos], hash) => `${pos}: ${hash.opt}`);
  this.render('{{mixed "arg" opt="val"}}');
  // Should log: "Helper mixed: 1 positional, 1 named"
}
```

## Verification

Run the test suite with this change. Everything should still pass because we're only:

1. Calculating information
2. Logging it (in dev)
3. Not changing any behavior

## What We Learn

This step validates that:

1. We can identify argument patterns correctly
2. Our understanding of the wire format is correct
3. The system still works with our instrumentation

## Next Step Preview

Once we verify arity calculation works, Step 2 will:

1. Create a new opcode that expects args on stack
2. Use the arity information to know how many to pop
3. Still create the same Arguments object for compatibility

But first, let's ensure this step works correctly!
