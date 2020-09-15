AST v2 enhances the original AST with a number of clarifying features.

- All blocks are annotated with a `BlockSymbolTable`
- All statements are annotated with their current `SymbolTable`, which can be
  used by consumers of the AST to implement features like `partial` and `debugger`
  without needing to separately keep a stack of symbol tables
- Elements are normalized to `NamedBlock`, `SimpleElement` or `Component`.
- The head of "invocation positions" like `{{x y}}` and `<x />` are normalized
  to `FreeVarHead` expressions.
- Variable references are normalized to a variant of `PathHead`. In particular,
  `LocalVarHead` and `FreeVarHead` distinguish between whether a variable refers
  to an in-scope binding.
- `FreeVarHead` is annotated with the appropriate `VariableResolution` based on
  sloppy mode semantics (in strict mode, all `FreeVarHead`s are annotated with
  `VariableResolution.Strict`). This means that consumers of the AST don't need
  to do additional work to determine the semantics of each free variable position.
