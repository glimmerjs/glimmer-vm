The Glimmer strict mode is a subset of the classic Ember mode.

## Bare Identifiers Don't Fall Back to `this` Lookups

[Ember RFC #0308](https://emberjs.github.io/rfcs/0308-deprecate-property-lookup-fallback.html)

In Sloppy Mode:

- `<p>{{bareIdent}}</p>`
  - if `bareIdent` is in the local namespace, append it as content
  - if `bareIdent` is in the helper namespace, invoke it as a helper and append the result as content
  - if `bareIdent` is in the component namespace, invoke it as

## No Variable Namespaces

## Attributes are Attributes

# Classic Mode

|                         | local            | helper               | component            | modifier        | local.path       | unknown.path            | literal        |
| ----------------------- | ---------------- | -------------------- | -------------------- | --------------- | ---------------- | ----------------------- | -------------- |
| modifier `{{expr}}`     | ~~error~~        | ~~error~~            | ~~error~~            | eval > modifier | ~~error~~        | ~~error~~               | ~~error~~      |
| content `{{expr}}`      | eval > content   | (2) invoke > content | (1) eval > component | ~~error~~       | eval > content   | this-fallback > content | eval > content |
| `@name={{expr}}`        | eval > arg       | invoke > arg         | eval > arg           | eval > arg      | eval > arg       | this-fallback > arg     | eval > arg     |
| `name={{expr}}`         | eval > attr      | invoke > attr        | ~~error~~            | ~~error~~       | eval > attr      | this-fallback > attr    | eval > attr    |
| modifier `{{expr ...}}` | ~~error~~        | ~~error~~            | ~~error~~            | eval > modifier | ~~error~~        | ~~error~~               | ~~error~~      |
| content `{{expr ...}}`  | eval > component | (2) invoke > content | (1) eval > component | ~~error~~       | eval > component | this-fallback > content | ~~error~~      |
| `(expr ...)`            | ~~error~~        | invoke               | ~~error~~            | ~~error~~       | ~~error~~        | ~~error~~               | ~~error~~      |
| `@name={{expr ...}}`    | ~~error~~        | invoke > arg         | ~~error~~            | ~~error~~       | ~~error~~        | ~~error~~               | ~~error~~      |
| `name={{expr ...}}`     | ~~error~~        | invoke > attr        | ~~error~~            | ~~error~~       | ~~error~~        | ~~error~~               | ~~error~~      |
| `<expr ...>`            | eval > component | ~~error~~            | eval > component     | ~~error~~       | eval > component | ~~error~~               | ~~error~~      |

Production Definitions:

- `local`: a bound local variable or `@` name
- `helper`: a global variable in the helper namespace
- `component`: a global variable in the component namespace
- `modifier`: a global variable in the modifier namespace

> A global variable can be in more than one namespace at the same time. The (1), (2), (3) indicate
> the priority if a global variable is found in multiple namespaces.

Operation Definitions:

- `eval`: evaluate the expression into a value
- `invoke`: invoke the helper (with arguments) into a value
- `component`: invoke the component (with arguments) and insert it into the DOM
- `content`: insert the value as content
- `arg`: pass the value as a named argument
- `attr`: set the value as an attribute
- ~~error~~: illegal

# Bridge Mode

|                         | local                | helper                      | component                | modifier                 | local.path           | unknown.path                   | literal                  |
| ----------------------- | -------------------- | --------------------------- | ------------------------ | ------------------------ | -------------------- | ------------------------------ | ------------------------ |
| modifier `{{expr}}`     | eval > modifier      | ~~eval > modifier~~         | ~~eval > modifier~~      | eval > modifier          | eval > modifier      | eval > modifier                | ~~eval > modifier~~      |
| modifier `{{expr ...}}` | eval > modifier      | ~~eval > modifier~~         | ~~eval > modifier~~      | eval > modifier          | eval > modifier      | ~~error~~                      | ~~eval > modifier~~      |
| content `{{expr}}`      | eval > content       | (2) eval > invoke > content | (1) eval > content       | ~~eval > component~~     | eval > content       | this-fallback > content _(D1)_ | eval > content           |
| content `{{expr ...}}`  | eval > content       | (2) eval > content          | (1) eval > content       | ~~eval > content~~       | eval > component     | this-fallback > content _(D1)_ | ~~eval > content~~       |
| `<expr ...>`            | eval > component     | ~~eval > component~~        | eval > component         | ~~eval > component~~     | eval > component     | ~~error~~                      | ~~eval > component~~     |
| `(expr ...)`            | eval > invoke        | eval > invoke               | ~~eval > invoke~~        | ~~eval > invoke~~        | eval > invoke        | ~~error~~                      | ~~eval > invoke~~        |
| `@name={{expr}}`        | eval > arg           | eval > invoke > arg _(D2)_  | eval > arg               | eval > arg               | eval > arg           | this-fallback > arg _(D1)_     | eval > arg               |
| `@name={{expr ...}}`    | eval > invoke > arg  | eval > invoke > arg         | ~~eval > invoke > arg~~  | ~~eval > invoke > arg~~  | eval > invoke > arg  | ~~error~~                      | ~~eval > invoke > arg~~  |
| `name={{expr}}`         | eval > attr          | eval > invoke > attr _(D2)_ | ~~eval > attr~~          | ~~eval > attr~~          | eval > attr          | this-fallback > attr _(D1)_    | eval > attr              |
| `name={{expr ...}}`     | eval > invoke > attr | eval > invoke > attr        | ~~eval > invoke > attr~~ | ~~eval > invoke > attr~~ | eval > invoke > attr | ~~error~~                      | ~~eval > invoke > attr~~ |

The same name in multiple namespaces (situations where priorities are relevant) is deprecated.

Situations that have become semantically valid but which produce an error at runtime are marked like ~~eval > modifier~~. These situations technically change semantics from classic mode, but the practical result is going from one error to another.

- (D1) this-fallback is deprecated. any situation where `unknown.path` was an error in classic mode remains an error
- (D2) invoking helpers in argument position or attribute position is deprecated

# Strict Mode

|                         | expr                 |
| ----------------------- | -------------------- |
| modifier `{{expr ...}}` | eval > modifier      |
| content `{{expr ...}}`  | eval > content       |
| `<expr ...>`            | eval > component     |
| `(expr ...)`            | eval > invoke        |
| `@name={{expr}}`        | eval > arg           |
| `@name={{expr ...}}`    | eval > invoke > arg  |
| `name={{expr}}`         | eval > attr          |
| `name={{expr ...}}`     | eval > invoke > attr |
