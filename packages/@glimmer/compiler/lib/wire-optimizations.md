To reduce the size of the wire format, a number of special-purpose optimizations apply.

# Positions

There are a number of canonical positions referenced throughout this document.

1. Expression Position: Any `Expression` in the WireFormat
2. Content Position: The top-level of a `SerializedBlock`
3. Attribute Position:

# Flattening

## Paths

A path is represented like this:

```js
[
  32, // Op.GetPath
  [
    34, // Op.GetStrictFree
    1 // upvar number
  ],
  ["part1", "part2"]
]
```

Three flattening optimizations are allowed.

### 1. Op.GetPath Eliding

Rule: if the first part of a `TupleSyntax` is in the range of `GetHead` (`33` to `41`), and the size
of the `TupleSyntax` is larger than `2`, it is as-if nested inside of an `Op.GetPath`.

```js
[
  34, // Op.GetStrictFree
  1, // upvar number
  ["part1", "part2"]
]
```

### 2. Tail Flattening

Rule: if the last part of a `TupleSyntax` representing a path (including a path created by `GetPath`
eliding) is a string, then all of the elements of the `TupleSyntax` after the first two elements are
the `Tail` of the path.

Restriction: This flattening rule is only allowed if the last element of the `Tail` does not contain
a `.`.

```js
[
  32, // Op.GetPath
  [
    34, // Op.GetStrictFree
    1 // upvar number
  ],
  "part1", "part2"
]
```

### 2a. Combined

```js
[
  34, // Op.GetStrictFree
  1, // upvar number
  "part1",
  "part2"
]
```

### 3. Part Joining

Rule: if the last part of a `TupleSyntax` representing a path (including a path created by `GetPath`
eliding) is a string that ends with `.`, then that string represents a `.`-delimited sequence of
strings, which together form the `Tail`.

Restriction: This rule requires that the entire `TupleSyntax` is only three elements long.

```js
[
  32, // Op.GetPath
  [
    34, // Op.GetStrictFree
    1 // upvar number
  ],
  "part1.part2"
]
```

### 3a. Combined

```js
[
  34, // Op.GetStrictFree
  1, // upvar number
  "part1.part2"
]
```

### Packed Path Comparison

Before:

```js
[32,[34,1],["part1", "part2"]]
```

31 bytes.

After:

```js
[34,1,"part1.part2"]
```

21 bytes.

## Flattening Content-Level Instructions

```hbs
<use-the-platform><seriously-please data-foo='1'>Stuff <div>Here</div></seriously-please></use-the-platform>
```

```js
[
  [
    10, // OpenElement
    "use-the-platform"
  ],
  [
    12 // FlushElement
  ],
  [10, "seriously-please"],
  [
    14, // StaticAttr
    "data-foo", "1"
  ],
  [12],
  [
    1, // Append
    "Stuff "
  ]
  [10, "div"],
  [12],
  [1, "Here"],
  [13],
  [13],
  [13]
]
```

This optimization allows top-level flattening.

```js
[
  10,
  "use-the-platform",
  12,
  10,
  "seriously-please",
  [14,"data-foo","1"],
  12,
  1,
  "Stuff ",
  10,
  "div",
  12,
  1,
  "Here",
  13,
  13,
  13
]
```

Rule: The contents of content-level `TupleSyntax`es may be flattened.


### Result

```js
[[10,"use-the-platform"],[12],[10,"seriously-please"],[14,"data-foo","1"],[12],[1,"Stuff "],[10,"div"],[12],[1,"Here"],[13],[13],[13]]
```

```js
[10,"use-the-platform",12,10,"seriously-please",[14,"data-foo","1"],12,1,"Stuff ",10,"div",12,1,"Here",13,13,13]
```

# Eliminating `FlushElement`

The `FlushElement` instruction may be elided.

A decoder should insert a `FlushElement` instruction immediately upon encountering any Content-Level
node or a `CloseElement`.

# Shortening `null`

Whenever `null` appears in a position other than an expression position, it can be replaced with
`0`.

# Compacting `null`

# Packing Attributes



## 1. Static Attributes

