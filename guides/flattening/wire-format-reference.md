# Wire Format Reference for Arguments

Quick reference for understanding how arguments are encoded.

## Wire Format Constants

From `@glimmer/wire-format`:

```typescript
// Bit flags for argument types
const EMPTY_ARGS_OPCODE = 0b0000;      // No arguments
const POSITIONAL_ARGS_OPCODE = 0b0100;  // Positional only
const NAMED_ARGS_OPCODE = 0b0010;       // Named only  
const POSITIONAL_AND_NAMED_ARGS_OPCODE = 0b0110; // Both
```

## Argument Structures

### No Arguments: `{{helper}}`

```typescript
args = [EMPTY_ARGS_OPCODE]
// Structure: [0b0000]
```

### Positional Only: `{{helper "a" "b"}}`

```typescript
args = [POSITIONAL_ARGS_OPCODE, ["a", "b"]]
// Structure: [0b0100, Expression[]]
```

### Named Only: `{{helper foo="bar" baz="qux"}}`

```typescript
args = [NAMED_ARGS_OPCODE, [["foo", "baz"], ["bar", "qux"]]]
// Structure: [0b0010, [string[], Expression[]]]
```

### Both: `{{helper "a" foo="bar"}}`

```typescript
args = [POSITIONAL_AND_NAMED_ARGS_OPCODE, ["a"], [["foo"], ["bar"]]]
// Structure: [0b0110, Expression[], [string[], Expression[]]]
```

## Key Points

1. **Named args structure**: `[names, values]` as parallel arrays
2. **Bit flags**: Can check with `args[0] & 0b0100` for positional

## Expression Flattening (Step 4)

The wire format is being transformed from tree-structured to flat:

### Tree-Structured (Current)
```typescript
// Nested expressions must be recursively evaluated
[Op.GetPath, Op.GetLocalSymbol, 0, ["foo", "bar"]]  // this.foo.bar
[Op.CallResolved, "join", [
  POSITIONAL_ARGS_OPCODE, [
    [Op.CallResolved, "uppercase", ...],  // nested!
    [Op.CallResolved, "lowercase", ...]   // nested!
  ]
]]
```

### Flat Sequences (Target)
```typescript
// Linear sequence of operations, no nesting
[[Op.GetLocalSymbol, 0], [Op.GetProperty, "foo"], [Op.GetProperty, "bar"]]  // this.foo.bar
[
  [Op.PushLiteral, "hello"],
  [Op.CallHelper, "uppercase", 1, 0],
  [Op.PushLiteral, "WORLD"],
  [Op.CallHelper, "lowercase", 1, 0],
  [Op.CallHelper, "join", 2, 0]
]
```

"Flat" means no expressions nested inside other expressions - everything is a linear sequence.

3. **Expression type**: Arguments are expressions that need evaluation
4. **Order matters**: Positional args maintain order, named args paired

## Stack Convention (Proposed)

For `{{helper "pos" foo="bar"}}`, stack would be:

```
[... "pos" "foo" "bar"]
     ^pos  ^name ^value
```

This allows natural evaluation order while maintaining pairing.
