# Step 4: Universal Stack Expressions

## Overview

This document outlines a new approach to expression flattening that builds on our existing StackExpression infrastructure. The key insight is to make **every expression** produce a StackExpression, then flatten nested StackExpressions automatically during composition.

## Core Strategy

### 1. Universal StackExpression Output

Every expression encoder will produce a StackExpression, even for simple values:

```typescript
// Before: Literal returns a raw value
function Literal(expr): Value | Undefined {
  return expr.value;
}

// After: Literal returns a StackExpression
function Literal(expr): StackExpression {
  if (expr.value === undefined) {
    return [Op.StackExpression, [Op.Undefined]];
  } else if (isImmediate(expr.value)) {
    return [Op.StackExpression, [Op.PushImmediate, encodeImmediate(expr.value)]];
  } else {
    return [Op.StackExpression, [Op.PushConstant, expr.value]];
  }
}
```

### 2. Automatic Flattening During Composition

When building compound expressions, we automatically flatten nested StackExpressions:

```typescript
function flattenExpression(expr: mir.ExpressionNode, operations: StackOperation[]): void {
  const encoded = encodeExpr(expr);
  
  if (isStackExpression(encoded)) {
    // Unpack the operations from nested StackExpression
    const [, ...nestedOps] = encoded;
    operations.push(...nestedOps);
  } else {
    // This shouldn't happen once all expressions return StackExpression
    throw new Error(`Expected StackExpression but got ${encoded}`);
  }
}
```

### 3. Incremental Migration from Leaves

We can migrate expressions incrementally, starting with the simplest (leaf) expressions:

1. **Phase 1**: Literals, Variables, Constants
2. **Phase 2**: Property access (already done via GetPath)
3. **Phase 3**: Simple operations (Not, IfInline)
4. **Phase 4**: Helper calls
5. **Phase 5**: Complex expressions (Curry, etc.)

## Implementation Plan

### Phase 1: Update Type System

First, we need to allow StackExpression to contain any operation temporarily:

```typescript
// In wire-format/api.ts
export type StackOperation = 
  | PushImmediate
  | PushConstant
  | PushArgs
  | CallHelper
  | CallDynamicHelper
  | GetProperty
  | GetLocalSymbol
  | GetLexicalSymbol
  | GetKeyword
  | GetDynamicVar
  | Undefined
  | TupleExpression;  // Temporarily allow any expression
```

### Phase 2: Add Flattening Infrastructure

Create helper functions to handle StackExpression composition:

```typescript
function createStackExpression(...operations: StackOperation[]): StackExpression {
  const flattened: StackOperation[] = [];
  
  for (const op of operations) {
    if (isStackExpression(op)) {
      // Flatten nested StackExpression
      const [, ...nestedOps] = op;
      flattened.push(...nestedOps);
    } else {
      flattened.push(op);
    }
  }
  
  return [Op.StackExpression, ...flattened];
}

function isStackExpression(value: unknown): value is StackExpression {
  return Array.isArray(value) && value[0] === Op.StackExpression;
}
```

### Phase 3: Convert Leaf Expressions

Start with the simplest expressions:

```typescript
// Literals
function Literal({ value }): StackExpression {
  if (value === undefined) {
    return [Op.StackExpression, [Op.Undefined]];
  } else {
    return [Op.StackExpression, [Op.PushConstant, value]];
  }
}

// Local variables
function Local({ symbol }): StackExpression {
  return [Op.StackExpression, [Op.GetLocalSymbol, symbol]];
}

// Lexical variables
function Lexical({ symbol }): StackExpression {
  return [Op.StackExpression, [Op.GetLexicalSymbol, symbol]];
}

// Arguments
function Arg({ symbol }): StackExpression {
  return [Op.StackExpression, [Op.GetLocalSymbol, symbol]];
}
```

### Phase 4: Update Compound Expressions

Update expressions that compose other expressions to use flattening:

