# Step 4: True Wire Format Flattening

## Goal

Transform the wire format from tree-structured (nested expressions) to flat sequences (linear operations), enabling a 1:1 mapping between wire format operations and opcode compiler functions.

## The Fundamental Problem

The current wire format violates the principle that each operation should map to exactly one function. The opcode compiler currently must:

1. **Make decisions** based on embedded data structures
2. **Dynamically delegate** to different functions based on nested content

This prevents us from eventually replacing the wire format with direct function calls.

## What "Flat" Really Means

"Flat" means **no recursive nesting of expressions**:

- **Tree-structured**: Operations contain other operations that must be recursively processed
- **Flat**: Each operation is self-contained with no nested structures to examine

Example of the problem:

```typescript
// Current: GetPath embeds another expression inside
[Op.GetPath, [Op.GetLocalSymbol, 0], ["foo", "bar"]]
//           ^^^^^^^^^^^^^^^^^^^^^^^ embedded expression!

// The compiler must examine this and decide what to do:
if (kind === Op.GetLocalSymbol) getLocal(encode, sym);  // BAD!
else getLexical(encode, sym);                            // BAD!

// Target: Each operation stands alone
[[Op.GetLocalSymbol, 0], [Op.GetProperty, "foo"], [Op.GetProperty, "bar"]]
// Each can be processed without examining nested data
```

## Current vs. Target Architecture

### Current: Tree-Structured Wire Format

```typescript
// Wire Format embeds GetLocalSymbol inside GetPath
[Op.GetPath, Op.GetLocalSymbol, 0, ["foo", "bar"]]
// Expands to: [107, 32, 0, ["foo", "bar"]]
         ↓
// expr() recursively processes the embedded expression
         ↓  
// VM Opcodes (flat)
VM_GET_VARIABLE_OP(0)    // 0 = 'this' in local frame
VM_GET_PROPERTY_OP("foo")
VM_GET_PROPERTY_OP("bar")
```

### Target: Flat Wire Format

```typescript
// Wire Format as a sequence of operations
[[Op.GetLocalSymbol, 0], [Op.GetProperty, "foo"], [Op.GetProperty, "bar"]]
// Expands to: [[32, 0], [108, "foo"], [108, "bar"]]
         ↓
// Simple loop compiles each operation (no recursion)
         ↓
// VM Opcodes (unchanged)
VM_GET_VARIABLE_OP(0)
VM_GET_PROPERTY_OP("foo")  
VM_GET_PROPERTY_OP("bar")
```

## Implementation Phases

### Phase 1: Path Expressions

Start with paths since they're leaf nodes and straightforward to flatten.

#### 1.1 Add GetProperty Opcode

The key insight: `GetLocalSymbol` (32) and `GetLexicalSymbol` (33) already exist as standalone opcodes! The tree structure comes from `GetPath` embedding these inside itself. We only need to add one new opcode:

In `packages/@glimmer/wire-format/lib/opcodes.ts`:

```typescript
// Flat expression opcode for property access
GetProperty: 108,  // For property access (e.g., .foo, .bar)
```

This allows us to decompose paths into sequences of operations:

- `this.foo` → `[[GetLocalSymbol, 0], [GetProperty, "foo"]]`
- `@arg.bar` → `[[GetLocalSymbol, 1], [GetProperty, "bar"]]`
- `lexicalVar.baz` → `[[GetLexicalSymbol, 0], [GetProperty, "baz"]]`

#### 1.2 Define StackExpression Type

In `packages/@glimmer/interfaces/lib/compile/wire-format/api.ts`:

```typescript
export type StackExpression = [TupleExpression, ...Continuation[]];
export type Continuation = GetProperty;
export type GetProperty = [GetPropertyOpcode, string];

// Update Expression to include StackExpression
export type Expression = TupleExpression | StackExpression | Value;
```

This represents our flat format where:

- `StackExpression` starts with a `TupleExpression` (like `[GetLocalSymbol, 0]`)
- Followed by zero or more `Continuation` elements (each a `GetProperty`)

#### 1.3 Update Expression Encoder

In `packages/@glimmer/compiler/lib/passes/2-encoding/expressions.ts`:

**Current:**

```typescript
function PathExpression({ head, tail }: mir.PathExpression): WireFormat.Expressions.GetPath {
  let getOp = encodeExpr(head) as WireFormat.Expressions.GetVar;
  return [Op.GetPath, ...getOp, Tail(tail)];
}
```

**New:**

```typescript
function PathExpression({ head, tail }: mir.PathExpression): WireFormat.Expressions.StackExpression {
  const headOp = encodeExpr(head) as WireFormat.Expressions.TupleExpression;
  const continuations: WireFormat.Expressions.Continuation[] = [];
  
  for (const member of tail.members) {
    continuations.push([Op.GetProperty, member.chars]);
  }
  
  return [headOp, ...continuations];
}
```

#### 1.4 Update Opcode Compiler

In `packages/@glimmer/opcode-compiler/lib/opcode-builder/helpers/expr.ts`:

**Update expr() to handle StackExpression:**

