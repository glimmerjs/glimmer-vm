# Step 4: Stack-Based Expression Flattening for Helpers

## Current Status

We've successfully implemented:

- Frame-aware return optimization for `CallResolved` (eliminates `VM_FETCH_OP`)
- `StackExpression` for path expressions (e.g., `this.foo.bar`)

However, helper calls are still evaluated recursively. Nested expressions like `{{join (uppercase "hello") (lowercase "WORLD")}}` require recursive evaluation in the opcode compiler at runtime.

## The Goal: Expand StackExpression for All Expressions

Transform nested helper expressions into flat, stack-based sequences during the encoding pass (compile time), eliminating recursive evaluation at runtime. We're moving the flattening logic from the opcode compiler (runtime) to the wire format encoder (compile time).

## Example Transformation

### Current (Recursive) Approach

For `{{join (uppercase "hello") (lowercase "WORLD")}}`:

```typescript
// Wire format (nested):
[CallResolved, "join", [
  [CallResolved, "uppercase", ["hello"]], 
  [CallResolved, "lowercase", ["WORLD"]]
]]

// Compiles to recursive evaluation:
// 1. Push frame, evaluate inner uppercase, pop frame, fetch from $v0
// 2. Push frame, evaluate inner lowercase, pop frame, fetch from $v0  
// 3. Push frame, call join with results, pop frame
```

### New (Stack-Based) Approach

```typescript
// Wire format (flat):
[StackExpressionOpcode,
  [PushConstant, "hello"],             // Push string constant as reference
  [PushArgs, [], [], 0b10000],        // 1 positional arg, no named/blocks
  [CallHelper, uppercase_symbol],      // consumes args, pushes result
  
  [PushConstant, "WORLD"],             // Push string constant as reference
  [PushArgs, [], [], 0b10000],        // 1 positional arg
  [CallHelper, lowercase_symbol],      // consumes args, pushes result
  
  [PushArgs, [], [], 0b100000],       // 2 positional args  
  [CallHelper, join_symbol]            // consumes args, pushes result
]

// Compiles to linear execution - no recursive evaluation!
```

## Key Insight: Matching CompileArgs Structure

The critical challenge is that `VM_PUSH_ARGS_OP` expects values on the stack in a specific order:

1. Block values (if any)
2. Positional argument values  
3. Named argument values

Our wire format operations must push values in this exact order, then call `PushArgs` with the metadata (names array, block names, flags) that `VM_PUSH_ARGS_OP` needs.

## New Wire Format Opcodes Needed

1. **PushImmediate** - Push a small integer directly (no constant pool)
2. **PushConstant** - Push a constant value as a reference (strings, undefined, objects, etc.)
3. **PushArgs** - Creates Arguments object from stack values (maps to `VM_PUSH_ARGS_OP`)
4. **CallHelper** - Call a resolved helper with args on stack
5. **CallDynamicHelper** - Call a dynamic helper (helper reference on stack)

### Phase 1: Extend Wire Format

1. Add new opcodes to `@glimmer/interfaces/lib/compile/wire-format/opcodes.d.ts`:
   - `PushImmediateOpcode = 110`
   - `PushConstantOpcode = 111`
   - `PushArgsOpcode = 112`
   - `CallHelperOpcode = 113`
   - `CallDynamicHelperOpcode = 114`

2. Define types in `@glimmer/interfaces/lib/compile/wire-format/api.ts`

3. Update `@glimmer/wire-format` to include opcode constants

### Phase 2: Transform Nested Expressions in Encoding Pass

1. Modify `ResolvedCallExpression` in `@glimmer/compiler/lib/passes/2-encoding/expressions.ts`
2. Detect when arguments contain nested calls
3. Build flat `StackExpression` instead of nested `CallResolved`

### Phase 3: Extend StackExpression Compiler

1. Update `expr()` in `@glimmer/opcode-compiler` to handle new opcodes
2. Each opcode maps directly to VM instructions:
   - `PushImmediate` → `VM_PRIMITIVE_OP` with immediate value + `VM_PRIMITIVE_REFERENCE_OP`
   - `PushConstant` → `VM_PRIMITIVE_OP` with constant handle + `VM_PRIMITIVE_REFERENCE_OP`
   - `PushArgs` → `VM_PUSH_ARGS_OP`
   - `CallHelper` → `VM_HELPER_WITH_RESERVED_OP` (for resolved helpers)
   - `CallDynamicHelper` → `VM_DYNAMIC_HELPER_WITH_RESERVED_OP` (helper ref on stack)

### Phase 4: Extend to Other Patterns

1. Dynamic helpers (`CallDynamicValue`)
2. Statement-level helpers
3. Keyword helpers

## Testing Strategy

1. **Existing Tests**: All current tests should continue passing
2. **Specific Test Cases**:
   - Simple helpers: `{{uppercase "hello"}}`
   - Nested helpers: `{{join (uppercase "hello") (lowercase "WORLD")}}`
   - Named arguments: `{{helper positional name=value}}`
   - Mixed arguments: Complex combinations of positional/named/blocks
   - Dynamic helpers: `{{(someHelper) arg}}`

## Success Criteria

- Nested helper expressions compile to flat `StackExpression` sequences
- No recursive evaluation for nested expressions
- All 2043+ tests passing
- Linear execution path for complex expressions

## Example: Named Arguments

For `{{concat "Hello" " " name=this.name suffix="!"}}`:

```typescript
[StackExpressionOpcode,
  // Positional args first
  [PushConstant, "Hello"],
  [PushConstant, " "],
  
  // Named arg values (names go in PushArgs metadata)
  [GetVar, 0],              // this.name
  [PushConstant, "!"],
  
  // Call with metadata
  [PushArgs, ["name", "suffix"], [], flags],  // 2 positional, 2 named
  [CallHelper, concat_symbol]
]
```

Note: Named argument names are passed as metadata to `PushArgs`, not pushed on the stack.

## Key Architectural Insight

We're moving the expression flattening from **runtime** (opcode compiler) to **compile time** (wire format encoder):

- **Before**: Wire format contains nested structures → Opcode compiler recursively evaluates at runtime
- **After**: Wire format contains flat sequences → Opcode compiler linearly executes at runtime

This aligns with the broader goal of making wire format opcodes map 1:1 to opcode compiler functions, eliminating conditional logic.

## Implementation Note

The transformation happens in `ResolvedCallExpression` during encoding. When we detect nested calls in arguments, we build a `StackExpression` instead of a `CallResolved`. The opcode compiler's `StackExpression` handler will then emit the linear sequence of VM opcodes.

## Benefits

1. **Performance**: Eliminates recursive evaluation overhead
2. **Simplicity**: Linear execution model easier to optimize
3. **Debugging**: Stack-based execution easier to trace
4. **Future**: Opens door for further optimizations (e.g., direct function calls from wire format)

## Next Steps

1. Start with Phase 1 - define new wire format opcodes
2. Implement expression flattening in encoding pass
3. Extend StackExpression compiler
4. Test with increasingly complex helper patterns
