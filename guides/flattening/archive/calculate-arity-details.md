# Understanding calculateArity

## Wire Format for Arguments

Looking at the wire format constants, arguments can be encoded as:

```typescript
// From @glimmer/wire-format
EMPTY_ARGS_OPCODE = 0b0000
POSITIONAL_ARGS_OPCODE = 0b0100  
NAMED_ARGS_OPCODE = 0b0010
POSITIONAL_AND_NAMED_ARGS_OPCODE = 0b0110
```

## Argument Structure

```typescript
type CallArgs = 
  | [EMPTY_ARGS_OPCODE]
  | [POSITIONAL_ARGS_OPCODE, Params]
  | [NAMED_ARGS_OPCODE, Hash]
  | [POSITIONAL_AND_NAMED_ARGS_OPCODE, Params, Hash]

type Params = Expression[]  // Positional arguments
type Hash = [string[], Expression[]]  // Named arguments
```

## calculateArity Implementation

```typescript
function calculateArity(args: WireFormat.Core.CallArgs): number | null {
  const opcode = args[0];
  
  switch (opcode) {
    case EMPTY_ARGS_OPCODE:
      // No arguments
      return 0;
      
    case POSITIONAL_ARGS_OPCODE:
      // args[1] is the array of positional arguments
      return args[1].length;
      
    case NAMED_ARGS_OPCODE:
      // Only named arguments - this is complex for stack machine
      // For now, return null to use old path
      return null;
      
    case POSITIONAL_AND_NAMED_ARGS_OPCODE:
      // Has both positional and named
      // Could return positional count, but named args complicate things
      return null;
      
    default:
      return null;
  }
}
```

## Examples

### Simple Helper Call: `{{uppercase "hello"}}`
```typescript
args = [POSITIONAL_ARGS_OPCODE, ["hello"]]
calculateArity(args) // returns 1
```

### Multiple Arguments: `{{join "hello" "world"}}`
```typescript
args = [POSITIONAL_ARGS_OPCODE, ["hello", "world"]]
calculateArity(args) // returns 2
```

### No Arguments: `{{currentTime}}`
```typescript
args = [EMPTY_ARGS_OPCODE]
calculateArity(args) // returns 0
```

### Named Arguments: `{{format-date date format="short"}}`
```typescript
args = [POSITIONAL_AND_NAMED_ARGS_OPCODE, [date], [["format"], ["short"]]]
calculateArity(args) // returns null (fall back to old system)
```

## Why Return Null for Complex Cases?

Named arguments complicate the stack machine model because:

1. **Order matters**: Named args can appear in any order in template
2. **Arguments object**: Helpers expect named args in the Arguments object
3. **Stack layout**: Need conventions for where named args go on stack

For incremental implementation, we:
- Start with positional-only helpers (most expression helpers)
- Return `null` for complex cases to use existing frame-based system
- Gradually extend support as we learn

## Enhanced Version for Named Args (Future)

```typescript
interface ArityInfo {
  positional: number;
  named: string[] | null;
  total: number;
}

function calculateArityDetailed(args: WireFormat.Core.CallArgs): ArityInfo | null {
  const opcode = args[0];
  
  switch (opcode) {
    case EMPTY_ARGS_OPCODE:
      return { positional: 0, named: null, total: 0 };
      
    case POSITIONAL_ARGS_OPCODE:
      const count = args[1].length;
      return { positional: count, named: null, total: count };
      
    case NAMED_ARGS_OPCODE:
      const [names, values] = args[1];
      return { positional: 0, named: names, total: values.length };
      
    case POSITIONAL_AND_NAMED_ARGS_OPCODE:
      const posCount = args[1].length;
      const [namedKeys, namedValues] = args[2];
      return { 
        positional: posCount, 
        named: namedKeys, 
        total: posCount + namedValues.length 
      };
      
    default:
      return null;
  }
}
```

This richer information could later help with more complex stack layouts.