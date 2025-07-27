# Flattening Simple Expressions: Implementation Guide

## Overview

This document tracks the implementation of expression flattening in the Glimmer VM wire format. The goal is to eliminate all recursive `expr()` calls in the opcode compiler by pre-evaluating nested expressions in the wire format compiler, creating a linear sequence of stack operations.

## Project Status: Complete! 🎉

### Completed Operations ✅ (8 of 8)

1. **Op.Not** - The pioneer that established the flattening pattern
2. **Op.HasBlock** - Simple unary operation checking block presence
3. **Op.HasBlockParams** - Unary operation that emits multiple VM opcodes
4. **Op.GetDynamicVar** - Simple unary operation for dynamic variable access
5. **Op.IfInline** - Ternary operation with reversed stack ordering
6. **Op.Concat** - Multi-arg operation with dynamic arity for string concatenation
7. **Op.Log** - Multi-arg operation with updating opcode for re-renders
8. **Op.Curry** - Complex operation that reuses dynamic helper frame pattern

## Key Implementation Pattern

The flattening process follows a consistent pattern across all operations:

### 1. Wire Format Compiler Changes

**Location**: `packages/@glimmer/compiler/lib/passes/2-encoding/expressions.ts`

Transform nested expressions into linear stack operations:

```typescript
// Before: Nested structure
[Op.StackExpression, [Op.Not, encodeExpr(value)]]

// After: Flattened sequence
[Op.StackExpression, ...flatten(value), Op.Not]
```

### 2. Opcode Compiler Changes  

**Location**: `packages/@glimmer/opcode-compiler/lib/opcode-builder/helpers/expr.ts`

Remove recursive calls and handle opcodes as stack operations:

- In `expr()`: Add number case for simple opcodes
- In `compileStackExpression()`: Handle both array and number opcodes
- Critical: Use `continue` (not `break`) after processing number opcodes

### 3. Type System Updates

**Location**: `packages/@glimmer/interfaces/lib/compile/wire-format/api.ts`

- Add flattened opcodes to `SimpleStackOp` type
- Update operation signatures (e.g., Concat now takes arity instead of array)

## Major Learnings from Implementation

### 1. The "Continue" Bug Discovery

During IfInline implementation, we discovered a critical bug: using `break` instead of `continue` in `compileStackExpression` when handling number opcodes caused early exit from the function. This bug went unnoticed until "unless" tests failed, teaching us the importance of thorough testing with all variants.

### 2. Debug Formatter Complexity

The Concat implementation revealed that the debug formatter needed sophisticated updates:

- Must parse helper call patterns (BeginCall → args → PushArgs → CallHelper)
- Must format operations in human-readable form, not raw opcodes
- Test framework expects specific formats like `[BUILDER_LITERAL, "text"]` not `["literal", "text"]`

### 3. Type System Challenges

Adding `SimpleStackOp` to the expression types created cascading type issues:

- Type guards using `isTupleExpression` didn't properly narrow types
- Had to switch to direct `Array.isArray()` checks for proper type narrowing
- Many "unnecessary" type assertions were actually necessary due to TypeScript limitations

### 4. Stack Ordering Insights

Different operations have different stack ordering requirements:

- **IfInline**: Requires falsy, truthy, condition (reverse of source order)
- **Concat**: Parts pushed in order, followed by arity
- **Log**: Arguments pushed in order, followed by arity
- This highlights the importance of understanding runtime expectations

### 5. Test Framework vs. Real Compiler

The test framework uses a different symbol allocation strategy than the real compiler:

- Helper symbols start at different indices
- This caused initial confusion when tests failed with symbol mismatches
- Ultimately required updating the debug formatter to handle the actual wire format

### 6. Op.Undefined Handling Pitfall

A critical issue discovered during cleanup: `Op.Undefined` (value 27) was being misused:

