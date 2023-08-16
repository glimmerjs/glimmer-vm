# Reactivity APIs

## Generic APIs

## `readReactive`

| Takes              | Returns                       |
| ------------------ | ----------------------------- |
| 🟢🟡 Fallible Read | 🟡 Result _(throws ⚪ Never)_ |

The `readReactive` function takes a reactive value and returns a `ReactiveResult`.

## `unwrapReactive`

The `unwrapReactive` function takes a `ReactiveResult` and returns its value, throwing an exception
if the reactive produces an error (or was previously an error).

| Takes              | Returns                              |
| ------------------ | ------------------------------------ |
| 🟢🟡 Fallible Read | 🟢 Value _(throws 🔴 UserException)_ |

## `updateReactive`

The `updateReactive` function takes a _mutable_ reactive and a new value and updates it. You cannot
pass an immutable reactive to this function.

| Takes      | Updates                  |
| ---------- | ------------------------ |
| 📝 Mutable | 🟢 Value _(or 🔴 Error)_ |

## Cell APIs

### Constructors

```ts
function Cell(value: T): MutableCell<T>;
function ReadonlyCell(value: T): ReadonlyCell<T>;

type Cell<T> = MutableCell<T> | ReadonlyCell<T>;
```

| Type              | Read     | Write        |
| ----------------- | -------- | ------------ |
| `Cell<T>`         | 🟢 Value | 📝 Mutable   |
| `ReadonlyCell<T>` | 🟢 Value | 🚫 Immutable |

### `readCell`

```ts
export function readCell<T>(cell: Cell<T>): T;
```

The `readCell` function takes a cell and returns its value. Since cells are infallible, you can use
this function to read from a cell without risking an exception (as with `unwrapReactive`).

### `writeCell`

```ts
export function writeCell<T>(cell: MutableCell<T>, value: T): void;
```

| Takes            | Updates  |
| ---------------- | -------- |
| 📝 Mutable Write | 🟢 Value |

The `writeCell` function writes a new value to a mutable cell. You can't write to a readonly cell.

## Formula APIs

| Type          | Read      | Write        |
| ------------- | --------- | ------------ |
| `Accessor<T>` | 🟡 Result | 📝 Mutable   |
| `Formula<T>`  | 🟡 Result | 🚫 Immutable |

### Constructors

```ts
export function Formula<T>(compute: () => T): Formula<T>;
export function Accessor<T>(options: { get: () => T; set: (value: T) => void }): Accessor<T>;
```

If an accessor's `set` throws an error, the reactive value will become an error.

## External Markers

External markers are not reactive values themselves. Instead, they _stand in_ for external storage.

Here's an example using a `SimpleMap` class that uses a `Map` as its backing storage:

```ts
class SimpleMap<K, V> {
  #markers = new Map<K, ExternalMarker>();
  #values = new Map<K, V>();

  get(key: K): V {
    this.#initialized(key).consumed();
    return this.#values.get(key);
  }

  has(key: K) {
    this.#initialized(key).consumed();
    return this.#values.has(key);
  }

  set(key: K, value: V) {
    this.#initialized(key).updated();
    this.#values.set(key, value);
  }

  #initialized(key: K) {
    let marker = this.#markers.get(key);

    if (!marker) {
      marker = ExternalMarker();
      this.#markers.set(key, marker);
    }

    return marker;
  }
}
```

Now, reads from `has(key)` or `get(key)` will be invalidated whenever `set(key, value)` is called on
the same key.

The crux of the situation is that we don't want to store every value in a Cell and turn every
computation into a `Formula`. Instead, we want to store our data in normal JavaScript data
structures and notify the reactivity system whenever the data is accessed or modified.

## Internal Reactives

### `ComputedCell`

A `ComputedCell` behaves like a cell, but it uses a `compute` function to compute a new value. The
`compute` function must be infallible, and there is no error recovery if it fails.

| Type              | Read     | Write        |
| ----------------- | -------- | ------------ |
| `ComputedCell<T>` | 🟢 Value | 🚫 Immutable |
