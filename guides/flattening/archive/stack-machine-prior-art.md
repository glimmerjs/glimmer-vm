# Stack Machine Prior Art

How do successful stack machines handle function calls and argument cleanup?

## WebAssembly

WebAssembly has the cleanest model for our purposes:

```wasm
(func $add (param i32 i32) (result i32)
  local.get 0
  local.get 1
  i32.add)
```

- Functions declare their arity (param count) and result count
- Calling a function automatically pops the expected arguments
- Function pushes its results
- Stack is clean after call

For `add(1, 2)`:
```
push 1      [1]
push 2      [1, 2]
call $add   [] -> [3]  // Pops 2, pushes 1
```

## Forth

Forth uses explicit stack manipulation:

```forth
: add ( n1 n2 -- sum )
  + ;

1 2 add  ( leaves 3 on stack )
```

- Comments show stack effect: `( before -- after )`
- Functions consume arguments, leave results
- No automatic cleanup - functions must consume what they need

## JVM

Java bytecode uses typed instructions with known arity:

```
iconst_1      // push 1
iconst_2      // push 2  
iadd          // pop 2, push 1
```

Method calls use frames but simpler than Glimmer:
```
aload_0       // push 'this'
ldc "hello"   // push string
invokevirtual // pops 2 (this + arg), pushes result
```

## PostScript

Similar to Forth but with more explicit operators:

```postscript
1 2 add       % Pops 2, pushes 3
(hello) (world) concat  % Pops 2, pushes (helloworld)
```

## Python's Stack Machine

CPython bytecode is interesting:

```python
# For: uppercase("hello")
LOAD_GLOBAL    0 (uppercase)
LOAD_CONST     1 ("hello") 
CALL_FUNCTION  1  # Pops function + 1 arg, pushes result
```

The `CALL_FUNCTION` instruction includes argument count!

## Common Patterns

1. **Explicit Arity**: Callers know how many arguments to pass
2. **Caller Cleanup**: After call, result replaces arguments on stack
3. **No Preservation**: Arguments are consumed, not preserved
4. **Direct Flow**: Results go directly to stack, no intermediate registers

## Applied to Glimmer

Current Glimmer:
```
push_frame
push "hello"
call uppercase  
pop_frame      // Problem: loses our position!
fetch $v0      // Indirect through register
```

Stack machine style:
```
push "hello"
call uppercase, 1  // Pops 1 arg, pushes result
```

For nested `{{join (uppercase "hello") (lowercase "WORLD")}}`:
```
push "hello"
call uppercase, 1   // Stack: ["HELLO"]
push "WORLD"        // Stack: ["HELLO", "WORLD"]  
call lowercase, 1   // Stack: ["HELLO", "world"]
call join, 2        // Stack: ["HELLOworld"]
```

## Key Insight

The helper already receives all its arguments bundled as an Arguments object. This means the VM is already doing the work of collecting arguments from the stack. 

What if instead of:
1. Push frame
2. Push args
3. Call helper (pops Arguments, puts result in $v0)
4. Pop frame (resets stack pointer!)
5. Fetch $v0 to stack

We did:
1. Push args
2. Call helper with arity N
3. Helper pops N values, pushes result directly

The helper would need to know its arity, or the VM would need to track it.

## Options for Glimmer

1. **Explicit arity in wire format**: `[CallResolved, handle, arity]`
2. **Helper consumes and produces**: Helpers pop their args, push results
3. **VM manages stack**: VM pops N args, calls helper, pushes result
4. **No frames for expressions**: Reserve frames for real function calls

The cleanest approach seems to be explicit arity with direct stack manipulation.