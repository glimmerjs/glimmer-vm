# Future GitHub Issues to Create

This file documents improvements and technical debt to address after completing PR #1690.

## Testing Improvements

### Improve Keyword Testing Coverage
**Priority: Medium**

The keyword error tests in `packages/@glimmer-workspace/integration-tests/test/syntax/keyword-errors-test.ts` currently test all keywords uniformly. Consider creating category-specific tests:

- **Block keywords** (`if`, `each`, `with`) - test valid block context vs invalid append context
- **Append keywords** - test append position usage
- **Call keywords** - test function call contexts  
- **Modifier keywords** - test modifier contexts

This would provide more comprehensive validation and better error message testing for the keyword system.

**Effort estimate**: 2-4 hours
**Context**: During PR #1690 cleanup, unused filtered arrays (`BLOCK_KEYWORDS`, etc.) were removed as they weren't being used for separate test categories.

## Code Quality

### Review Unused Private Class Members
**Priority: Low**

Several classes have unused private members that should be reviewed:

- `packages/@glimmer/syntax/lib/syntax-error.ts` - `#highlight`, `#message`, `#notes`  
- `packages/@glimmer/syntax/lib/validation-context/append.ts` - `#append`
- `packages/@glimmer/syntax/lib/validation-context/args.ts` - `#named`, `#span`
- `packages/@glimmer/syntax/lib/validation-context/element.ts` - `#container`, `#span`, `#parent`, `#curly`

Determine if these are:
1. Actually needed but not called (potential bugs)
2. Leftover from refactoring (should be removed)
3. Planned future features (should be documented)

### Address Deprecated API Usage
**Priority: Medium**

Replace deprecated `blockParams` usage in `packages/@glimmer/syntax/lib/get-template-locals.ts` with the newer `params` API. The deprecation warnings indicate the new API provides better error propagation and location information.

## Type Safety Improvements

### Fix Unsafe TypeScript Operations
**Priority: High**

Address unsafe type operations in:
- `packages/@glimmer/runtime/lib/references/curry-value.ts`
- `packages/@glimmer/syntax/lib/v2/serialize/serialize.ts`

These involve `error` typed values and should be properly typed for better type safety.

### Review Non-null Assertions
**Priority: Medium**

Review and potentially eliminate non-null assertions, particularly in `packages/@glimmer/opcode-compiler/lib/compilable-template.ts` line 470.

---

*This file should be deleted after creating the actual GitHub issues.*