---
noteId: "50d08220ecd611ea8388874e1424078a"
tags: []

---

# Pass 1: Symbol Allocation

The primary purpose of the precompiler's second pass is normalizing the HIR, which represents variable references as strings, to the MIR (mid-level IR), which represents variable references as unique symbols.

The HIR nodes forward their `SourceOffsets` to corresponding MIR nodes automatically.

> The previous implementation of the precompiler converted the AST into a stack-machine-like IR. The current implementation retains some aspects of that approach for now, but it adds unnecessary complexity and will be addressed in a follow-up PR.
>
> Full documentation of the Symbol Allocation pass will follow.
