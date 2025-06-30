# Fix Automation Tools

This directory contains tools for automatically applying ESLint suggestions and TypeScript code fixes. These tools are useful for both humans and LLMs to efficiently address linting issues without manual guesswork.

## Benefits

**For Humans:**
- Quickly apply safe, automated fixes across large codebases
- Reduce tedious manual work on simple issues like escape characters
- Systematic approach to cleaning up linting errors

**For LLMs:**
- Apply precise fixes based on ESLint/TypeScript suggestions rather than guessing
- Leverage Language Service intelligence for robust TypeScript fixes
- Enable reliable, systematic code improvements with confidence

## Tools

### `apply-eslint-suggestions.js`
Applies ESLint suggestions (like removing unnecessary escape characters) to a file.

```bash
node bin/fixes/apply-eslint-suggestions.js <file-path> [rule-id]
```

Examples:
```bash
# Apply all ESLint suggestions
node bin/fixes/apply-eslint-suggestions.js packages/@glimmer/syntax/lib/verify.ts

# Apply only no-useless-escape suggestions
node bin/fixes/apply-eslint-suggestions.js test.ts no-useless-escape
```

### `apply-ts-codefixes.js`
Applies TypeScript Language Service code fixes (like removing unused imports, fixing type errors).

```bash
node bin/fixes/apply-ts-codefixes.js <file-path> [error-code]
```

Examples:
```bash
# Apply all TypeScript code fixes
node bin/fixes/apply-ts-codefixes.js packages/@glimmer/syntax/lib/verify.ts

# Apply only fixes for specific error code (e.g., TS6133 - unused variable)
node bin/fixes/apply-ts-codefixes.js test.ts 6133
```

### `apply-suggestions.js`
Convenience wrapper that applies both ESLint and TypeScript fixes.

```bash
node bin/fixes/apply-suggestions.js <file-path> [eslint|ts|all]
```

### `list-available-fixes.js`
Shows what ESLint fixes are available for a file without applying them.

```bash
node bin/fixes/list-available-fixes.js <file-path>
```

## Common Use Cases

1. **Remove unnecessary escape characters**: Use ESLint suggestions with `no-useless-escape`
2. **Remove unused imports**: Use TypeScript code fixes 
3. **Fix simple type errors**: Use TypeScript code fixes
4. **Remove debugger statements**: Manual fix required (not auto-fixable)

## Safety

These tools apply the first suggested fix for each issue. They're designed to be safe but you should:
- Review changes before committing
- Run tests after applying fixes
- Use version control to easily revert if needed