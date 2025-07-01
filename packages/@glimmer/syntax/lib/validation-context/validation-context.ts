/* eslint-disable no-unused-private-class-members */
import type { Optional } from '@glimmer/interfaces';
import { localAssert } from '@glimmer/debug-util';

import type { SourceSlice } from '../source/slice';
import type { HasSourceSpan } from '../source/span-list';
import type { AppendInvokeContext, SomeAppendContext } from './append';
import type { ArgsContainerContext, NamedArgContainer, SomeArgsContext } from './args';
import type { SomeContentValidationContext } from './content';
import type {
  ConcatContext,
  FullElementParameterValidationContext,
  InvokeElementParameterContext,
  SomeElementValidationContext,
} from './element';

import { SourceSpan } from '../source/loc/span';
import { loc } from '../source/span-list';
import { GlimmerSyntaxError } from '../syntax-error';
import { AppendValueContext } from './append';
import { ArgsContext, NamedArgContext, PositionalArgsContext } from './args';
import { AngleBracketContext, InvokeBlockContext } from './content';

export type AnyNode = { loc: SourceSpan; type: string };
export type AppendValueNode = AnyNode & { value: AnyNode };
export type ArgsNode = {
  loc: SourceSpan;
  positional: { loc: SourceSpan };
  named: { loc: SourceSpan };
};
export type NameNode = AnyNode & {
  type: 'ResolvedName' | 'UnresolvedBinding';
  name: string;
};
export type InvokeResolvedNode = AnyNode & { callee: NameNode };
export type ResolvedNode = AnyNode & { resolved: NameNode };
export type PathNode = AnyNode & { tail: unknown };
export type CallNode = AnyNode & { args: unknown };
export type KeywordNode = AnyNode & { keyword: SourceSlice };

export function isResolvedName(node: AnyNode): node is NameNode {
  return node.type === 'ResolvedName' || node.type === 'UnresolvedBinding';
}

export function hasCallee(
  node: AnyNode & Partial<{ callee: AnyNode }>
): node is InvokeResolvedNode {
  return !!node.callee && isResolvedName(node.callee);
}

export function hasResolved(node: AnyNode & Partial<{ resolved: NameNode }>): node is ResolvedNode {
  return !!node.resolved && isResolvedName(node.resolved);
}

export interface AnyAttrLikeContainerContext {
  value(options: { value: HasSourceSpan; curly: HasSourceSpan }): ValueValidationContext;
  invoke(curly: HasSourceSpan): InvokeElementParameterContext;
  resolved(node: ResolvedNode): VariableReferenceContext;
}

export interface AnyValidationContext {
  /**
   * The full span of the top-level content node that this validation is nested inside of.
   */
  readonly context: SourceSpan;
}

export interface ReportableContext {
  readonly message: string;
  highlights(): Highlight;
  error(extra?: number): GlimmerSyntaxError;
}

export type IntoHighlightedSpan = SourceSpan | { loc: HasSourceSpan; label?: Optional<string> };
export type IntoHighlightInfo = {
  full?: HasSourceSpan;
  primary: IntoHighlightedSpan;
  expanded?: Optional<IntoHighlightedSpan>;
};
export type IntoHighlight = IntoHighlightedSpan | IntoHighlightInfo;

export class Highlight {
  static from(from: IntoHighlight): Highlight {
    if ('primary' in from) {
      return Highlight.fromInfo(from);
    } else {
      return Highlight.fromSpan(from);
    }
  }

  static fromSpan(from: IntoHighlightedSpan): Highlight {
    const span = HighlightedSpan.from(from);
    return new Highlight(span.loc, span);
  }

  static fromInfo(from: IntoHighlightInfo): Highlight {
    const primary = HighlightedSpan.from(from.primary);
    const expanded = from.expanded ? HighlightedSpan.from(from.expanded) : undefined;
    const selection = expanded ?? primary;

    return new Highlight(
      from.full
        ? loc(from.full)
        : (selection.loc.lastLine.intersect(selection.loc) ?? selection.loc),
      primary,
      expanded && contains(expanded.loc, primary.loc) ? expanded : undefined
    );
  }

  readonly full: SourceSpan;
  readonly primary: HighlightedSpan;
  readonly expanded: Optional<HighlightedSpan>;
  readonly notes: string[] = [];

