AST v2 enhances the original AST with a number of clarifying features.

# Blocks

All nodes that can have block parameters have a `table: BlockSymbolTable` property in `ASTv2`.

# Named Blocks

Elements that begin with a `:` are represented as `ASTv2.NamedBlock`.

# Components

Elements that satisfy the component heuristics are represented as `ASTv2.InvokeComponent`.

An element is a component if the part of its tag name before any `.`:

- begins with `@`
- is `this`
- is a reference to an in-scope binding
- begins with an uppercase letter

# Simple Elements

Elements that are not named blocks *and* do not satisfy the component heuristics are represented as `ASTv2.SimpleElement`.

# Strict vs. Loose Mode

The difference between strict and loose mode is entirely encapsulated in the `FreeVarReference`.

Consumers of `ASTv2` don't need to know whether they're looking at a "strict" or "loose" template. They just need to know how to handle the different contexts in `FreeVarReference`.

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

There are two significant differences between strict and loose mode that affect the AST.

In loose mode:

1. Certain free variable references fall back to a property lookup on `this`.
2. Free variable references in "call" positions are resolved using a contextual namespace. For example, the free variable reference `h` in `(h 123)` is resolved as `helper:h`. The free variable reference `h` in `<p {{h 123}}>` is resolved as `modifier:h`.

In strict mode, all free variable references refer to bindings provided by a JavaScript scope that the template will be embedded within.

To represent this difference, all `FreeVarReference` nodes in ASTv2 are tagged with a `FreeVarResolution`.

### Strict Variable Resolution

The `Strict` resolution applies to all free variables encountered while parsing a template in strict mode.

#### Runtime Error Cases

None. Strict mode templates must be embedded in a JavaScript context where all free variable references are in scope. A compile-time error should be produced if free there are variable references that do not correspond to any in-scope variables.

### Namespaced Variable Resolution

| | |
| - | - |
| Syntax Positions | `SubExpression`, `Block`, `Modifier`, `Component` |
| Path has dots? | ❌ |
| Arguments? | Any |
| | |
| Namespace | see table below |
| This fallback? | ⛔ |

These resolutions occur in syntaxes that are definitely calls (e.g. subexpressions, blocks, modifiers, etc.).

#### Applicable Situation

| situation | variable | namespace |
| - | - | - |
| `(x y)` | `x` | `Helper` |
| `{{#x y}}` | `x` | `Block` |
| `<p {{x y}}>` | `x` | `Modifier` |
| `X` in `<X />` | `X` | `Component` |

#### Runtime Error Cases

If the variable reference cannot be resolved in its namespace.

### Namespaced Resolution: Ambiguous Component or Helper

| | |
| - | - |
| Syntax Positions | append |
| Path has dots? | ❌ |
| Arguments? | ➕ |
| | |
| Namespace | `helper` or `component` |
| This fallback? | ⛔ |

This resolution occurs in append nodes with at least one argument, and when the path does not have dots (e.g. `{{hello world}}`).

#### Applicable Situation

| situation | variable | namespace |
| - | - | - |
| `{{x y}}` as append | `x` | `ComponentOrHelper` |

In this situation, the `x` may refer to:

- a helper `x`
- a component `x`

#### Runtime Error Cases

If the variable reference cannot be resolved in the `helper` or `component` namespaces.

### Ambiguous Resolution: Append Ambiguity

| | |
| - | - |
| Syntax Positions | append |
| Path has dots? | ❌ |
| Arguments? | ❌ |
| | |
| Namespace | `helper`, `component` |
| This fallback? | ✅ |

This resolution occurs in append nodes with zero arguments, and when the path does not have dots (e.g. `{{hello}}`).

#### Applicable Situations

| situation | variable | ambiguity |
| - | - | - |
| `{{x}}` as append | `x` | `Append` |

In this situation, the `x` may refer to:

- a helper `x`
- a component `x`
- a local variable in partial scope
- `this.x`.

#### Runtime Error Cases

None.

### Ambiguous Resolution: Attribute Ambiguity

This resolution context occurs in attribute nodes with zero arguments, and when the path does not have dots.

| | |
| - | - |
| Syntax Positions | attribute, interpolation |
| Path has dots? | ❌ |
| Arguments? | ❌ |
| | |
| Namespace | `helper` |
| This fallback? | ✅ |

#### Applicable Situations

| situation | variable | ambiguity |
| - | - | - |
| `<p attr={{x}}>` <br> `<a href="{{x}}.html">` | `x` | `Attr` |

In this situation, the `x` may refer to:

- a helper `x`
- a local variable in partial scope
- `this.x`.

#### Runtime Error Cases

None.

### Loose Free Variable Resolution

These resolution contexts occur in append or attribute nodes with zero positional or named arguments, and when the path has dots.

| | |
| - | - |
| Syntax Positions | append, attribute |
| Path has dots? | ➕ |
| Arguments? | ❌ |
| | |
| Namespace | None |
| This fallback? | ✅ |

#### Runtime Error Cases

None.

#### Applicable Situations

| situation | variable | resolution |
| - | - | - |
| `{{x.y}}` as append <br> `<p attr={{x.y}}>` <br> `<a href="{{x.y}}.html">` | `x` | `LooseFreeVariableResolution` |

In these situations, the `x` may refer to a local variable in partial scope, or it may refer to `this.x`.


### Summary

> These tables apply to situations where the head of the callee's path is a free variable. When the head is a local variable, it always uses strict resolution.

#### Syntax Errors 🙅‍♀️

Situations that meet all three of these criteria are syntax errors:

1. Unambiguous invocations
2. The callee contains a `.`
3. The head of the callee is a `FreeVarReference`

| Syntax Position | Example | Dots? | Arguments? |
| - | - | - | - |
| `Component` | `<X.y />` | ➕ | Any |
| `Modifier` | `<p {{x.y}} />` | ➕ | Any |
| `SubExpression` | `(x.y)` | ➕ | Any |
| `Block` | `{{#x.y}}` | ➕ | Any |
| `Append`, `Attribute` | `{{x.y z}}` | ➕ | ➕ |

#### Block, Component, Modifier, SubExpression

| | |
| - | - |
| Path has dots? | ❌ |
| Arguments? | Any |
| This fallback? | ⛔ |

| Syntax Position | Example || Namespace  |
| - | - | - | - | - | - |
| `Block` | `{{#x}}` || `block` |
| `Component` | `<X />` || `component` |
| `Modifier` | `<p {{x}} />`  || `modifier` |
| `SubExpression` | `(x)` || `helper` |

#### Append

| Syntax Position | Example | Dots? | Args? |  | Namespace | Fallback? |
| - | - | - | - | - | - | - |
| `Append` | `{{x}}`  | ❌ | ❌|| `helper`, `component` | ✅ |
| `Append` | `{{x.y}}`  | ➕ | ❌|| None | ✅ |
| `Append` | `{{x y}}`  | ❌ | ➕|| `helper`, `component` | ⛔ |

#### Attributes

The `Attribute` syntax position includes:

- the value of an HTML attribute (`href={{...}}`)
- the value of an element argument (`@title={{...}}`)
- a part of an interpolation (`href="{{...}}.html"`)

| Syntax Position | Example  | Dots? | Arguments?| | Namespace | Fallback? |
| - | - | - | - | - | - | - |
| `Attribute` | `href={{x}}`  | ❌ | ❌ || `helper` | ✅ |
| `Attribute` | `href={{x.y}}`  | ➕ | ❌ || None | ✅ |
| `Attribute` | `href={{x y}}`  | ❌ | ➕ || `helper` | ⛔ |
