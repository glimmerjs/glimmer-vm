# Classic Helpers

These helpers interact with the classic object model and would not be necessary in the absence of the classic object model.

This only includes features that users can avoid using (such as the `[]` property), but not features like routes, which implicitly depend on the classic object model but can't currently be avoided.

## `-track-array`

This helper is used to track a `[]` property.

## `mut`

This helper exposes a mutable property to classic components so that it can be two-way bound. It has no behavior outside of classic components.

## `readonly`

This helper disconnects a two-way binding from a reference so it can't be bound to a classic component. Since Glimmer components don't receive two-way bindings, this is a noop unless using classic components.

## `unbound`

This helper copies a value from an internal reference and prevents future updates. It is not necessary when using Glimmer components, as values can be extracted from `args` using normal JavaScript.

We might keep this around as a convenience, but it shouldn't require deep access to Glimmer internals.