  private constructor(
    full: SourceSpan,
    primary: { loc: SourceSpan; label?: Optional<string> },
    expanded?: { loc: SourceSpan; label?: Optional<string> }
  ) {
    this.full = full;
    this.primary = HighlightedSpan.from(primary);
    this.expanded = expanded ? HighlightedSpan.from(expanded) : undefined;
  }

  get selection() {
    return this.expanded ?? this.primary;
  }

  get prefix(): Optional<SourceSpan> {
    if (this.expanded) {
      const span = this.expanded.loc.getStart().until(this.primary.loc.getStart());
      if (!span.isCollapsed()) {
        return span;
      }
    }
  }

  get suffix(): Optional<SourceSpan> {
    if (this.expanded) {
      const span = this.primary.loc.getEnd().until(this.expanded.loc.getEnd());
      if (!span.isCollapsed()) {
        return span;
      }
    }
  }

  addNote(note: string) {
    this.notes.push(note);
    return this;
  }

  addNotes(notes: string[]) {
    this.notes.push(...notes);
    return this;
  }
}

function contains(parent: SourceSpan, child: SourceSpan) {
  return parent.getStart() <= child.getStart() && parent.getEnd() >= child.getEnd();
}

export class HighlightedSpan {
  static from(from: IntoHighlightedSpan): HighlightedSpan {
    if (from instanceof SourceSpan) {
      return new HighlightedSpan(from, undefined);
    } else {
      return new HighlightedSpan(loc(from.loc), from.label);
    }
  }

  readonly loc: SourceSpan;
  readonly label: string | undefined;

  constructor(loc: SourceSpan, label?: Optional<string>) {
    this.loc = loc;
    this.label = label;
  }

  withPrimary(span: IntoHighlightedSpan, options?: { full: HasSourceSpan }) {
    const primary = HighlightedSpan.from(span);

    localAssert(this.loc.contains(primary.loc), `The primary highlight must be within the span`);

    return Highlight.fromInfo({ ...options, primary, expanded: this });
  }

  expand(span: Optional<IntoHighlightedSpan>) {
    if (span === undefined) return this;

    const expanded = HighlightedSpan.from(span);

    localAssert(expanded.loc.contains(this.loc), `The expanded highlight must be within the span`);

    return Highlight.fromInfo({ primary: this, expanded });
  }

  asPrimary(options?: { full: HasSourceSpan }) {
    return Highlight.fromInfo({ ...options, primary: this });
  }

  get size() {
    const size = this.loc.endPosition.column - this.loc.startPosition.column;
    localAssert(size >= 0, `The size of a highlight for an error must be greater than 0`);
    return size;
  }

  get start() {
    return this.loc.startPosition.column;
  }

  get end() {
    return this.loc.endPosition.column;
  }
}

export class VariableReferenceContext implements ReportableContext {
  readonly context: SourceSpan;
  readonly problem = 'not in scope';
  #parent: PathValidationContext;
  #name: string;
  #span: SourceSpan;
  #notes: string[] = [];

  constructor(parent: PathValidationContext, name: string, span: SourceSpan) {
    this.context = parent.context;
    this.#parent = parent;
    this.#name = name;
    this.#span = span;
  }

