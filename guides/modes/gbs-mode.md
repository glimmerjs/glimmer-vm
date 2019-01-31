## Variable Namespaces

In classic mode, all variable bindings are in one of the following namespaces:

- `local`, for variables that are bound syntactically (through `as |name|` or `@name` arguments)
- `global-helper`, for names that resolve to a global helper
- `global-component`, for names that resolve to a global component
- `global-modifier`, for names that resolve to a global modifier

If a name is in the `local` namespace, it is not in any other namespace. Otherwise, a name can be in more than one namespace.

The first part of a path is in a namespace, but the entire path is not.

## Syntactic Conventions

When describing the implementation of a piece of Glimmer syntax, the spec signature is written as the literal form of that syntax, using `%xxx%` to template the syntax. In particular, `%xxx%` binds the name `xxx` to the syntactic production `xxx`.

For example, `{{%expression%}}` means "the curly syntax containing a single expression, and the implementation body of this syntax refers to the syntax as `expression`".

The syntactic production used in this spec are:

- `ident` (a bare identifier)
- `arg` (an identifier prefixed with `@`)
- `variable` (an `ident` or `arg`)
- `path` (a variable followed by one or more repeated `.` `ident`)
- `tail` (zero or more `ident`s, separated by `.`)
- `literal` (numbers, strings, booleans, `null`, and `undefined`)
- `...args` (any number of positional arguments followed by any number of named arguments, `name=value`)
- `...component-args` (any number of component arguments, `@name={{value}}`)
- `...blocks` (any number of blocks)
- `expression` (any expression)

In the spec body after the signature, `xxx` refers to the syntax, and `xxx!` means "evaluate the production xxx`.

## Abstract Algorithms

### in-ns(name, ns)

1. If `name` is in the `ns` namespace, return true
2. Otherwise, return false

### triage-and-append(value)

1. If `value` is a component, `run-component(value)`
2. Otherwise, if `value` is a helper, `invoke-helper(value)`
3. Otherwise, `append-as-content(value)`

### run-component(component, component-args)

Internal operation: Invoke the component `component` with arguments `component-args`.

### invoke-helper(helper, arg-list)

Internal operation: Invoke the helper `helper` with arguments `arg-list`.

### append-as-content(value)

1. If value is a string, append value to the current element as a text node
2. If value is a safe string, append value to the current element as html
3. If value is a node, append value to the current element
4. If value is a component, `run-component(component, [])`

## Cases

### Content Position (ambiguous): `{{%expression%}}`

#### `{{%variable%}}`

