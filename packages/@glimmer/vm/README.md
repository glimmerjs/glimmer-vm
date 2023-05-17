`@glimmer/vm` is an all-encompassing standalone package used for embedding the Glimmer VM into framework environments.

It includes:

- `@glimmer/validator`
- `@glimmer/opcode-compiler`
- `@glimmer/runtime`
- `@glimmer/manager`

It does not include `@glimmer/interfaces` directly, although it re-exports types that are relevant to embedders.

It also does not include several packages that provide interfaces for interacting with shared symbols or WeakMaps. These packages are peer dependencies of `@glimmer/vm`.

- `@glimmer/vm-constants`
- `@glimmer/owner`
- `@glimmer/manager`

It also doesn't include several parts of the current public interfaces, because they have been superseded by the new build process.

- `@glimmer/env`

It also doesn't include the precompiler infrastructure:

- `@glimmer/syntax`
- `@glimmer/compiler`