  highlights(): Highlight {
    const hasExpanded = !this.#span.isEqual(this.#parent.span);
    const primary = {
      loc: this.#span,
      label: hasExpanded ? this.problem : describeWhatInline(this.what, this.problem),
    };

    const expanded = hasExpanded
      ? { loc: this.#parent.span, label: this.what.describe }
      : undefined;

    return Highlight.fromInfo({ full: this.context, primary, expanded }).addNotes(this.#notes);
  }

  get what(): FullWhat {
    return this.#parent.what(this.#parent.span.asString());
  }

  get message() {
    const varName = this.#parent.span.isEqual(this.#span) ? 'it' : `\`${this.#span.asString()}\``;
    return resolutionError({ attemptedTo: this.what.attempted, unresolved: varName });
  }

  get loc() {
    return this.#span;
  }

  get name() {
    return this.#name;
  }

  error(extra?: number): GlimmerSyntaxError {
    return GlimmerSyntaxError.highlight(this.message, this.highlights(), extra);
  }

  addNote(note: string) {
    this.#notes.push(note);
    return this;
  }

  addNotes(notes: string[]) {
    this.#notes.push(...notes);
    return this;
  }
}

export function resolutionError(options: { attemptedTo: string; unresolved?: string }) {
  return `Attempted to ${options.attemptedTo}, but ${options.unresolved ?? 'it'} was not in scope`;
}

export type InvokeKind =
  | { type: 'custom'; custom: SourceSlice }
  | 'component'
  | 'subexpression'
  | 'modifier'
  | 'block'
  | 'append'
  | 'attr'
  | 'arg';

type ValueParent =
  | {
      type: 'positional';
      parent: ArgsParentValidationContext;
    }
  | {
      type: 'named';
      container: NamedArgContainer;
      parent: ArgsParentValidationContext;
    }
  | { type: 'concat'; parent: FullElementParameterValidationContext }
  | {
      type: 'append';
      parent: AppendValueContext;
    }
  | {
      type: 'callee';
      kind: InvokeKind;
      parent: InvokeParentContext;
      curly?: Optional<SourceSpan>;
    }
  | {
      type: 'attr' | 'arg';
      parent: FullElementParameterValidationContext;
      curly: SourceSpan;
      callee: boolean;
    }
  | {
      type: 'concat';
      parent: ConcatContext;
      curly: SourceSpan;
    };

export function describeValueParent(parent: ValueParent): WhatFn {
  return (path: string) => {
    const formatted = `\`${path}\``;

    switch (parent.type) {
      case 'positional':
        return {
          attempted: `pass ${formatted} as a positional argument`,
          describe: 'argument',
          inline: false,
        };
      case 'named':
        return {
          attempted: `pass ${formatted} as a named argument`,
          describe: 'argument',
          inline: false,
        };
      case 'concat':
        return { attempted: `concatenate ${formatted}`, describe: 'value', inline: false };
      case 'append':
        return { attempted: `append ${formatted}`, describe: 'value', inline: false };
      case 'callee':
        switch (parent.kind) {
          case 'modifier':
            return { attempted: `invoke ${formatted} as a modifier`, describe: 'modifier' };
          case 'append':
          case 'subexpression':
          case 'arg':
          case 'attr':
            return { attempted: `invoke ${formatted} as a helper`, describe: 'helper' };
          case 'block':
            return { attempted: `invoke ${formatted} as a component`, describe: 'component name' };
          case 'component':
            return { attempted: `invoke ${formatted} as a component`, describe: 'component name' };
          default:
            return {
              attempted: `invoke the ${formatted} keyword`,
              describe: 'keyword',
            };
        }
      case 'attr':
        if (parent.callee) {
          return { attempted: `invoke ${formatted} as a helper`, describe: 'helper' };
        } else {
          return {
            attempted: `set ${formatted} as an attribute`,
            describe: 'attribute value',
            inline: false,
          };
        }
      case 'arg': {
        if (parent.callee) {
          return { attempted: `invoke ${formatted} as a helper`, describe: 'helper' };
        } else {
          return {
            attempted: `pass ${formatted} as an argument`,
            describe: 'value',
            inline: false,
          };
        }
      }
    }
  };
}

/**
 * Values (standalone expressions that evaluate to standalone values without additional context) can
 * be:
 *
 * - positional arguments
 * - named argument values (`x=<expr>`)
 * - component argument values (`@x={{<expr>}}`, including `@x={{<identifier>}}`)
 * - attribute values (`@x={{<expr>}}` but not `x={{name ...}}`, but not `x={{identifier}}` in
 *   classic mode, since `identifier` might resolve to a helper in that context).
 * - `append` (`{{<expr>}}` but not `{{<identifier>}}` or `{{identifier ...}}`, since `identifier`
 *   might resolve to a helper or component in that context).
 * - callee expressions when resolution behavior could be ruled out.
 */
export class ValueValidationContext {
  static positional(parent: ArgsParentValidationContext, value: SourceSpan) {
    return new ValueValidationContext({ type: 'positional', parent }, value);
  }

  static named(
    parent: ArgsParentValidationContext,
    value: SourceSpan,
    container: NamedArgContainer
  ) {
    return new ValueValidationContext({ type: 'named', parent, container }, value);
  }

  static append(parent: AppendValueContext, value: SourceSpan) {
    return new ValueValidationContext({ type: 'append', parent }, value);
  }

  static callee(
    kind: InvokeKind,
    parent: InvokeParentContext,
    value: SourceSpan,
    curly?: SourceSpan
  ): ValueValidationContext {
    return new ValueValidationContext({ type: 'callee', kind, parent, curly }, value);
  }

  static concat(parent: ConcatContext, value: SourceSpan, { curly }: { curly: SourceSpan }) {
    return new ValueValidationContext({ type: 'concat', parent, curly }, value);
  }

  static parameter(
    parent: FullElementParameterValidationContext,
    value: SourceSpan,
    { curly, callee }: { curly: SourceSpan; callee: boolean }
  ) {
    return new ValueValidationContext({ type: parent.type, parent, curly, callee }, value);
  }

  readonly context: SourceSpan;
  #parent: ValueParent;
  #value: SourceSpan;
  #what: { type: string; callee: boolean; label?: string | undefined };

  private constructor(parent: ValueParent, value: SourceSpan, label?: string) {
    this.context = parent.parent.context;
    this.#parent = parent;
    this.#value = value;
    this.#what = {
      type: parent.type,
      callee: parent.type === 'callee',
      label,
    };
  }

  get what() {
    return this.#what;
  }

  resolved(node: NameNode): VariableReferenceContext {
    return new PathValidationContext(this, loc(node), describeValueParent(this.#parent)).head(node);
  }

  unresolved(node: NameNode): VariableReferenceContext {
    return this.resolved(node);
  }

  custom(node: KeywordNode): InvokeCustomSyntaxContext {
    return InvokeCustomSyntaxContext.expr(this, node);
  }

  subexpression(node: CallNode): SubExpressionContext {
    return new SubExpressionContext(this, loc(node));
  }

  path(): PathValidationContext {
    return new PathValidationContext(this, this.#value, describeValueParent(this.#parent));
  }

  labelled(name: string): ValueValidationContext {
    return new ValueValidationContext(this.#parent, this.#value, name);
  }
}

export class CustomErrorContext implements ReportableContext {
  static for(
    this: void,
    highlight: IntoHighlight,
    message: string,
    problem: string,
    options: { header?: HasSourceSpan; content: HasSourceSpan }
  ) {
    return new CustomErrorContext(
      message,
      problem,
      loc(options.content),
      Highlight.from(highlight),
      options.header && loc(options.header)
    );
  }

  readonly context: SourceSpan;
  readonly message: string;
  readonly problem: string;
  readonly #highlight: Highlight;
  readonly #header: Optional<SourceSpan>;

  constructor(
    error: string,
    problem: string,
    content: SourceSpan,
    highlight: Highlight,
    header?: SourceSpan
  ) {
    this.context = content;
    this.message = error;
    this.problem = problem;
    this.#highlight = highlight;
    this.#header = header;
  }

  get what(): What {
    return { describe: this.problem, inline: false };
  }

  get loc() {
    return this.#highlight;
  }

  error(extra?: number): GlimmerSyntaxError {
    return GlimmerSyntaxError.highlight(this.message, this.#highlight, extra);
  }

  highlights(): Highlight {
    return this.#highlight;
  }

  addNote(note: string) {
    this.#highlight.addNote(note);
    return this;
  }

  addNotes(notes: string[]) {
    this.#highlight.addNotes(notes);
    return this;
  }
}

export class InvokeCustomSyntaxContext implements ArgsContainerContext {
  static keyword(this: void, syntax: KeywordNode): InvokeCustomSyntaxContext {
    return new InvokeCustomSyntaxContext(syntax.keyword, loc(syntax));
  }

  static expr(parent: ValueValidationContext, syntax: KeywordNode) {
    return new InvokeCustomSyntaxContext(syntax.keyword, loc(syntax), parent);
  }

  readonly context: SourceSpan;
  /**
   * This is present for expression keywords
   */
  #parent: Optional<ValueValidationContext>;
  #name: SourceSlice;
  #syntax: SourceSpan;

  constructor(name: SourceSlice, syntax: SourceSpan, parent?: Optional<ValueValidationContext>) {
    this.context = parent?.context ?? syntax;
    this.#name = name;
    this.#syntax = syntax;
    this.#parent = parent;
  }

  callee(callee: AnyNode) {
    return ValueValidationContext.callee({ type: 'custom', custom: this.#name }, this, loc(callee));
  }

  positionalArgs(positional: AnyNode) {
    return new PositionalArgsContext(this, loc(positional));
  }

  positional(name: string, positional: AnyNode) {
    return ValueValidationContext.positional(this, loc(positional)).labelled(name);
  }

  namedArg(arg: NamedArgContainer & { value: AnyNode }): ValueValidationContext {
    return new NamedArgContext(this, arg).value(arg.value);
  }
}

export type InvokeElementParamSyntaxType =
  | 'modifier'
  | { type: 'attr'; kind: 'invoke' }
  | { type: 'arg'; kind: 'invoke' };

export type ElementParamSyntaxType =
  | InvokeElementParamSyntaxType
  | { type: 'attr'; kind: 'value' }
  | { type: 'arg'; kind: 'value' }
  | { type: 'concat'; kind: 'value' };

export type InvokeSyntaxType =
  | 'subexpression'
  | 'component'
  | 'block'
  | InvokeElementParamSyntaxType
  | { type: 'concat'; kind: 'invoke' }
  | { type: 'append'; kind: 'invoke' }
  | { type: 'custom'; kind: 'invoke'; custom: SourceSlice };
export type AmbiguousSyntaxType = { type: 'append'; kind: 'value' };

export type InvokeSyntaxTypeName = InvokeSyntaxType extends infer T
  ? T extends string
    ? T
    : T extends { type: infer T }
      ? T
      : never
  : never;

/**
 * An ambiguous syntax could either represent a value or an invocation, depending on whether there
 * are any arguments.
 */
export type AmbiguousSyntaxName = 'attr' | 'arg' | 'concat';

/**
 * A callee context is an invoke context if:
 *
 * - it's a syntax that is intrinsically invokable:
 *   - `{{#block}}`
 *   - `<AngleBracket>`
 *   - `(subexpression)`
 *   - `{{modifier}}`
 * - it has arguments:
 *   - `{{component-name ...}}`
 *   - `attr={{helper-name ...}}`
 *   - `@arg={{helper-name ...}}`
 * - it's a custom syntax
 */
export type CalleeSyntaxType = InvokeSyntaxType | AmbiguousSyntaxType;

export function isInvokeSyntax(type: CalleeSyntaxType): type is InvokeSyntaxType {
  return typeof type === 'string' || type.type === 'custom' || type.kind === 'invoke';
}

export interface AnyResolveParentContext extends AnyValidationContext {
  resolved(callee: NameNode): VariableReferenceContext;
}

export interface AnyInvokeParentContext extends AnyResolveParentContext {
  readonly type: InvokeSyntaxType;

  callee(callee: AnyNode): ValueValidationContext;
  args(args: ArgsNode): ArgsContext;
}

export interface AnyAmbiguousParentContext extends AnyValidationContext {
  readonly type: AmbiguousSyntaxName;
  readonly isInvoke: boolean;
}

export type InvokeParentContext =
  | InvokeElementParameterContext
  | AngleBracketContext
  | InvokeBlockContext
  | AppendInvokeContext
  | InvokeCustomSyntaxContext
  | SubExpressionContext;

export type ValueParentContext =
  | InvokeElementParameterContext
  | PositionalArgsContext
  | NamedArgContext
  | AppendInvokeContext
  | ValueValidationContext;

export type SubExpressionParentContext =
  | InvokeElementParameterContext
  | AppendValueContext
  | ArgsContext
  | ValueValidationContext;

/**
 * A subexpression is the `(subexpression)` syntax. It always represents the literal `()` syntax,
 * and always _semantically_ represents a call.
 *
 * Syntaxes like `{{helper-name ...}}` are _not_ subexpressions, but are instead represented by the
 * types like {@linkcode AppendInvokeContext}.
 */
export class SubExpressionContext implements AnyInvokeParentContext {
  readonly type = 'subexpression';
  readonly isInvoke = true;
  readonly context: SourceSpan;
  #custom: Optional<string>;
  #parent: SubExpressionParentContext;
  #call: SourceSpan;

  constructor(parent: SubExpressionParentContext, call: SourceSpan) {
    this.context = parent.context;
    this.#parent = parent;
    this.#call = call;
  }

  resolved(callee: NameNode): VariableReferenceContext {
    return this.callee(callee).resolved(callee);
  }

  callee(callee: AnyNode): ValueValidationContext {
    return ValueValidationContext.callee('subexpression', this, loc(callee));
  }

  args(args: ArgsNode) {
    return new ArgsContext(this, loc(args.positional), loc(args.named));
  }
}

/**
 * All of these types are parents of an args list
 */
export type ArgsParentValidationContext =
  | AngleBracketContext
  | InvokeElementParameterContext
  | SubExpressionContext
  | AppendInvokeContext
  | InvokeCustomSyntaxContext
  | InvokeBlockContext;

export class KeywordValidationContext {
  readonly context: SourceSpan;
  #parent: PathValidationContext;
  #name: string;
  #keyword: SourceSpan;

  constructor(parent: PathValidationContext, name: string, keyword: SourceSpan) {
    this.context = parent.context;
    this.#parent = parent;
    this.#name = name;
    this.#keyword = keyword;
  }
}

export type PathParentValidationContext = ArgsParentValidationContext | ValueValidationContext;

export interface FullWhat {
  /**
   * Text describing the attempted action (e.g. "invoke it as a helper")
   */
  attempted: string;
  /**
   * Description of the path (e.g. "modifier").
   *
   * ```
   * SyntaxError: Attempted to invoke `x.foo` as a modifier, but `x` was not in scope:
   *
   * 1 | <div {{x.foo}}></div>
   *   |        ┳─┬──
   *   |        ┃ └── modifier // <- here
   *   |        ┗━━━━ not in scope
   * ```
   *
   */
  describe: string;

  /**
   * Description of the path when used inline.
   *
   * When `inline` is missing or `true`, its value is the same as `describe`.
   *
   * ```
   * SyntaxError: Attempted to invoke `bar` as a modifier, but it was not in scope:
   *
   * 1 | {{bar}}
   *   |   ━┳━
   *   |    ┗━ modifier not in scope
   * ```
   *
   * When `inline` is absent:
   *
   * ```
   * SyntaxError: Attempted to append `bar`, but it was not in scope:
   *
   * 1 | {{bar}}
   *   |   ━┳━
   *   |    ┗━ not in scope
   * ```
   */
  inline?: boolean | string | undefined;
}

export type What = Pick<FullWhat, 'describe' | 'inline'>;

export function describeWhatInline(what: What, suffix: string): string {
  if (what.inline === false) return suffix;
  return typeof what.inline === 'string'
    ? `${what.inline} ${suffix}`
    : `${what.describe} ${suffix}`;
}

export type WhatFn = (path: string) => FullWhat;

export class PathValidationContext {
  readonly context: SourceSpan;
  #parent: PathParentValidationContext;
  #path: SourceSpan;
  readonly what: WhatFn;

  constructor(parent: PathParentValidationContext, path: SourceSpan, what: WhatFn) {
    this.context = parent.context;
    this.#parent = parent;
    this.#path = path;
    this.what = what;
  }

  get span(): SourceSpan {
    return this.#path;
  }

  head(head: NameNode | (AnyNode & { type: 'Keyword'; name: string })): VariableReferenceContext {
    return new VariableReferenceContext(this, head.name, loc(head));
  }

  keyword(node: NameNode) {
    return new KeywordValidationContext(this, node.name, loc(node));
  }
}

export type ExpressionValidationContext = PathValidationContext;
export type SomeValidationContext =
  | SomeElementValidationContext
  | SomeContentValidationContext
  | SomeAppendContext
  | SomeArgsContext
  | PathValidationContext
  | VariableReferenceContext
  | ValueValidationContext
  | InvokeCustomSyntaxContext
  | KeywordValidationContext;

export type { AppendInvokeContext, AppendValueContext, SomeAppendContext } from './append';
export type {
  ArgsContainerContext,
  ArgsContext,
  NamedArgContainer,
  NamedArgContext,
  PositionalArgsContext,
  SomeArgsContext,
} from './args';
export type {
  AngleBracketContext,
  InvokeBlockContext,
  SomeContentValidationContext,
} from './content';
export type {
  ConcatContext,
  FullElementParameterValidationContext,
  InvokeElementParameterContext,
  SomeElementValidationContext,
} from './element';

/**
 * Validate the syntax of an append value (e.g. `{{foo}}`).
 */
export const append = (parent: AppendValueNode) =>
  AppendValueContext.of(parent).append(parent.value);

/**
 * Begin validating the syntax of a top-level curly (e.g. `{{foo bar}}`).
 */
export const appending = AppendValueContext.of;

/**
 * Validate the syntax of a keyword (e.g. `{{yield}}` or `{{#in-element}}`)
 */
export const custom = InvokeCustomSyntaxContext.keyword;
/**
 * Validate the syntax of an angle bracket component.
 */
export const component = AngleBracketContext.component;
/**
 * Validate the syntax of a HTML element that is not an angle bracket component.
 */
export const element = AngleBracketContext.element;

/**
 * Validate the syntax of a block (i.e. `{{#block}}`)
 */
export const block = InvokeBlockContext.of;

export const error = CustomErrorContext.for;
