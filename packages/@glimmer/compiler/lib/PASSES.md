---
noteId: "5d0de690ecd611ea8388874e1424078a"
tags: []

---

The Glimmer preprocessor is responsible for taking templates and converting them into the Wire Format.

The input to the preprocessor is _the AST_. The AST is the result of parsing a template via `@glimmer/syntax`.

## Passes

**Normalization**: The normalization pass turns the AST into the HIR (high-level IR). While the AST treats all blocks, curlies and expressions equally, the HIR has special instructions for keywords (such as `#in-element`, `{{yield}}` and `(has-block)`).

**Symbol Allocation**: The symbol allocation pass turns the HIR into the MIR (mid-level IR). While HIR instructions use strings to identify variable bindings and references, the MIR uses unique symbols for each binding and reference, eliminating the need to understand the current scope stack in order to resolve the location of a variable reference.

In addition to allocating symbols for variable references that refer to in-scope bindings (introduced by block parameters), this pass also allocates symbols for `@arg` references, as well as blocks that are references via the `{{yield}}`, `(has-block)` and `(has-block-params)` keywords.

Finally, this pass is responsible for identifying the presence of the `{{partial}}` and `{{debugger}}` keywords, which require symbol maps at runtime.

**Encoding Preparation**: The encoding preparation pass turns the MIR into the LIR (low-level IR). The LIR is a representation of the encoded wire format, before serializing the instructions, and with source offsets still attached to each instruction. At the moment, those source offsets are unconditionally dropped during encoding, but this representation will make it possible to emit versions of the wire format that preserve source locations.

In addition, separating the LIR from the final encoded format will make it possible to experiment with different wire encodings (such as a wasm encoding, for example) without needing to repeatedly rewrite the final pass.

**Encoding**: The encoding pass turns the LIR into the wire format, which is suitable for wire transport. The current encoding pass is hardcoded to emit the wire format (documented in `@glimmer/wire-format`). This is the stage where any optimizations on the representation are performed (like erasing trailing nulls, or other simple packing optimizations).

In strict mode, encoded templates will need to be emitted into a JavaScript file containing variable bindings that correspond to each of the upvars. This is not yet implemented.

In the future, it will be possible to replace the encoder with an arbitrary encoding pass, provided that you supply a runtime decoder.
