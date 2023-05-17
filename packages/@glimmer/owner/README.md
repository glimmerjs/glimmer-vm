The `@glimmer/owner` package provides shared constants that coordinate using a
global symbol.

This means that duplicates of `@glimmer/owner` are allowed. In general, you
should avoid importing this package into your application directly, as it can
create code bloat. Instead, import the relevant constants from `@glimmer/vm`.

> This is in contrast with the `@glimmer/vm-constants` package, which provides
> the values of primitive constants (strings and numbers), and can be duplicated
> freely.
