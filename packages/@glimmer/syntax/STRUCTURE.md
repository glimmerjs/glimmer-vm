The `@glimmer/syntax` package is fairly large, so there is some internal structure that makes boundaries across sub-directories easier to understand.

This structure also makes it possible to control cycles, by guaranteeing that a single file can control the order in which modules in a cycle are evaluated.

The basics of the original approach are from a [blog post][blog-post] by Michael Westrate.

[blog-post]: https://medium.com/visual-development/how-to-fix-nasty-circular-dependency-issues-once-and-for-all-in-javascript-typescript-a04c987cf0de

# Special Modules

## The `-internal` Module

Each directory has an `-internal.ts` file, which `*` exports all of the named exports from its sibling modules.

Modules should always import from `./-internal` or the `-internal` module in a parent directory.

## The `-index` Module

The `-index.ts` module in each file re-exports only the things that parent directories will need. This keeps the number of modules "in scope" to a reasonable number, especially at the top-level of the package.

## Nested Directories

The `-internal.ts` module in a directory that contains other directories should `*` export the names in the nested `-index.ts` files.

# Sub-Packages

The best way to think about this structure is that it creates a structure that approximates sub-packages by:

- having each directory expose a public interface through `-index.ts`.
- disallowing directories from reaching directly into child directories.

The `-internals.ts` files exist for two reasons:

1. Primarily, to make it possible to control the exact paths that imports take, making it possible to control the order of evaluation in module cycles.
2. To create a consistent, visually identifiable pattern of consuming modules to make it easier to spot mistakes.

Ultimately, we should probably break this package up into smaller packages, but we don't need to do that immediately.
