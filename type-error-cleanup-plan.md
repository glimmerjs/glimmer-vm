# Type Error Cleanup Plan

## Current State
- **Total Errors**: 76 (down from 102)
- **Already Fixed**: StackExpression/Syntax type issue in wire-format-debug.ts (26 errors)

## Error Breakdown by Type
- **TS2345** (31 errors): Type assignment incompatibilities
- **TS2322** (11 errors): Type assignment issues  
- **TS2556** (6 errors): Spread argument issues
- **TS7053** (4 errors): Element implicitly has 'any' type
- **TS2339** (4 errors): Property does not exist
- Other errors: 20 total

## Error Breakdown by Package
1. **@glimmer/syntax** (17 errors)
   - serialize.ts: 14 errors
   - test files: 3 errors

2. **@glimmer/compiler** (19 errors)
   - normalization/keywords/block.ts: 10 errors
   - encoding/expressions.ts: 4 errors
   - encoding/content.ts: 4 errors
   - Other: 1 error

3. **@glimmer/opcode-compiler** (6 errors)
   - opcode-builder/helpers/expr.ts: 4 errors
   - opcode-builder/helpers/components.ts: 2 errors

4. **@glimmer-workspace/integration-tests** (33 errors)
   - Various test files and helpers

5. **Other packages** (1 error)
   - repo-metadata: 1 error

## Root Causes

### 1. AST Node Type Incompatibilities
- `UnresolvedBinding` not assignable to various expression types
- `CurlyAttrValue` vs `ExpressionValueNode` mismatch
- `ResolvedElementModifier` vs `ElementModifier` mismatch

### 2. Wire Format Type Issues
- StackExpression integration (mostly fixed)
- Expression type hierarchies

### 3. Test Infrastructure Issues
- Decorator type mismatches
- Test function signatures
- Module helper types

## Fixing Strategy

### Phase 1: Critical Type Infrastructure (High Priority)
1. Fix AST node type hierarchy in @glimmer/syntax
   - Make `UnresolvedBinding` compatible where needed
   - Fix `ExpressionValueNode` to include `CurlyAttrValue`
   - Resolve `ElementModifier` vs `ResolvedElementModifier`

2. Fix wire format expression types in @glimmer/compiler
   - Complete StackExpression integration
   - Fix normalization pass type issues

### Phase 2: Dependent Package Fixes (Medium Priority)
3. Fix @glimmer/opcode-compiler
   - Update expression handling to match new types
   - Fix component helper types

### Phase 3: Test Infrastructure (Lower Priority)
4. Fix integration test types
   - Update test decorators
   - Fix module helpers
   - Address spread argument issues

### Phase 4: Cleanup
5. Fix remaining misc errors
6. Add type checking to CI

## Implementation Notes

- Start with syntax package as it's upstream of compiler
- Many compiler errors may be fixed by fixing syntax types
- Test errors can be addressed last as they don't block functionality
- Consider adding `// @ts-expect-error` temporarily for test files if needed

## Success Criteria
- `pnpm lint:types` passes without errors
- All packages can be built successfully
- Type checking integrated into CI to prevent regression