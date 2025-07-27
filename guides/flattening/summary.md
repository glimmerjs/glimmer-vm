# Expression Flattening: Current State

## Overview

This project implements expression flattening to enable a fundamental transformation of Glimmer VM's architecture. The **primary goal** is to create a 1:1 mapping between wire format operations and opcode compiler functions, ultimately allowing us to **replace the wire format with direct function calls**.

### Why This Matters

Currently, Glimmer compiles templates to a wire format (data structure) that is then interpreted by recursive functions. The goal is to flatten this so that:

1. Each wire format operation maps to exactly one function
2. No recursive processing is needed
3. The wire format can eventually be replaced with direct JavaScript function calls

### The Problem with Recursive Expressions

The current wire format violates our goal because the opcode compiler must:

1. **Make decisions** based on the shape of embedded expressions (e.g., checking if a nested opcode is `GetLocalSymbol` or `GetLexicalSymbol`)
2. **Dynamically delegate** to different functions based on what's embedded inside (e.g., calling `expr()` recursively on nested expressions)

Example:

```typescript
// Current GetPath handling - violates both rules!
case Op.GetPath: {
  const [, kind, sym, path] = expression;
  if (kind === Op.GetLocalSymbol) getLocal(encode, sym);  // Decision based on embedded data!
  else getLexical(encode, sym);                            // Dynamic delegation!
  // ...
}
```

We need each wire format operation to be self-contained, with no examination of nested structures.

## Current Implementation Status

### Step 1: Arity Tracking ✅ (Complete)

- Added `calculateArityCounts` to analyze argument patterns
- Provides foundation for stack-based argument handling

### Step 2: Stack-Based Arguments ✅ (Complete)

- Implemented `compileArgsForStack` to push arguments directly to stack
- Created VM_CONSTRUCT_ARGS_OP to reconstruct Arguments from stack values
- Successfully handles both positional and named arguments
- All 2043 tests passing!

### Step 3: Frame-Aware Return ✅ (Complete)

- Implemented stack reservation technique to eliminate VM_FETCH_OP
- Helper return values are pre-allocated on stack before frame push
- Works correctly with nested helper calls
- All tests passing!

### Step 4: Wire Format Flattening 🚧 (In Progress)

- Goal: Transform the wire format itself from tree-structured to flat sequences
- "Flat" means no expressions nested inside other expressions - everything is linear
- Each operation in the flat format will map to exactly one function call
- This is a prerequisite for replacing wire format with direct function calls

#### Phase 1: Path Expressions ✅ (Complete)
- Added GetProperty opcode (108)
- Defined StackExpression type: `[TupleExpression, ...Continuation[]]`
- Updated PathExpression encoder to produce flat format
- Path expressions now compile from `[GetPath, [GetLocalSymbol, 0], ["foo"]]` to `[[GetLocalSymbol, 0], [GetProperty, "foo"]]`
- All tests passing!

#### Remaining Phases:
- Phase 2: Other leaf expressions (literals, keywords, etc.)
- Phase 3: Helper calls (the big one - flatten nested helper calls)
- Phase 4: Composite expressions (concat, if-inline, not, curry)
- Phase 5: Cleanup (remove recursive expr() function)

## Project Structure

```text
guides/flattening/
├── summary.md                        # This file - current implementation state
├── planning/                         # Active planning documents
│   ├── step-3-frame-aware-return.md
│   ├── step-4-wire-format-flattening.md
│   └── wire-format-flattening-findings.md
├── current-helper-design.md          # Architecture reference
├── wire-format-reference.md          # Wire format documentation
└── archive/                          # Failed attempts and learnings
    ├── step-4-analysis.md
    ├── step-4-findings.md
    ├── frame-aware-attempts.md
    └── frame-aware-return-findings.md
```

## Key Learnings

1. **Frames are Integral**: The Arguments system depends on frames and $sp register for position calculations. Removing frames requires redesigning Arguments.

2. **Stack Reservation Works**: Pre-allocating stack space for return values successfully eliminated VM_FETCH_OP.

3. **Incremental Progress Works**: Stack-based arguments provide immediate value even without completing all optimizations.

4. **"Flat" Means No Nesting**: Wire format flattening is about eliminating recursive expression evaluation, not creating a single array.

## Next Steps

1. **Complete Step 4 Phase 1**: Implement path expression flattening
2. **Measure Performance**: Quantify the benefits of our optimizations
3. **Documentation**: Update architecture docs with new helper execution model and wire format changes

## Code Locations

- Arity calculation: `packages/@glimmer/opcode-compiler/lib/opcode-builder/helpers/expr.ts`
- Stack args compilation: Same file, `compileArgsForStack` function
- VM_CONSTRUCT_ARGS_OP: `packages/@glimmer/runtime/lib/compiled/opcodes/expressions.ts:358`
- Frame-aware return:
  - VM_PUSH_FRAME_WITH_RESERVED_OP: `packages/@glimmer/runtime/lib/compiled/opcodes/vm.ts:138`
  - VM_HELPER_WITH_RESERVED_OP: `packages/@glimmer/runtime/lib/compiled/opcodes/expressions.ts:194`
  - LowLevelVM methods: `packages/@glimmer/runtime/lib/vm/low-level.ts:97-105`
- Test: `packages/@glimmer-workspace/integration-tests/test/helpers/stack-args-test.ts`

## Conclusion

We've successfully completed three major optimizations and are working on a fourth:

1. **Arity tracking** ✅ - Better argument analysis for optimization decisions
2. **Stack-based arguments** ✅ - Eliminated array allocations for helper calls
3. **Frame-aware return** ✅ - Eliminated VM_FETCH_OP after helper calls
4. **Wire format flattening** 🚧 - Eliminating recursive expression evaluation

The key insight is that "expression flattening" operates at multiple levels:

- **VM level**: Stack-based execution with frame-aware returns (Steps 1-3)
- **Wire format level**: Linear instruction sequences instead of nested trees (Step 4)

### Ultimate Goal: Direct Function Calls

Once the wire format is fully flattened with a 1:1 mapping to functions, we can replace:

```typescript
// Current: Interpret wire format
[Op.GetLocalSymbol, 0]  // → expr() interprets this

// Future: Direct function call
getLocalSymbol(0)  // → Direct JavaScript call
```

This transformation will eliminate the interpretation overhead and enable further optimizations like inlining and JIT compilation.