1. If `in-ns(variable, "local")`, `triage-and-append(variable!)`
2. If `in-ns(variable, "component")`, `run-component(variable!)`
3. If `in-ns(variable, "helper")`, `invoke-helper(variable!)`
4. If `in-ns(variable, "modifier")`, early error
5. Otherwise, `triage-and-append(get(this, variable))` <sup>[^this-fallback](#this-fallback)</sup>

#### `{{%variable% . %tail%}}`

1. if `in-ns(variable, "local")`, `triage-and-append(get-path(variable!, tail))`
2. Otherwise, `triage-and-append(get-path(get(this, variable!), tail))`<sup>[^this-fallback](#this-fallback)</sup>

#### `{{%literal%}}`

1. `append-as-content(expression!)`

### Content Position (invocation): `{{%expression% ...args}}`

#### `{{%variable% ...args}}`

1. if `in-ns(variable, 'local')`, `run-component(variable!, ...args!)`
2. if `in-ns(variable, 'component')`, `run-component(variable!, ...args!)`
3. if `in-ns(variable, 'helper')`, `append-as-content(invoke-helper(variable!, ...args!))`
4. if `in-ns(variable, 'modifier')`, early error
5. Otherwise, early error<sup>[^not-this-fallback](#not-this-fallback)</sup>

#### Literal Invocation: `{{%literal% ...args}}`

1. early error

### Block Invocation `{{#%expression% %...args% %...blocks%}}

#### `{{%variable% %...args% %...blocks%}}

### Angle Bracket Invocation: `<%expression% %...component-args% %...blocks% />`

#### `<%variable% %...component-args% %...blocks%>`

1. if `in-ns(variable, 'local')`, `run-component(variable!, component-args!, blocks!)`
2. if `in-ns(variable, 'component')`, `run-component(variable!, component-args!, blocks!)`
3. Otherwise, early error<sup>[^not-this-fallback](#not-this-fallback)</sup>

#### `<%path% %...component-args% %...blocks%>`

1. `run-component(path!, component-args!, blocks!)`

#### `<%literal% ...>`

1. Syntax error

### Argument Position (Bare): `@name={{%expression%}}`

#### `@%ident%={{%variable%}}`

1. if `in-ns(variable, 'local')`, pass variable! as the named argument ident
2. if `in-ns(variable, 'helper')`, pass `invoke-helper(variable!)` as the named argument ident
3. otherwise, pass `get(this, variable)` as the named argument ident <sup>[^this-fallback](#this-fallback)</sup>

#### `@%name: ident%={{%head: ident% . %tail%}}`

1. if `in-ns(ident, 'local')`, pass `get-path(head!, tail)`
2. otherwise, pass `get-path(get(this, head), tail)` <sup><sup>[^this-fallback](#this-fallback)</sup>(#this-fallback)</sup>

#### `@%ident%={{%literal%}}`

1. pass literal! as the named argument ident

### Argument Position (Invocation): `@name={{%expression% %...args%}}`

TL;DR: only global helpers work here

#### `@%ident%={{%variable% %...args%}}`

1. if `in-ns(variable, 'local')`, early error
2. if `in-ns(variable, 'helper')`, pass `invoke-helper(variable!, args!)` as the named argument ident
3. otherwise, early error<sup>[^not-this-fallback](#not-this-fallback)</sup>

#### `@%ident%={{%path% %...args%}}`

1. early error<sup>[^not-this-fallback](#not-this-fallback)</sup>

#### `@%ident%={{%literal% %...args%}}`

1. early error

### Attribute Position (Bare): `@name={{%expression%}}`

#### `%ident%={{%variable%}}`

1. if `in-ns(variable, 'local')`, `set-attribute(ident, variable!)`
2. if `in-ns(variable, 'helper')`, `set-attribute(ident, invoke-helper(variable!))`
3. otherwise, `set-attribute(ident, get(this, variable))` <sup>[^this-fallback](#this-fallback)</sup>

#### `@%name: ident%={{%head: ident% . %tail%}}`

1. if `in-ns(ident, 'local')`, `set-attribute(name, get-path(head!, tail))`
2. otherwise, pass `set-attribute(name, get-path(get(this, head), tail))` <sup>[^this-fallback](#this-fallback)</sup>

#### `@%ident%={{%literal%}}`

1. `set-attribute(ident, literal!)`

### Attribute Position (Invocation): `%ident%={{%expression% %...args%}}`

TL;DR: only global helpers work here

#### `%ident%={{%variable% %...args%}}`

1. if `in-ns(variable, 'local')`, early error
2. if `in-ns(variable, 'helper')`, pass `set-attribute(ident, invoke-helper(variable!, args!))`
3. otherwise, early error<sup>[^not-this-fallback](#not-this-fallback)</sup>

#### `%ident%={{%path% %...args%}}`

1. early error<sup>[^not-this-fallback](#not-this-fallback)</sup>

#### `%ident%={{%literal% %...args%}}`

1. early error

### Subexpressions `(%expression% %...args%)`

#### `(%variable% %...args%)`

1. if `in-ns(variable, 'local')`, early error
2. if `in-ns(variable, 'helper')`, `invoke-helper(variable, args)`

#### `(%path% %...args%)`

1. early error

#### `(%literal% %...args%)`

1. early error

## Summary Table

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

## Footnotes

<a name="this-fallback">^this-fallback</a>: This syntax falls back to looking up the property on `this`</a>

<a name="not-this-fallback">^not-this-fallback</a>: This syntax does not fall back to looking up the property on `this`
