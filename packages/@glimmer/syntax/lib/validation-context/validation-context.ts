import type { Optional } from '@glimmer/interfaces';

import type { SourceSpan } from '../source/loc/span';
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

import { loc } from '../source/span-list';
import { AppendValueContext } from './append';
import { ArgsContext, NamedArgContext, PositionalArgsContext } from './args';
import { AngleBracketContext, getCalleeContext, InvokeBlockValidationContext } from './content';

export type AnyNode = HasSourceSpan & { type: string };
export type AppendValueNode = AnyNode & { value: AnyNode };
export type ArgsNode = HasSourceSpan & { positional: AnyNode; named: AnyNode };
export type NameNode = AnyNode & { name: string };
export type ResolvedNode = AnyNode & { resolved: NameNode };
export type PathNode = AnyNode & { tail: unknown };
export type CallNode = AnyNode & { args: unknown };
export type KeywordNode = AnyNode & { keyword: SourceSlice };

export function isResolvedName(node: AnyNode): node is NameNode {
  return node.type === 'ResolvedName';
}

export interface AnyAttrLikeContainerContext {
  value(options: { value: HasSourceSpan; curly: HasSourceSpan }): ValueValidationContext;
  invoke(curly: HasSourceSpan): InvokeElementParameterContext;
  callee(node: ResolvedNode): VariableReferenceValidationContext;
}

export interface AnyValidationContext {
  /**
   * The full span of the top-level content node that this validation is nested inside of.
   */
  readonly context: SourceSpan;
}

export class VariableReferenceValidationContext {
  readonly context: SourceSpan;
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

  get path(): { path: SourceSpan; head?: SourceSpan } {
    const path = this.#parent.path;

    if (path.isEqual(this.#span)) {
      return { path };
    } else {
      return { path, head: this.#span };
    }
  }

  get error() {
    return 'unimplemented';
  }

  get loc() {
    return this.#span;
  }

  get name() {
    return this.#name;
  }

  get notes() {
    return this.#notes;
  }

  addNotes(...notes: string[]) {
    this.#notes.push(...notes);
    return this;
  }
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
    }
  | {
      type: 'attr' | 'arg';
      parent: FullElementParameterValidationContext;
      curly: SourceSpan;
    }
  | {
      type: 'concat';
      parent: ConcatContext;
      curly: SourceSpan;
    };

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
    value: SourceSpan
  ): ValueValidationContext {
    return new ValueValidationContext({ type: 'callee', kind, parent }, value);
  }

  static concat(parent: ConcatContext, value: SourceSpan, { curly }: { curly: SourceSpan }) {
    return new ValueValidationContext({ type: 'concat', parent, curly }, value);
  }

  static parameter(
    parent: FullElementParameterValidationContext,
    value: SourceSpan,
    { curly }: { curly: SourceSpan }
  ) {
    return new ValueValidationContext({ type: parent.type, parent, curly }, value);
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

  resolved(node: NameNode): VariableReferenceValidationContext {
    return new PathValidationContext(this, loc(node), this.#what).head(node);
  }

  custom(node: KeywordNode): InvokeCustomSyntaxValidationContext {
    return InvokeCustomSyntaxValidationContext.expr(this, node);
  }

  subexpression(node: CallNode): SubExpressionValidationContext {
    return new SubExpressionValidationContext(this, loc(node));
  }

  path(): PathValidationContext {
    return new PathValidationContext(this, this.#value, this.#what);
  }

  labelled(name: string): ValueValidationContext {
    return new ValueValidationContext(this.#parent, this.#value, name);
  }
}

export class InvokeCustomSyntaxValidationContext implements ArgsContainerContext {
  static keyword(this: void, syntax: KeywordNode) {
    return new InvokeCustomSyntaxValidationContext(syntax.keyword, loc(syntax));
  }

  static expr(parent: ValueValidationContext, syntax: KeywordNode) {
    return new InvokeCustomSyntaxValidationContext(syntax.keyword, loc(syntax), parent);
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

export interface AnyInvokeParentContext extends AnyValidationContext {
  readonly type: InvokeSyntaxType;

  callee(callee: NameNode): VariableReferenceValidationContext;
  callee(callee: AnyNode): ValueValidationContext;
  args(args: ArgsNode): ArgsContext;
}

export interface AnyAmbiguousParentContext extends AnyValidationContext {
  readonly type: AmbiguousSyntaxName;
  readonly isInvoke: boolean;
}

export type InvokeParentContext =
  | InvokeElementParameterContext
  | InvokeBlockValidationContext
  | AppendInvokeContext
  | InvokeCustomSyntaxValidationContext
  | SubExpressionValidationContext;

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
export class SubExpressionValidationContext implements AnyInvokeParentContext {
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

  callee(callee: NameNode): VariableReferenceValidationContext;
  callee(callee: AnyNode): ValueValidationContext;
  callee(callee: AnyNode) {
    return getCalleeContext('subexpression', this, callee);
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
  | SubExpressionValidationContext
  | AppendInvokeContext
  | InvokeCustomSyntaxValidationContext
  | InvokeBlockValidationContext;

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

export class PathValidationContext {
  readonly context: SourceSpan;
  #parent: PathParentValidationContext;
  #path: SourceSpan;
  /**
   * Whether the path is used as a callee. If a path is used as a callee, error messages will report
   * errors for syntax like `{{foo bar}}` as "attempted to invoke ...", where syntax like `{{foo}}`
   * will report as "attempted to append" or equivalent.
   */
  #what: { type: string; callee: boolean };

  constructor(
    parent: PathParentValidationContext,
    path: SourceSpan,
    what: { type: string; callee: boolean }
  ) {
    this.context = parent.context;
    this.#parent = parent;
    this.#path = path;
    this.#what = what;
  }

  get path(): SourceSpan {
    return this.#path;
  }

  head(head: NameNode): VariableReferenceValidationContext {
    return new VariableReferenceValidationContext(this, head.name, loc(head));
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
  | VariableReferenceValidationContext
  | ValueValidationContext
  | InvokeCustomSyntaxValidationContext
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
  InvokeBlockValidationContext,
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
export const custom = InvokeCustomSyntaxValidationContext.keyword;
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
export const block = InvokeBlockValidationContext.of;
