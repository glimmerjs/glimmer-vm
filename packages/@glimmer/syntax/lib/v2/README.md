AST v2 enhances the original AST with a number of clarifying features.

# Blocks

All nodes that can have block parameters have a `table: BlockSymbolTable` property in `ASTv2`.

# Named Blocks

Elements that begin with a `:` are represented as `ASTv2.NamedBlock`.

# Components

Elements that satisfy the component heuristics are represented as `ASTv2.Component`.

An element is a component if the part of its tag name before any `.`:

- begins with `@`
- is `this`
- is a reference to an in-scope binding
- begins with an uppercase letter

# Simple Elements

Elements that are not named blocks *and* do not satisfy the component heuristics are represented as `ASTv2.SimpleElement`.

# Strict vs. Sloppy Mode

The difference between strict and sloppy mode is entirely encapsulated in the `FreeVarReference`.

Consumers of `ASTv2` don't need to know whether they're looking at a "strict" or "sloppy" template. They just need to know how to handle the different contexts in `FreeVarReference`.

## Variable References

In `ASTv2`, every variable name is represented as a `VariableReference`.

> The first part of a `PathExpression` is a `VariableReference`.

| type | description |
| --- | --- |
| `ThisReference` | the literal `this` |
| `ArgReference` | a variable reference that begins with with `@` |
| `LocalVarReference` | a reference to an in-scope variable binding |
| `FreeVarReference` | a reference to a variable binding that is not in-scope |

### Free Variable References

There are two significant differences between strict and sloppy mode that affect the AST.

In sloppy mode:

1. Certain free variable references fall back to a property lookup on `this`.
2. Free variable references in "call" positions are resolved using a contextual namespace. For example, the free variable reference `h` in `(h 123)` is resolved as `helper:h`. The free variable reference `h` in `<p {{h 123}}>` is resolved as `modifier:h`.

In strict mode, all free variable references refer to bindings provided by a JavaScript scope that the template will be embedded within.

To represent this difference, all `FreeVarReference` nodes in ASTv2 are tagged with a `VariableResolutionContext`.

### Strict Resolution Context

The `Strict` resolution context applies to all free variables encountered while parsing a template in strict mode.

#### Runtime Error Cases

None. Strict mode templates must be embedded in a JavaScript context where all free variable references are in scope. A compile-time error should be produced if free there are variable references that do not correspond to any in-scope variables.

### Unambiguous Call Resolution Contexts

These resolution contexts occur in unambiguous call nodes.

| | |
| - | - |
| Path has dots? | ❌ |
| This fallback? | ❌ |

#### Runtime Error Cases

If the variable reference cannot be resolved in its namespace.

#### Applicable Situation

| situation | variable | name |
| - | - | - |
| `(x y)` | `x` | `ResolveAsCallHead` |
| `{{#x y}}` | `x` | `ResolveAsBlockHead` |
| `<p {{x y}}>` | `x` | `ResolveAsModifierHead` |
| `X` in `<X />` | `X` | `ResolveAsComponentHead` |
| `{{x y}}` as append | `x` | `AmbiguousAppendInvoke` |

A node is an unambiguous call node if:

- it has at least one positional or named argument
- it is a component invocation
- it is a modifier invocation
- it is a subexpression

> Note `{{x y}}` in content is ambiguous because it could be a component or a helper.

### Sloppy Free Variable Resolution Contexts

These resolution contexts occur in append or attribute nodes (`MustacheStatement` in `ASTv1`) with zero positional or named arguments, and when the path has dots.

| | |
| - | - |
| Path has dots? | ✅ |
| Has arguments? | ❌ |
| This fallback? | ✅ |

#### Runtime Error Cases

None.

#### Applicable Situations

| situation | variable | name |
| - | - | - |
| `{{x.y}}` as append <br> `<p attr={{x.y}}>` <br> `<a href="{{x.y}}.html">` | `x` | `SloppyFreeVariable` |

In these situations, the `x` may refer to a local variable in partial scope, or it may refer to `this.x`.

### Ambiguous Append Context

This resolution context occurs in append nodes with zero arguments, and when the path does not have dots.

| | |
| - | - |
| Path has dots? | ❌ |
| Has arguments? | ❌ |
| This fallback? | ✅ |

#### Runtime Error Cases

None.

#### Applicable Situations

| situation | variable | name |
| - | - | - |
| `{{x}}` as append | `x` | `AmbiguousAppend` |

In this situation, the `x` may refer to:

- a helper `x`
- a component `x`
- a local variable in partial scope
- `this.x`.

### Ambiguous Attr Context

This resolution context occurs in attribute nodes with zero arguments, and when the path does not have dots.

| | |
| - | - |
| Path has dots? | ❌ |
| This fallback? | ✅ |

#### Runtime Error Cases

None.

#### Applicable Situations

| situation | variable | name |
| - | - | - |
| `<p attr={{x}}>` <br> `<a href="{{x}}.html">` | `x` | `AmbiguousAttr` |

In this situation, the `x` may refer to:

- a helper `x`
- a local variable in partial scope
- `this.x`.

### No-Resolver Situations

In sloppy mode, there are free variables that have no `VariableResolutionContext` and therefore cannot be resolved. These situations are a syntax error.

#### Component Paths

```hbs
{{! error }}
<x.y />
```

The `x` at the start of the component path is a free variable with no syntactic context.

However, the following is not a syntax error, because `x` is a `LocalVarRef`, not a `FreeVarRef`.

```hbs
{{#let @something as |x|}}
  <x.y />
{{/let}}
```

#### Modifier Paths

```hbs
{{! error }}
<p {{x.y}} />
```

The `x` at the start of the modifer path is a free variable with no syntactic context.

However, the following is not a syntax error, because `x` is a `LocalVarRef`, not a `FreeVarRef`.

```hbs
{{#let @something as |x|}}
  <p {{x.y}} />
{{/let}}
```
