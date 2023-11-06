# Error Recovery: Reactive Values

Reactive values are _fallible_: they can be in an error state.

## `ReactiveResult<T>`

A `ReactiveResult` can be in one of two states:

```ts
interface Ok<T> {
  type: 'ok';
  value: T;
}
```

```ts
interface Error {
  type: 'error';
  value: UserException;
}
```

## `readReactive`

The `readReactive` function takes a reactive value and returns a `ReactiveResult`.

## `unwrapReactive`

The `unwrapReactive` function takes a `ReactiveResult` and returns its value, throwing an exception
if the reactive is an
