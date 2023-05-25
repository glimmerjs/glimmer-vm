import type { SourceSlice } from '../../source/slice';
import type { SourceSpan } from '../../source/span';
import type { ExpressionNode } from './expr';
import { AstNode } from './node';

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
export class Args extends AstNode {
  readonly type = 'Args';
  declare positional: PositionalArguments;
  declare named: NamedArguments;

  static empty(loc: SourceSpan): Args {
    return Args.of({
      loc,
      positional: PositionalArguments.empty(loc),
      named: NamedArguments.empty(loc),
    });
  }

  static named(named: NamedArguments): Args {
    return Args.of({
      loc: named.loc,
      positional: PositionalArguments.empty(named.loc.collapse('end')),
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
 * If `PositionalArguments` is empty, the `SourceOffsets` for this node should be the collapsed
 * position immediately after the parent call node's `callee`.
 */
export class PositionalArguments extends AstNode {
  readonly type = 'PositionalArguments';
  declare exprs: readonly ExpressionNode[];

  static empty(loc: SourceSpan): PositionalArguments {
    return PositionalArguments.of({
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
 * Corresponds to named arguments.
 *
 * If `PositionalArguments` and `NamedArguments` are empty, the `SourceOffsets` for this node should
 * be the same as the `Args` node that contains this node.
 *
 * If `PositionalArguments` is not empty but `NamedArguments` is empty, the `SourceOffsets` for this
 * node should be the collapsed position immediately after the last positional argument.
 */
export class NamedArguments extends AstNode {
  readonly type = 'NamedArguments';
  declare entries: readonly NamedArgument[];

  static empty(loc: SourceSpan): NamedArguments {
    return NamedArguments.of({
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

/**
 * Corresponds to a single named argument.
 *
 * ```hbs
 * x=<expr>
 * ```
 */
export class NamedArgument extends AstNode {
  readonly type = 'NamedArgument';
  declare name: SourceSlice;
  declare value: ExpressionNode;
}
