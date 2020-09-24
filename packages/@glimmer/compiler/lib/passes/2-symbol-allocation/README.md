# Pass 2: Symbol Allocation

The primary purpose of the precompiler's second pass is normalizing the HIR, which represents variable references as strings, to the MIR (mid-level IR), which represents variable references as unique symbols.

The HIR nodes forward their `SourceOffsets` to corresponding MIR nodes automatically.