```typescript
function ResolvedCallExpression(expr: mir.ResolvedCallExpression): StackExpression {
  const operations: StackOperation[] = [];
  
  // Flatten all arguments
  const { positionalCount, namedKeys } = flattenArgs(expr.args, operations);
  
  // Add PushArgs and CallHelper
  const flags = (positionalCount << 4) | (namedKeys.length > 0 ? 0b0010 : 0);
  operations.push([Op.PushArgs, namedKeys, [], flags]);
  operations.push([Op.CallHelper, view.get(expr.callee).symbol]);
  
  return [Op.StackExpression, ...operations];
}

function flattenArgs(args: mir.Args, operations: StackOperation[]): {
  positionalCount: number;
  namedKeys: string[];
} {
  let positionalCount = 0;
  const namedKeys: string[] = [];
  
  // Flatten positional arguments
  for (const arg of args.positional.list.toArray()) {
    const encoded = encodeExpr(arg);
    if (isStackExpression(encoded)) {
      const [, ...ops] = encoded;
      operations.push(...ops);
    }
    positionalCount++;
  }
  
  // Flatten named arguments
  for (const entry of args.named.entries.toArray()) {
    namedKeys.push(entry.name.chars);
    const encoded = encodeExpr(view.get(entry.value));
    if (isStackExpression(encoded)) {
      const [, ...ops] = encoded;
      operations.push(...ops);
    }
  }
  
  return { positionalCount, namedKeys };
}
```

### Phase 5: Update Opcode Compiler

The opcode compiler needs to handle the new StackExpression format:

```typescript
case Op.StackExpression: {
  const [, head, ...continuations] = expression;
  
  // Check if this is the old GetPath format
  if (isGetPathFormat(head, continuations)) {
    // Handle old format for backward compatibility
    expr(encode, head);
    for (const [, prop] of continuations) {
      encode.op(VM_GET_PROPERTY_OP, encode.constant(prop));
    }
  } else {
    // New format: process each operation
    for (const operation of [head, ...continuations]) {
      compileStackOperation(encode, operation);
    }
  }
  return;
}
```

## Benefits of This Approach

1. **Incremental Migration**: We can convert one expression type at a time
2. **Automatic Optimization**: Nested StackExpressions automatically flatten
3. **Type Safety**: The type system guides us through the migration
4. **Backward Compatibility**: Old GetPath format continues to work
5. **Clear Path Forward**: Each expression type can be migrated independently

## Migration Order

To minimize risk, we should migrate expressions in this order:

1. **Literals and Constants** - Simplest, no dependencies
2. **Variable References** - GetLocalSymbol, GetLexicalSymbol, etc.
3. **Simple Operations** - Not, Undefined
4. **Property Access** - Already done, but verify flattening works
5. **Binary Operations** - IfInline, Concat
6. **Helper Calls** - Both resolved and dynamic
7. **Complex Operations** - Curry, HasBlock, HasBlockParams
8. **Dynamic Operations** - GetDynamicVar, Log

## Success Criteria

1. All expressions return StackExpression
2. No nested StackExpressions in wire format (automatic flattening)
3. All existing tests pass
4. Performance is maintained or improved
5. Clear separation between wire format encoding and VM execution

## Example Transformation

Here's how a complex expression would transform:

```handlebars
{{join (uppercase name) "-" (lowercase title)}}
```

### Step 1: Encode leaf expressions

- `name` → `[StackExpression, [GetLocalSymbol, 0]]`
- `"-"` → `[StackExpression, [PushConstant, "-"]]`
- `title` → `[StackExpression, [GetLocalSymbol, 1]]`

### Step 2: Encode nested helpers

- `(uppercase name)` → `[StackExpression, [GetLocalSymbol, 0], [PushArgs, [], [], 1], [CallHelper, uppercase]]`
- `(lowercase title)` → `[StackExpression, [GetLocalSymbol, 1], [PushArgs, [], [], 1], [CallHelper, lowercase]]`

### Step 3: Encode outer helper with flattening

```typescript
[StackExpression,
  // From (uppercase name)
  [GetLocalSymbol, 0],
  [PushArgs, [], [], 1],
  [CallHelper, uppercase],
  // Literal "-"
  [PushConstant, "-"],
  // From (lowercase title)
  [GetLocalSymbol, 1],
  [PushArgs, [], [], 1],
  [CallHelper, lowercase],
  // Outer call
  [PushArgs, [], [], 3],
  [CallHelper, join]
]
```

## Next Steps

1. Review and approve this plan
2. Update type definitions to support universal StackExpression
3. Implement flattening infrastructure
4. Begin incremental migration starting with literals
5. Test each phase thoroughly before proceeding

## Questions to Consider

1. Should we keep the old expression encoders during migration?
2. How do we handle expressions that can't easily push to stack (if any)?
3. Should we add debug assertions to detect nested StackExpressions?
4. What performance benchmarks should we track during migration?

## Quick Start for Cold Claude

