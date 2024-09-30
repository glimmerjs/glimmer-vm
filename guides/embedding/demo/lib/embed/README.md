The files in this directory are good baseline implementations of a Glimmer environment that isn't
attempting to maintain compatibility with subtle behaviors.

In practice, this means:

1. Property gets and sets are implemented as standard JavaScript `[[Get]]` and `[[Set]]` operations.
2. Conditional operations (e.g. `{{#if}}`) are implemented in terms of JavaScript truthiness.
3. Iteration (e.g. `{{#each}}`) is implemented in terms of JavaScript iterables.
4. Debug assertions throw errors.
5. Deprecations log warnings.
