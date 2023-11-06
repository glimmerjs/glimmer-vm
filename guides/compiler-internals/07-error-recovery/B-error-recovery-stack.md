# Error Recovery

Error recovery is a feature of the Glimmer VM that allows the VM to recover from errors in user code.

## Table of Contents

1. [Conceptually](#conceptually)
1. [Internal VM Pattern](#internal-vm-pattern)
1. [The Unwind Pointer](#the-unwind-pointer)
1. [The ErrorBoundary Internal Construct](#the-errorboundary-internal-construct)
1. [Modelled as a Conditional](#modelled-as-a-conditional)

## Conceptually

Conceptually, this feature makes it possible to create an unwind boundary in the VM. When an error occurs inside of an unwind boundary, the VM will clear its internal stack back to the unwind pointer.

## Internal VM Pattern

Internally, all objects that represent aspects of the runtime stack have the following methods:

```ts
interface VmStackAspect {
  begin(): this;
  catch(): this;
  finally(): this;

  onCatch?(callback: () => void): void;
  onFinally?(callback: () => void): void;

  readonly debug?: { frames: Array<DebugStackAspectFrame> };
}

type DebugStackAspectFrame =
  | { aspects: Record<string, DebugStackAspectFrame> }
  | { values: unknown[] };
```

Each of these methods returns a _snapshot_ of the current state of the stack. We call these
snapshots "transactions".

### Begin

When entering a block of code with error recovery, call `begin()` on each stack aspect and replace
the current instance of that aspect with the result of calling `begin()`.

### Catch

When an error occurs inside of a block of code with error recovery, call `catch()` on each stack aspect
and replace the current instance of that aspect with the result of calling `catch()`.

You can call `catch()` without balancing pops with pushes (that's the entire point). When you call
`catch()`, the stack aspect will return the state at the last `begin()` point.

### Finally

When you reach the end of a block of code with error recovery, call `finally()` on the stack aspect.
You must only call `finally()` after balancing pushes and pops.

### `onCatch` (optional)

Some stack aspects also implement `onCatch`. Any functions registered with `onCatch` will
automatically be invoked when `catch` occurs.

### `onFinally` (optional)

Some stack aspects also implement `onFinally`. Any functions registered with `onFinally` will
automatically be invoked when either `catch` or `finally` occurs.

### `debug` (in dev mode)

The `debug` property is a list of conceptual "frames". Each frame is a record of all of the stack aspects contained within the current stack
aspect. It is always present in dev mode (`import.meta.env.DEV`), and generally not present in prod.

The "leaf" aspects are stacks, and each frame in a stack is a list of the values for that stack.
The "parent" aspects are collections of aspects, and the frames _zip together_ the frames of
the children.