- **Wrong**: `[Op.PushConstant, Op.Undefined]` - pushes the number 27 as a constant
- **Right**: `Op.Undefined` as a standalone opcode in StackExpression
- **Right**: `[Op.Undefined]` for operations expecting that format (e.g., AppendStatic)

This highlighted that opcode numbers should never be used as values.

## Detailed Implementation Examples

### Example 1: Op.Concat Implementation

The Concat flattening demonstrates the complete pattern:

```typescript
// Wire format compiler change
function InterpolateExpression({
  parts,
}: mir.InterpolateExpression): WireFormat.Expressions.StackExpression {
  const operations: WireFormat.Expressions.StackOperation[] = [];
  const partsArray = parts.toArray();
  
  // Flatten all parts first
  for (const part of partsArray) {
    const encoded = encodeInterpolatePart(part);
    operations.push(...flattenExpression(encoded));
  }
  
  // Then emit concat with arity
  operations.push([Op.Concat, partsArray.length]);
  
  return [Op.StackExpression, ...operations];
}
```

### Example 2: Op.Log Implementation with Updating Opcode

The Log implementation introduced a new challenge - handling re-renders:

```typescript
// Wire format compiler
function Log({ positional }: mir.Log): WireFormat.Expressions.StackExpression {
  const operations: WireFormat.Expressions.StackOperation[] = [];
  const args = positional.list.toArray();
  
  // Flatten all arguments first
  for (const arg of args) {
    const encoded = encodeExpr(view.get(arg));
    operations.push(...flattenExpression(encoded));
  }
  
  // Then emit Log with arity
  operations.push([Op.Log, args.length]);
  
  return [Op.StackExpression, ...operations];
}

// VM implementation with updating opcode
class LogOpcode implements UpdatingOpcode {
  constructor(private refs: Reference[]) {
    this.evaluate(); // Log immediately
  }

  evaluate(): void {
    const values = this.refs.map(ref => valueForRef(ref));
    console.log(...values);
  }
}

APPEND_OPCODES.add(VM_LOG_OP, (vm, { op1: arity }) => {
  const refs: Reference[] = [];
  for (let i = 0; i < arity; i++) {
    refs.unshift(check(vm.stack.pop(), CheckReference));
  }
  
  // Create updating opcode if any refs are non-const
  const hasNonConstRefs = refs.some(ref => !isConstRef(ref));
  if (hasNonConstRefs) {
    vm.updateWith(new LogOpcode(refs));
  } else {
    const values = refs.map(ref => valueForRef(ref));
    console.log(...values);
  }
  
  vm.stack.push(UNDEFINED_REFERENCE);
});
```

Key learning: Operations with side effects that need to re-execute on updates require creating an UpdatingOpcode, not just a compute ref.

### Example 3: Debug Formatter Pattern Recognition

The debug formatter must recognize complex patterns:

```typescript
// Helper call pattern in concat: BeginCall → args → PushArgs → CallHelper
case Op.BeginCall: {
  const helperOps: WireFormat.Expressions.StackOperation[] = [];
  i++; // Skip BeginCall
  
  // Collect operations until PushArgs
  while (i < ops.length) {
    const nextOp = ops[i];
    if (Array.isArray(nextOp) && nextOp[0] === Op.PushArgs) break;
    helperOps.push(nextOp);
    i++;
  }
  
  // Parse and format the complete helper call
  // ...
}
```

### Example 4: Op.Undefined Fix

The cleanup revealed a pattern of incorrect `Op.Undefined` usage:

```typescript
// BEFORE (Wrong) - in expressions.ts
function Literal({ value }: ASTv2.LiteralExpression): WireFormat.Expressions.StackExpression {
  if (value === undefined) {
    return [Op.StackExpression, [Op.PushConstant, Op.Undefined]]; // ❌ Pushes 27!
  }
  // ...
}

// AFTER (Correct)
function Literal({ value }: ASTv2.LiteralExpression): WireFormat.Expressions.StackExpression {
  if (value === undefined) {
    return [Op.StackExpression, Op.Undefined]; // ✅ Undefined opcode
  }
  // ...
}
```

