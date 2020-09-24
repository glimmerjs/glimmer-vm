import type { SourceSpan } from '../../-internal';
import { SourceSlice } from '../../-internal';
import type { ExpressionNode } from './-internal';
import { node } from './-internal';

/**
 * Corresponds to syntaxes with positional and named arguments:
 *
 * - SubExpression
 * - Invoking Append
 * - Invoking attributes
 * - InvokeBlock
 *
 * If `Args` is empty, the `SourceOffsets` for this node should be the collapsed position
 * immediately after the parent call node's `callee`.
 */
export class Args extends node().fields<{
  positional: Positional;
  named: Named;
}>() {
  static empty(loc: SourceSpan): Args {
    return new Args({ loc, positional: Positional.empty(loc), named: Named.empty(loc) });
  }

  static named(named: Named): Args {
    return new Args({
      loc: named.loc,
      positional: Positional.empty(named.loc.collapse('end')),
      named,
    });
  }

  nth(offset: number): ExpressionNode | null {
    return this.positional.nth(offset);
  }

  get(name: string): ExpressionNode | null {
    return this.named.get(name);
  }

  isEmpty(): boolean {
    return this.positional.isEmpty() && this.named.isEmpty();
  }
}

/**
 * Corresponds to positional arguments.
 *
 * If `Positional` is empty, the `SourceOffsets` for this node should be the collapsed position
 * immediately after the parent call node's `callee`.
 */
export class Positional extends node().fields<{
  exprs: readonly ExpressionNode[];
}>() {
  static empty(loc: SourceSpan): Positional {
    return new Positional({
      loc,
      exprs: [],
    });
  }

  get size(): number {
    return this.exprs.length;
  }

  nth(offset: number): ExpressionNode | null {
    return this.exprs[offset] || null;
  }

  isEmpty(): boolean {
    return this.exprs.length === 0;
  }
}

/**
 * Corresponds to positional arguments.
 *
 * If `Positional` and `Named` are empty, the `SourceOffsets` for this node should be the same as
 * the `Args` node that contains this node.
 *
 * If `Positional` is not empty but `Named` is empty, the `SourceOffsets` for this node should be
 * the collapsed position immediately after the last positional argument.
 */
export class Named extends node().fields<{
  entries: readonly NamedEntry[];
}>() {
  static empty(loc: SourceSpan): Named {
    return new Named({
      loc,
      entries: [],
    });
  }

  get size(): number {
    return this.entries.length;
  }

  get(name: string): ExpressionNode | null {
    let entry = this.entries.find((e) => e.name.chars === name);

    return entry ? entry.value : null;
  }

  isEmpty(): boolean {
    return this.entries.length === 0;
  }
}

export class NamedEntry {
  readonly loc: SourceSpan;
  readonly name: SourceSlice;
  readonly value: ExpressionNode;

  constructor(options: { name: SourceSlice; value: ExpressionNode }) {
    this.loc = options.name.loc.extend(options.value.loc);
    this.name = options.name;
    this.value = options.value;
  }
}