```bash
# You should be on branch step-4-incremental with all tests passing
git status  # Verify branch
pnpm test 2>&1 | grep -c "^not ok"  # Should output 0

# Start with the simplest change - make Literal return StackExpression
# Edit /packages/@glimmer/compiler/lib/passes/2-encoding/expressions.ts
# Change the Literal function (around line 396)

# After making changes, test immediately
pnpm test 2>&1 | grep -c "^not ok"  # Should still be 0

# If tests fail, check which ones:
pnpm test 2>&1 | grep "^not ok" | head -10
```

## Current State & Context for Cold Claude

### What's Already Done

1. **Step 1-3 Complete**: Arity tracking, stack-based arguments, and frame-aware returns are all implemented
2. **Wire Format Opcodes Added**: PushImmediate (110), PushConstant (111), PushArgs (112), CallHelper (113), CallDynamicHelper (114)
3. **StackExpression Extended**: Currently supports both old GetPath format and new operations
4. **Tests Passing**: All tests pass at commit `11235acde` on branch `step-4-incremental`

### Key Files and Locations

- **Expression Encoding**: `/packages/@glimmer/compiler/lib/passes/2-encoding/expressions.ts`
  - `encodeExpr()` - Main expression encoder (line ~84)
  - `PathExpression()` - Already uses StackExpression (line ~434)
  - `ResolvedCallExpression()` - Currently returns CallResolved format (line ~476)

- **Wire Format Types**: `/packages/@glimmer/interfaces/lib/compile/wire-format/api.ts`
  - `StackOperation` type definition (line ~234)
  - `StackExpression` type definition (line ~244)

- **Opcode Compiler**: `/packages/@glimmer/opcode-compiler/lib/opcode-builder/helpers/expr.ts`
  - `expr()` - Main expression compiler (line ~45)
  - `compileStackOperation()` - New function for handling stack operations (not yet implemented)
  - StackExpression case in expr() (line ~258) - Currently only handles GetPath format

### Pitfalls to Avoid

1. **Nested StackExpression Issue**: We encountered opcode 109 errors when StackExpressions were nested. Solution: Always flatten when composing.

2. **Type System Constraints**: The current `StackOperation` type is restrictive. Need to temporarily allow `TupleExpression` during migration.

3. **Test Failures with Curry**: When we tried to flatten ALL helpers at once, tests failed with "Got true, expected: typeof function" for component helpers. This suggests Curry expressions need special handling.

4. **Frame Management**: Don't try to eliminate frames - the Arguments system depends on them for position calculations.

### Testing Strategy

1. **Start Small**: Change one expression type at a time and run full test suite
2. **Key Test**: "nested helper calls" test is a good canary for flattening issues
3. **Run Tests Frequently**: `pnpm test 2>&1 | grep -c "^not ok"` to quickly check for failures
4. **Specific Tests**:
   - Array helper tests often fail first with flattening issues
   - Component helper tests are sensitive to Curry handling

### Implementation Notes

1. **Current Branch**: Working on `step-4-incremental` branch
2. **Base Commit**: `df5e8623e` (Step 3 completion) has all tests passing
3. **Don't Use**: `pnpm dev` (opens browser), console.log debugging (wastes context)
4. **Do Use**: `pnpm test`, asking for help when stuck

### The Big Picture

We're transforming Glimmer's expression evaluation from a recursive, runtime-decision model to a flat, compile-time model. This enables:

- Better performance (no runtime recursion)
- Simpler VM (just executes operations linearly)
- Future optimization (direct function calls instead of wire format)

The key insight: Every expression should compile to stack operations that the VM executes mechanically, with no interpretation or decisions.

### What We Tried That Didn't Work

1. **Flattening ALL helpers at once**: We tried making ResolvedCallExpression always flatten, but this broke tests because:
   - Nested StackExpressions weren't being flattened
   - Component helpers (which use Curry) returned `true` instead of functions

2. **Conditional flattening only for nested helpers**: This worked but was too limited. It only flattened when arguments contained helper calls.

3. **Not handling nested StackExpressions**: When array helpers were nested, we got "Cannot flatten expression type with opcode 109" errors.

### Why This New Approach is Better

1. **Universal**: Every expression returns StackExpression, no special cases
2. **Composable**: Automatic flattening means no nested StackExpressions
3. **Incremental**: Can migrate one expression type at a time
4. **Compatible**: Existing code continues to work during migration