### 7. Op.Curry Implementation - Reusing Dynamic Helper Pattern

The Curry operation presented unique challenges but was ultimately solved by recognizing it could reuse the dynamic helper frame pattern:

```typescript
// Wire format compiler
function Curry({
  definition,
  curriedType,
  args,
}: mir.Curry): WireFormat.Expressions.StackExpression {
  return [
    Op.StackExpression,
    ...flatten(definition),
    [Op.BeginCallDynamic],
    ...buildArgs(args),
    [Op.Curry, curriedType],
  ];
}

// Opcode compiler
case Op.Curry: {
  const [, type] = expression;
  encode.op(VM_CURRY_OP, type, encode.isDynamicStringAllowed());
  encode.op(VM_POP_FRAME_OP);
  return;
}

// VM implementation
APPEND_OPCODES.add(VM_CURRY_OP, (vm, { op1: type, op2: _isStringAllowed }) => {
  let stack = vm.stack;
  
  let args = check(stack.pop(), CheckArguments);
  let definition = check(stack.get(-1), CheckReference);
  
  let capturedArgs = args.capture();
  
  // ... create curry ref
  vm.lowlevel.setReturnValue(curryRef);
});
```

Key insights:
- Curry needs the same frame setup as dynamic helpers since it captures arguments
- The definition reference is accessed from the frame position ($fp - 1)
- A shared `buildArgs` helper was extracted to handle argument building consistently

## What's Next

### Longer-term Goals

1. **Path Expression Flattening**: Currently GetPath operations still nest
2. **Dynamic Invocation Flattening**: Call expressions with dynamic callees
3. **Argument Processing**: The `SimpleArgs` pattern still uses recursion
4. **Complete elimination of recursive patterns** in expression compilation

### Architecture Evolution

The flattening work has revealed significant architectural improvements:

- **Consistency**: Stack-based approach is now the standard
- **Simplicity**: Recursive patterns systematically eliminated
- **Debugging**: Enhanced debug formatter handles complex patterns
- **Type Safety**: Stronger typing despite initial challenges
- **Performance**: Reduced recursion should improve compilation speed

## Key Takeaways

### Success Metrics
- **100% Complete** (8 of 8 operations flattened) ✅
- **Zero recursive expr() calls** for all expression operations
- **All tests passing** with enhanced debug support
- **Type system strengthened** with proper SimpleStackOp handling
- **Shared patterns extracted** (buildArgs helper for consistent argument handling)

### Patterns Established
1. **Wire format compiler**: Flatten nested expressions into linear operations
2. **Opcode compiler**: Handle both array and number opcodes in stack expressions
3. **VM implementation**: Use arity parameters instead of arrays
4. **Debug formatter**: Parse and format complex operation patterns

### Critical Lessons
1. **Test comprehensively**: Edge cases reveal hidden bugs (continue vs break)
2. **Understand the runtime**: Stack ordering varies by operation
3. **Type carefully**: Opcode numbers are not values
4. **Update holistically**: Wire format, compiler, VM, and debug formatter must align
5. **Recognize patterns**: Curry reused the dynamic helper frame pattern
6. **Extract shared code**: The buildArgs helper simplified multiple operations

## Conclusion

The expression flattening project is now complete! All 8 targeted expression operations have been successfully flattened, eliminating recursive `expr()` calls in the opcode compiler for these operations.

Key achievements:

- Established a systematic pattern for flattening operations
- Enhanced the debug formatter to handle flattened wire format
- Extracted shared helpers (like `buildArgs`) for code reuse
- Strengthened type safety throughout the system
- Maintained full test compatibility

The project has not only achieved its immediate goals but also laid groundwork for broader architectural improvements in the Glimmer VM compilation pipeline. The patterns established here can be applied to flatten other recursive structures in the compiler, moving towards a fully linear compilation process.
