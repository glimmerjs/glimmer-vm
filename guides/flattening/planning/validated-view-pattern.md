# ValidatedView Pattern for MIR Type Safety

## Problem Statement

The Glimmer compiler has a multi-phase architecture:

1. **Parsing** - Creates AST nodes
2. **Normalization** - Transforms AST to MIR (Mid-level Intermediate Representation)
3. **Validation** - Ensures all bindings are resolved and converts UnresolvedBinding to errors
4. **Encoding** - Transforms validated MIR to wire format

The challenge is that MIR nodes contain unions like `ResolvedName | UnresolvedBinding`, but after validation, we know that all `UnresolvedBinding` instances have been converted to errors. The encoder should be able to assume it's working with validated MIR, but TypeScript doesn't know about this cross-phase guarantee.

## Previous Approaches Considered

### 1. Runtime Assertions

```typescript
// Lots of repetitive assertions
const callee = expr.callee as ASTv2.ResolvedName;
```

**Problems**: Repetitive, error-prone, doesn't scale well

### 2. Type Transformation Utility

```typescript
type Validated<T> = T extends UnresolvedBinding ? never : /* complex recursive logic */
```

**Problems**: Complex type gymnastics, doesn't work well with classes, creates type incompatibilities

### 3. Phase-aware Generics

```typescript
class Template<P extends Phase> extends node('Template').fields<{...}>() {}
```

**Problems**: Requires significant changes to the node builder infrastructure

## The ValidatedView Solution

The ValidatedView pattern provides a clean separation between data (MIR nodes) and interpretation (validation state). It acts as a "lens" that knows about the validation guarantee.

### Implementation

```typescript
// In mir.ts
export interface ValidatedView {
  // Generic getter that removes UnresolvedBinding from unions
  get<T>(value: T | ASTv2.UnresolvedBinding): T;
}

export class ValidatedViewImpl implements ValidatedView {
  get<T>(value: T | ASTv2.UnresolvedBinding): T {
    if ((value as any)?.type === 'UnresolvedBinding') {
      throw new Error(`Unexpected UnresolvedBinding in validated MIR: ${(value as ASTv2.UnresolvedBinding).name}`);
    }
    return value as T;
  }
}
```

### Usage in the Encoder

```typescript
// Create a view instance (the encoder assumes validated MIR)
const view = new ValidatedViewImpl();

// Before: Type errors because callee might be UnresolvedBinding
function ResolvedCallExpression(expr: mir.ResolvedCallExpression) {
  return [Op.CallResolved, expr.callee.symbol, ...]; // Error: symbol doesn't exist on UnresolvedBinding
}

// After: Clean and type-safe
function ResolvedCallExpression(expr: mir.ResolvedCallExpression) {
  return [Op.CallResolved, view.get(expr.callee).symbol, ...];
}
```

### Handling Nested Structures

The beauty of this approach is that it composes naturally:

```typescript
// Positional arguments might contain UnresolvedBinding
export function encodePositional({ list }: mir.Positional) {
  return list.map((l) => encodeExpr(view.get(l))).toPresentArray();
}

// Named arguments
function encodeNamedArgument({ name, value }: mir.CurlyNamedArgument) {
  return [name.chars, encodeExpr(view.get(value))];
}

// Path expressions
function PathExpression({ head, tail }: mir.PathExpression) {
  const headOp = encodeExpr(view.get(head));
  // ... rest of encoding
}
```

## Benefits

1. **No changes to MIR nodes** - All existing node definitions remain unchanged
2. **Clear separation of concerns** - The validation guarantee is explicit
3. **Simple to use** - Just wrap values with `view.get()`
4. **Composable** - Works naturally with nested structures
5. **Progressive migration** - Can be adopted incrementally
6. **Runtime safety** - Throws clear errors if assumptions are violated

## Design Principles

1. **Single responsibility** - The view has one job: narrow types by removing UnresolvedBinding
2. **Fail fast** - If an UnresolvedBinding somehow reaches the encoder, fail with a clear error
3. **Minimal API** - Just one method: `get<T>(value: T | UnresolvedBinding): T`
4. **Let composition handle complexity** - Don't try to handle lists or nested structures in the view

## Alternative Designs Considered

We considered having specialized methods like:

- `getResolved(node: { resolved: ResolvedName | UnresolvedBinding }): ResolvedName`
- `getPositionalList(positional: Positional): Array<ExpressionValueNode>`
- `getNamedArgumentValue(arg: CurlyNamedArgument): ExpressionValueNode`

But realized this was overcomplicating things. The encoding functions already handle the traversal - they just need a way to narrow types at the leaf level.

## Future Considerations

1. **Generated views** - Could potentially generate view implementations from node definitions
2. **Multiple views** - Could have different views for different phases or use cases
3. **View composition** - Could compose views for more complex transformations
4. **Static analysis** - Could use the view pattern to track which paths have been validated

## Conclusion

The ValidatedView pattern provides a pragmatic solution to the phase-boundary type safety problem. It acknowledges that TypeScript can't track cross-phase guarantees while providing a clean, composable way to assert those guarantees at runtime. The pattern is simple enough to understand and use, while being powerful enough to handle the complex recursive structures in the MIR.
