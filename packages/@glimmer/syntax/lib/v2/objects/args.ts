import type { Optional, PresentArray } from '@glimmer/interfaces';
import type { FixedLengthArray, Simplify } from 'type-fest';

import type { SourceSlice } from '../../source/slice';
import type { AttrValueNode, ExpressionValueNode } from './expr';

import { SourceSpan } from '../../source/span';
import { SpanList } from '../../source/span-list';
import { node } from './node';

export class ResolvedName extends node('ResolvedName').fields<{
  name: string;
  symbol: number;
}>() {}

export class UnresolvedBinding extends node('UnresolvedBinding').fields<{
  name: string;
  notes?: string[];
}>() {}

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
export class BaseArgs<N extends CurlyArgument | ComponentArgument> {
  readonly loc: SourceSpan;
  readonly positional: PositionalArguments;
  readonly named: BaseNamedArguments<N>;

  constructor(fields: {
    loc: SourceSpan;
    positional: PositionalArguments;
    named: BaseNamedArguments<N>;
  }) {
    this.loc = fields.loc;
    this.positional = fields.positional;
    this.named = fields.named;
  }

  nth(offset: number): N['value'] | null {
    return this.positional.nth(offset);
  }

  getNode(name: string): N | null {
    return this.named.getNode(name);
  }

  get(name: string): N['value'] | null {
    return this.named.get(name);
  }

  isEmpty(): boolean {
    return this.positional.isEmpty() && this.named.isEmpty();
  }
}

type Args<N extends CurlyArgument | ComponentArgument> = BaseArgs<N> & {
  named: N extends CurlyArgument ? CurlyNamedArguments : ComponentNamedArguments;
};

export type CurlyArgs = Args<CurlyArgument>;
export type ComponentArgs = Args<ComponentArgument>;

export type AnyArgs = CurlyArgs | ComponentArgs;

export function EmptyComponentArgs(
  named: ComponentNamedArguments | SourceSpan
): Args<ComponentArgument> {
  const namedArgs = named instanceof SourceSpan ? ComponentNamedArguments(named) : named;

  return new BaseArgs({
    loc: namedArgs.loc,
    positional: PositionalArguments.empty(namedArgs.loc.collapse('end')),
    named: namedArgs,
  });
}

export function EmptyCurlyArgs(named: CurlyNamedArguments | SourceSpan): Args<CurlyArgument> {
  const namedArgs = named instanceof SourceSpan ? CurlyNamedArguments(named) : named;

  return new BaseArgs({
    loc: namedArgs.loc,
    positional: PositionalArguments.empty(namedArgs.loc.collapse('end')),
    named: namedArgs,
  }) as Args<CurlyArgument>;
}

export function CurlyArgs(
  positional: PositionalArguments,
  named: CurlyNamedArguments,
  loc = SpanList.range([positional.loc, named.loc])
): Args<CurlyArgument> {
  return new BaseArgs({ loc, positional, named }) as CurlyArgs;
}

// export type ComponentArgs = Args<ComponentArgument> & }named: ComponentArguments};
// export type CurlyArgs = Args<CurlyArgument>;

/**
 * Corresponds to positional arguments.
 *
 * If `PositionalArguments` is empty, the `SourceOffsets` for this node should be the collapsed
 * position immediately after the parent call node's `callee`.
 */
export class PositionalArguments extends node().fields<{
  exprs: readonly ExpressionValueNode[];
}>() {
  static empty(loc: SourceSpan): PositionalArguments {
    return new PositionalArguments({
      loc,
      exprs: [],
    });
  }

  get size(): number {
    return this.exprs.length;
  }

  asPresent(): Optional<PresentPositional> {
    if (this.exprs.length !== 0) {
      return this as unknown as PresentPositional;
    }
  }

  nth(offset: number): ExpressionValueNode | null {
    return this.exprs[offset] || null;
  }

  slice<T extends number>(size: T): Optional<Simplify<FixedLengthArray<ExpressionValueNode, T>>> {
    if (size === 0 || size > this.exprs.length) {
      return undefined;
    }

    return this.exprs.slice(0, size) as unknown as FixedLengthArray<ExpressionValueNode, T>;
  }

  isEmpty(): boolean {
    return this.exprs.length === 0;
  }
}

export type PresentPositional = PositionalArguments & { exprs: PresentArray<ExpressionValueNode> };

/**
 * Corresponds to named arguments.
 *
 * If `PositionalArguments` and `NamedArguments` are empty, the `SourceOffsets` for this node should
 * be the same as the `Args` node that contains this node.
 *
 * If `PositionalArguments` is not empty but `NamedArguments` is empty, the `SourceOffsets` for this
 * node should be the collapsed position immediately after the last positional argument.
 */
export class BaseNamedArguments<A extends CurlyArgument | ComponentArgument> {
  readonly loc: SourceSpan;
  readonly entries: readonly A[];

  constructor(fields: { loc: SourceSpan; entries: readonly A[] }) {
    this.loc = fields.loc;
    this.entries = fields.entries;
  }

  get size(): number {
    return this.entries.length;
  }

  asPresent(): this extends BaseNamedArguments<CurlyArgument>
    ? Optional<PresentCurlyNamedArguments>
    : Optional<PresentComponentNamedArguments> {
    if (this.entries.length !== 0) {
      return this as unknown as this extends BaseNamedArguments<CurlyArgument>
        ? PresentCurlyNamedArguments
        : PresentComponentNamedArguments;
    }
  }

  getNode(name: string): A | null {
    return (this.entries as A[]).filter((e) => e.name.chars === name)[0] ?? null;
  }

  get(name: string): A['value'] | null {
    let entry = this.entries.filter((e) => e.name.chars === name)[0];

    return entry ? entry.value : null;
  }

  isEmpty(): boolean {
    return this.entries.length === 0;
  }
}

export function CurlyNamedArguments(
  loc: SourceSpan,
  entries: CurlyArgument[] = []
): CurlyNamedArguments {
  return new BaseNamedArguments({
    loc,
    entries,
  });
}

export function ComponentNamedArguments(
  loc: SourceSpan,
  entries: ComponentArgument[] = []
): ComponentNamedArguments {
  return new BaseNamedArguments({
    loc,
    entries,
  });
}

export type CurlyNamedArguments = BaseNamedArguments<CurlyArgument>;
export type ComponentNamedArguments = BaseNamedArguments<ComponentArgument>;

export type PresentNamedArguments = PresentCurlyNamedArguments | PresentComponentNamedArguments;
export type PresentCurlyNamedArguments = CurlyNamedArguments & {
  entries: PresentArray<CurlyArgument>;
};
export type PresentComponentNamedArguments = ComponentNamedArguments & {
  entries: PresentArray<ComponentArgument>;
};

/**
 * Corresponds to a single named argument.
 *
 * ```hbs
 * x=<expr>
 * ```
 */
export class CurlyArgument {
  readonly loc: SourceSpan;
  readonly name: SourceSlice;
  readonly value: ExpressionValueNode;

  constructor(options: { name: SourceSlice; value: ExpressionValueNode }) {
    this.loc = options.name.loc.extend(options.value.loc);
    this.name = options.name;
    this.value = options.value;
  }
}

/**
 * Corresponds to a single named argument.
 *
 * ```hbs
 * x=<expr>
 * ```
 */
export class ComponentArgument {
  readonly loc: SourceSpan;
  readonly name: SourceSlice;
  readonly value: AttrValueNode;

  constructor(options: { name: SourceSlice; value: AttrValueNode }) {
    this.loc = options.name.loc.extend(options.value.loc);
    this.name = options.name;
    this.value = options.value;
  }
}
