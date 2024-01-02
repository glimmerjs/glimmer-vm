# Frames and Blocks

Initial:

```clj
[
  (PushFrame)
  [
    (ReturnTo END)
    (Push ...Args)
    (Enter)
    [
      (Assertion) ; (JumpUnless) | (AssertSame)
      ...body
    ]
    (Exit)
    (Return)
    ; END
  ]
  (PopFrame)
]
```

Update:

```clj
[
  ; restore state
  (ReturnTo -1)
  (PushArgs ...Captured)
  (ReEnter)
  ; start evaluation here
  [
    (Assertion)
    ; (JumpUnless) | (AssertSame)
    ...body
  ]
  (Exit)
  (Return)
]
```

1. Initial
   1. PushFrame
   2. ReturnTo
   3. Push captured args
   4. Enter (optionally try frame)
   5. Assertion
      a. `JumpUnless` -> target
      b. `AssertSame`
   6. (body)
   7. Exit
   8. Return
   9. PopFrame
2. Update (from 1.5)
