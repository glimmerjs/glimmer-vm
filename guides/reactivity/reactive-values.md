# Reactive Values

To allow developers to reason about reactive composition, developers typically interact with
[_tags_](./concepts.md#tags) through higher-level abstractions that represent _reactive values_.

While reactive tags describe the formal _composition_ semantics of the Glimmer system, "Reactive
Values" describe the rules that higher-level abstractions must follow in order to allow developers
to safely reason about reactive composition.


## The Fundamental Axiom of Reactivity

### A reactive computation should invalidate whenever the reactive values it used to compute its output have changed.

From the perspective of a Glimmer user, this allows them to write reactive code that is composed of
normal JavaScript functions and getters, and expect their output to reliably reflect the state of
the reactive inputs to their UI.

> [!TIP]
>
> A Glimmer user should be able to write their UI **as if it were a one-off rendering function**, and
> expect it to behave _as if_ that rendering function was running from top-to-bottom whenever any
> reactive values in their program change.

## Definitions

- **Reactive Value**: a JavaScript abstraction that returns a value when accessed, and invalidates
when the value changes.
  - **Cell** (mutable): A root, atomic reactive value that can be updated directly. It is
    represented by a single [value tag](./concepts.md#value-tag).
  - **Formula** (readonly): A reactive value that represents a computation. It is represented by the
    [combined tag](./concepts.md#combined-tag) whose members are the tags of the reactive values
    accessed during the last computation.
- **Invalidate**: <a id="invalidate"></a> a computation "invalidates" when it was originally computed in the context of a
  [tracking frame](./concepts.md#tracking-frame) and the tracking frame invalidates.

## The Fundamental Laws of Reactivity

In order to satisfy the _Fundamental Axiom of Reactivity_, a reactive value must enforce the following
laws:

1. **Invalidation**: A reactive abstraction **must** [invalidate](#invalidate) when the reactive values
   it used in its _last computation_ have changed.
2. **Granularity**: A reactive abstraction **must** specify a contract that defines the _granularity_ of
   invalidation, and **must not** invalidate more frequently than the contract allows. 
3. **Transactionality**: A reactive value should return an equivalent value every time it is
   accessed **during a single rendering transaction**.
4. **Readonly**: A reactive value **must not** update any value tags purely as a result of being
   accessed, including during initialization.
5. **Equivalence**: When a reactive abstraction allows consumers to **set** a value, it must specify
   how the value is compared to the previous value for equivalence. When the new value is equivalent
   to the previous value, the reactive abstraction **must not** invalidate.

Built-in abstractions such as `@tracked` and `createCache`, existing libraries like
`tracked-toolbox` and `tracked-builtins`, and new abstractions like `cell` must satisfy these laws
in order for the reactivity axiom to hold when composing these abstractions together.

> [!TIP]
>
> In practice, the fundamental axiom of reactivity is limited by the granularity and equivalence
> specification of the reactive abstractions that are used to compose higher-level abstractions.
>
> For example, if a [`cell`](#cell) specifies that it will invalidate whenever the value's JSON
> serialization changes, then any higher-level abstractions that use the cell will also invalidate
> only when the value's JSON serialization changes. 
>
> It does not, however, require us to compare the values of every _computation_, nor does it impose 
> a one-size-fits-all requirement that reactive abstractions invalidate based on the reference
> equality of the value.

### Ember's Backtracking Rerender Assertion

Ember's backtracking rerender assertion is a development-mode assertion that fires whenever a tag
that was previously consumed in the same rendering transaction is updated before the rendering
transaction has completed.

It is used as a building block in all higher-level abstractions to satisfy the _Transactionality_
requirement.

### `@tracked`

The `@tracked` accessor creates a single reactive value that that is accessed and mutated through a
JavaScript property. It satisfies the _Fundamental Axiom of Reactivity_:

1. **Invalidation**: Since `@tracked` wraps a single cell, this requirement is satisfied by directly
   invalidating the cell's value tag when the property is set.
2. **Granularity**: The `@tracked` accessor is specified to invalidate whenever the property is
   set, regardless of previous or subsequent value.
3. **Transactionality**: This requirement is satisfied in Ember by Ember's "backtracking rerender
   assertion." This assertion ensures that once a reactive value has been _read_ during a
   rendering transaction, it cannot be updated again during the same transaction.
4. **Readonly Access**: The implementation of `@tracked` _consumes_ a value tag when the property is read,
   and doesn't _update_ any tags.
5. **Equivalence**: When the property is set, the new value is _never_ considered equivalent to the
   previous value, which means that the tag associated with the property will _always_ invalidate.

<details>
<summary>Pseudo-Implementation of <code>@tracked</code></summary>

```ts
export function tracked(_value, context) {
  context.addInitializer(function () {
    ValueTag.init(this, context.name);
  });

  return {
    get() {
      const tag = ValueTag.get(this, context.name);
      tag.consume();
      return context.access.get(this);
    },

    set(value) {
      const tag = ValueTag.get(this, context.name);
      context.access.set(this, value);
      tag.update();
    },
  };
}
```

</details>

### `Cell`

The new `Cell` API satisfies the _Fundamental Axiom of Reactivity_:

1. **Invalidation**: Since `cell` wraps a single cell, this requirement is satisfied by directly
   invalidating the cell's value tag when the property is set.
2. **Granularity**: The `cell` API is specified to invalidate whenever the property is changed to a
   value that is not _equivalent_ to the previous value.
3. **Transactionality**: Like `@tracked`, this requirement is satisfied in Ember by Ember's
   "backtracking rerender assertion." This assertion ensures that once a reactive value has been
   _read_ during a rendering transaction, it cannot be updated again during the same transaction.
4. **Readonly**: The implementation of `cell` _consumes_ a value tag when the property is read,
   and doesn't _update_ any tags.
5. **Equivalence**: When the cell is set, the new value is compared to the previous value for
   equivalence using the specified `equals` function. When the new value is equivalent to the
   previous value, the cell's tag will _not_ invalidate.

<details>
<summary>Pseudo-Implementation of the <code>cell</code> constructor</summary>

```ts
export function cell(value, { equals = Object.is } = {}) {
  const tag = ValueTag.init(this, 'value');

  return {
    get() {
      tag.consume();
      return value;
    },

    set(newValue) {
      if (!equals(value, newValue)) {
        value = newValue;
        tag.update();
      }
    },
  };
}
```

</details>

### The `createCache` Primitive API

The `createCache` primitive API satisfies the _Fundamental Axiom of Reactivity_:

1. **Invalidation**: The cache's _computation_ uses `begin()` and `commit()` to automatically track
   the reactive values used in the computation. Since the tag returned by `commit` produces the
   maximum revision of its members, the cache will invalidate whenever any of the reactive values
   used in the computation have changed.
2. **Granularity**: The granularity of the `createCache` API is defined transitively: the cache will
   invalidate at the same granularity as its members.
3. **Transactionality**: Whenever the cache is read during a rendering transaction, it consumes a
   tag composed of the tags used in the computation. This is true whether the cache was valid or
   invalid (see the pseudo-implementation below). Since Ember's backtracking rerender assertion
   fires whenever a tag that was previously consumed is updated, this requirement is satisfied.
4. **Readonly**: The implementation of `createCache` _consumes_ a value tag when the property is read,
   and doesn't _update_ any tags.

<details>
<summary>Pseudo-Implementation of <code>createCache</code></summary>

```ts
const COMPUTE = new WeakMap();

export function createCache(fn) {
  const cache = {};
  let last = undefined;

  COMPUTE.set(cache, () => {
    if (last && last.revision >= last.tag.revision) {
      runtime.consume(last.tag);
      return last.value;
    }

    runtime.begin();
    try {
      const result = fn();
      const tag = runtime.commit();
      runtime.consume(tag);
      last = { value: result, tag, revision: runtime.current() };
      return result;
    } catch {
      last = undefined;
    }
  });

  return cache;
}

export function getCache(cache) {
  const fn = COMPUTE.get(cache);

  if (!fn) {
    throw new Error('You must only call `getCache` with the return value of `createCache`');
  }

  return fn();
}
```

</details>


### The `TrackedMap` API

The `TrackedMap` API satisfies the _Fundamental Axiom of Reactivity_:

1. **Invalidation**: 

## More Interesting Abstractions

There are a number of more interesting abstractions that require some form of `peek` operation,
which is not inherently safe. However, we can define fairly general primitives using `peek` under
the covers that still satisfy the _Fundamental Laws of Reactivity_.

In order to accomplish this, we will need to ensure that any `peek` operations are used to produce
the same value, regardless of whether the abstraction is valid or invalid, and regardless of whether
this is the first time the value is being read or a subsequent read.

### Example: `localCopy`

A `localCopy` primitive computes a value, and returns that value _until_ the local copy of the value
is updated. At that point, the abstraction will return the _updated_ value _until_ the original
computation is invalidated, at which point the abstraction will return the original value again.

> [!NOTE]
> 
> The `tracked-toolbox` library provides a `localCopy` decorator that works in this way. The
> canonical use-case of `localCopy` is a component that takes a `@text` argument, but allows the
> user to update the local copy via a text box. If the upstream value changes, the text box will be
> reset to match the upstream value.

The `localCopy` primitive is defined as a composition of:

1. A `createCache` primitive that computes the original value (the "upstream computation").
2. A `cell` primitive that stores the local copy of the value as either uninitialized or initialized
   with a value.

When the `localCopy` primitive is read and the upstream computation invalidates, the local copy must
be reset to uninitialized _without_ causing the backtracking rerender assertion to observe a
mutation to a member of the primitive that occurs _after_ the primitive was consumed. In other
words, we will need to ensure that **the `localCopy` primitive satisfies the _Transactionality_
requirement**.

The `localCopy` primitive satisfies the _Fundamental Axiom of Reactivity_:

1. **Invalidation**: The `localCopy` primitive invalidates when the original computation is
   invalidated _or_ when the local copy has been updated.
2. **Granularity**: The granularity of the `localCopy` primitive is defined transitively: the
   primitive will invalidate at the same granularity as its members, as well as when the .
3. **Transactionality**: Whenever the `localCopy` primitive is read during a rendering transaction,
   it consumes a tag composed of the tags used in the computation. This is true whether the
   primitive was valid or invalid (see the pseudo-implementation below). Since Ember's
   backtracking rerender assertion fires whenever a tag that was previously consumed is updated,
   this requirement is satisfied.
4. **Readonly**: The implementation of `localCopy` _consumes_ a value tag when the property is read,
   and doesn't _update_ any tags.
5. **Equivalence**: When the local copy is updated, the new value is _never_ considered equivalent to
   the previous value, which means that the primitive will _always_ invalidate.

### A `localCopy` Primitive

A primitive that behaves like
[`localCopy`](https://github.com/tracked-tools/tracked-toolbox?tab=readme-ov-file#localcopy) in
`tracked-toolbox`.

This example is based on the `tracked-toolbox` documentation, but uses a hypothetical `localCopy`
primitive rather than a decorator for simplicity. It would be straight-forward to implement a
decorator version of `localCopy` in terms of the primitive described here.

```ts
export default class CustomInput extends Component {
  // This defaults to the value of this.args.text
  text = localCopy(() => this.args.text)

  @action
  updateText({ target }) {
    // this updates the value of `text`, but does _not_ update
    // the value of `this.args.text`
    this.text.write(String(target.value));

    if (this.args.onInput) {
      // this action could then update the upstream value
      this.args.onInput(this.text.read());
    }
  }
}
```

The `localCopy` primitive satisfies the _Fundamental Axiom of Reactivity_:


