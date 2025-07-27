# Step 4: Execution Order

## Phase 1: Remove Frames from CallResolved

**File**: `packages/@glimmer/opcode-compiler/lib/opcode-builder/helpers/expr.ts`

**Current code** (lines ~152-163):
```typescript
encode.op(VM_PUSH_FRAME_OP);
compileArgsForStack(encode, args);
encode.op(VM_CONSTRUCT_ARGS_OP, positionalCount, namedCount);
encode.op(VM_HELPER_OP, handle);
encode.op(VM_POP_FRAME_OP);
encode.op(VM_FETCH_OP, $v0);
```

**Change to**:
```typescript
compileArgsForStack(encode, args);
encode.op(VM_CONSTRUCT_ARGS_OP, positionalCount, namedCount);
encode.op(VM_HELPER_OP, handle);
encode.op(VM_FETCH_OP, $v0);
```

**Test**: Run `pnpm test` - all should pass

## Phase 2: Remove Frames from CallDynamicValue

**File**: Same file (`expr.ts`)

**Current code** (lines ~176-183):
```typescript
encode.op(VM_PUSH_FRAME_OP);
compileArgsForStack(encode, args);
encode.op(VM_CONSTRUCT_ARGS_OP, positionalCount, namedCount);
encode.op(VM_DUP_FP_OP, 1);
encode.op(VM_DYNAMIC_HELPER_OP);
encode.op(VM_POP_FRAME_OP);
encode.op(VM_POP_OP, 1);
encode.op(VM_FETCH_OP, $v0);
```

**Change to**:
```typescript
compileArgsForStack(encode, args);
encode.op(VM_CONSTRUCT_ARGS_OP, positionalCount, namedCount);
encode.op(VM_DUP_FP_OP, 1);
encode.op(VM_DYNAMIC_HELPER_OP);
encode.op(VM_POP_OP, 1);
encode.op(VM_FETCH_OP, $v0);
```

**Test**: Run `pnpm test` - all should pass

## Phase 3: Remove Frames from Log

**File**: Same file (`expr.ts`)

**Current code** (lines ~269-273):
```typescript
encode.op(VM_PUSH_FRAME_OP);
compilePositional(encode, positional);
encode.op(VM_LOG_OP);
encode.op(VM_POP_FRAME_OP);
encode.op(VM_FETCH_OP, $v0);
```

**Note**: This uses `compilePositional` not `compileArgsForStack`. We need to check if this needs updating too.

**Test**: Run `pnpm test` - all should pass

## Phase 4: Verify Complete

1. Search for any remaining helper-related frame usage
2. Run full test suite
3. Test nested helper example manually
4. Update documentation

## Success Metrics

- ✅ All 2043 tests pass
- ✅ No VM_PUSH_FRAME_OP or VM_POP_FRAME_OP in helper paths
- ✅ Stack remains balanced
- ✅ Nested helpers work correctly