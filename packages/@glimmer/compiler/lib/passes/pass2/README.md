---
noteId: "50d05b10ecd611ea8388874e1424078a"
tags: []

---

# Pass 2: Encoding Preparation

The precompiler's third pass is responsible for converting the MIR into the LIR (low-level IR) that closely approximates the encoded wire format.

There are three kinds of LIR constructs:

- `lir.Statement`, which corresponds to an encoded statement
- `lir.Expression`, which corresponds to an encoded expression
- `lir.Block`, which corresponds to an encoded block

The output of the precompiler is a `TemplateBlock`:

- `statements`: a list of `lir.Statement`s
- `symbols`: a list of the names of the symbols that represent variable references; these are used for debugging and for `eval`-like operations (`debugger` and `partial`)
- `upvars`: a list of the names of the free variables
  - in sloppy mode, these are resolved by the JIT compiler
  - in strict mode, these refer to variables that are in the same logical JavaScript scope as the source template

> The previous implementation of the precompiler converted the AST into a stack-machine-like IR in the equivalent of the normalization pass. However, the equivalent of the encoding preparation pass simply re-assembled those operations into a nesting structure much closer to the original AST.
>
> The current implementation of the encoding preparation pass retains some aspects of that approach for now, but it adds unnecessary complexity and will be addressed in a follow-up PR.
>
> Full documentation of the Encoding Preparation pass will follow.