```typescript
export function expr(encode: EncodeOp, expression: WireFormat.Expression): void {
  if (Array.isArray(expression)) {
    // Check if this is a StackExpression (first element is an array)
    if (Array.isArray(expression[0])) {
      // This is a StackExpression: [TupleExpression, ...Continuation[]]
      const [head, ...continuations] = expression as WireFormat.Expressions.StackExpression;
      
      // Process the head expression
      expr(encode, head);
      
      // Process each continuation (GetProperty operations)
      for (const continuation of continuations) {
        expr(encode, continuation);
      }
      
      return;
    }
    
    const [op] = expression;
    switch (op) {
      // ... existing cases
    }
  }
}
```

**Add GetProperty case to the switch:**

```typescript
case Op.GetProperty: {
  const [, prop] = expression;
  encode.op(VM_GET_PROPERTY_OP, encode.constant(prop));
  return;
}
```

The key insight is that StackExpression is processed sequentially - first the head, then each property access.

### Phase 2: Other Leaf Expressions

Flatten other expressions that don't contain sub-expressions:

- Literals (strings, numbers, booleans, null, undefined)
- GetKeyword
- GetDynamicVar
- HasBlock/HasBlockParams

### Phase 3: Helper Calls

This is the big one - flatten helper calls to eliminate nested expression evaluation.

For `{{join (uppercase "hello") (lowercase "WORLD")}}`:

**Current (Tree-Structured):**

```typescript
[Op.CallResolved, "join", [
  POSITIONAL_ARGS_OPCODE, [
    [Op.CallResolved, "uppercase", [POSITIONAL_ARGS_OPCODE, ["hello"]]],  // ← nested!
    [Op.CallResolved, "lowercase", [POSITIONAL_ARGS_OPCODE, ["WORLD"]]]   // ← nested!
  ]
]]
```

To evaluate `join`, you must first recursively evaluate `uppercase` and `lowercase`.

**Target (Flat Sequence):**

```typescript
[
  [Op.PushLiteral, "hello"],
  [Op.CallHelper, "uppercase", 1, 0],  // Result goes on stack
  [Op.PushLiteral, "WORLD"],
  [Op.CallHelper, "lowercase", 1, 0],  // Result goes on stack
  [Op.CallHelper, "join", 2, 0]        // Consumes 2 values from stack
]
```

No nesting! Just execute each operation in order. The stack naturally handles the data flow.

### Phase 4: Composite Expressions

Flatten remaining expressions:

- Concat
- IfInline  
- Not
- Curry

### Phase 5: Cleanup

Once all expressions are flat:

1. Delete the recursive `expr()` function entirely
2. Rename `compileExpression()` to `expr()`
3. Remove all tree-structured expression types from wire format
4. Update wire format debug tooling

## Benefits

1. **Simpler Compilation**: No recursive tree walking
2. **Direct Mapping**: Wire format opcodes map 1:1 to VM opcodes
3. **Better Performance**: Less function call overhead during compilation
4. **Easier to Optimize**: Can apply peephole optimizations to flat sequences
5. **Clearer Architecture**: Wire format directly represents execution order

## Success Criteria

1. All expressions compile to flat sequences
2. The recursive `expr()` function is completely removed
3. Wire format can be compiled with a simple loop
4. All tests pass
5. Compilation performance improves

## Key Technical Considerations

1. **Constants Pool**: Property names and literals go through the constants pool for now. This may change when emitting JavaScript directly.

2. **Incremental Migration**: The design allows both tree and flat formats to coexist during transition. Flat expressions are detected by their starting opcode.

3. **Type Safety**: TypeScript types need updating as we change wire format structures, but the VM opcodes remain unchanged.

4. **Testing Strategy**: Each phase must maintain all passing tests. The VM behavior doesn't change, only the wire format structure.

## Risks and Mitigations

### Wire Format Size

**Risk**: Flat format might be larger for simple expressions.

**Mitigation**:

- Use compact encoding (variable-length integers)
- Only flatten complex nested expressions initially
- Measure actual size impact on real templates

### Debugging Complexity

**Risk**: Flat format is harder to read/debug than tree format.

**Mitigation**:

- Update wire format debugger to show logical structure
- Add source mapping to connect flat instructions to template source
- Keep good error messages that reference original template

## Phase 1 Detailed Steps ✅ (Complete!)

1. [x] Add GetProperty opcode to wire format (reuse existing GetLocalSymbol/GetLexicalSymbol)
2. [x] Define StackExpression type for flat format representation
3. [x] Update `PathExpression()` encoder to produce flat output
4. [x] Update `expr()` to detect and handle StackExpression
5. [x] Add GetProperty case to expr() switch statement
6. [x] Remove GetPath from type system and all references
7. [x] Update wire-format-debug.ts and test-support files
8. [x] Verify all path expression tests pass - 2035/2045 tests passing!

### What We Accomplished

Path expressions now compile from tree-structured format:

```json
[Op.GetPath, Op.GetLocalSymbol, 0, ["foo", "bar"]]
```

To flat sequences using StackExpression:

```json
[[Op.GetLocalSymbol, 0], [Op.GetProperty, "foo"], [Op.GetProperty, "bar"]]
```

The key innovation was the `StackExpression` type that represents a sequence starting with a `TupleExpression` followed by zero or more `Continuation` operations (currently just `GetProperty`).

This incremental approach lets us prove the concept with simple expressions before tackling the complex nested cases.
