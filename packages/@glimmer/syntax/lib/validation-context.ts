import type { Optional } from '@glimmer/interfaces';

import type { SourceSpan } from './source/loc/span';
import type { SourceSlice } from './source/slice';
import type { HasSourceSpan } from './source/span-list';

import { loc } from './source/span-list';

type AnyNode = HasSourceSpan & { type: string };
type ArgsNode = HasSourceSpan & { positional: AnyNode; named: AnyNode };
type NameNode = AnyNode & { name: string };
type PathNode = AnyNode & { tail: unknown };
type CallNode = AnyNode & { args: unknown };
type KeywordNode = AnyNode & { keyword: SourceSpan };

export class AngleBracketValidationContext {
  static component(span: HasSourceSpan): AngleBracketValidationContext {
    return new AngleBracketValidationContext(loc(span), 'component');
  }

  static element(span: HasSourceSpan): AngleBracketValidationContext {
    return new AngleBracketValidationContext(loc(span), 'element');
  }

  readonly type: 'component' | 'element';
  readonly syntax = 'angle-bracket';
  #span: SourceSpan;

  private constructor(span: SourceSpan, type: 'component' | 'element') {
    this.type = type;
    this.#span = span;
  }

  tag(name: AnyNode): PathValidationContext {
    return new PathValidationContext(this, loc(name), true);
  }

  attr(attr: HasSourceSpan) {
    return new FullElementParameterValidationContext(this, loc(attr), 'attr', false);
  }

  arg(arg: HasSourceSpan) {
    return new FullElementParameterValidationContext(this, loc(arg), 'arg', false);
  }

  modifier(modifier: HasSourceSpan) {
    return new ElementParameterValidationContext(this, loc(modifier), 'modifier');
  }
}

export class VariableReferenceValidationContext {
  #parent: PathValidationContext;
  #name: string;
  #callee: boolean;
  #span: SourceSpan;
  #notes: string[] = [];

  constructor(parent: PathValidationContext, name: string, callee: boolean, span: SourceSpan) {
    this.#parent = parent;
    this.#name = name;
    this.#callee = callee;
    this.#span = span;
  }

  get isCallee() {
    return this.#callee;
  }

  get name() {
    return this.#name;
  }

  addNotes(...notes: string[]) {
    this.#notes.push(...notes);
    return this;
  }
}

/**
 * The context for `attr={{...}}` and `@arg={{...}}`.
 */
export class FullElementParameterValidationContext {
  #parent: AngleBracketValidationContext;
  #container: SourceSpan;
  readonly type: 'attr' | 'arg';
  readonly isConcat: boolean;

  constructor(
    parent: AngleBracketValidationContext,
    container: SourceSpan,
    type: 'attr' | 'arg',
    isConcat: boolean
  ) {
    this.#parent = parent;
    this.#container = container;
    this.type = type;
    this.isConcat = isConcat;
  }

  concat(): FullElementParameterValidationContext {
    return new FullElementParameterValidationContext(
      this.#parent,
      this.#container,
      this.type,
      true
    );
  }

  value({ value, curly }: { value: HasSourceSpan; curly: HasSourceSpan }) {
    return ValueValidationContext.parameter(this, loc(value), { curly: loc(curly) });
  }

  invoke(curly: HasSourceSpan) {
    return new ElementParameterValidationContext(this, loc(curly), this.type);
  }

  resolved(node: HasSourceSpan & { resolved: NameNode }) {
    return ValueValidationContext.parameter(this, loc(node.resolved), {
      curly: loc(node),
    }).resolved(node.resolved);
  }
}

/**
 * An args container has `positional` and `named` properties.
 */
export interface ArgsContainerValidationContext {
  positionalArgs(positionals: AnyNode): PositionalValidationContext;
  namedContainer(container: NamedArgContainer): NamedArgValidationContext;
  namedArg(arg: NamedArgContainer & { value: AnyNode }): ValueValidationContext;
}

export class ArgsValidationContext implements ArgsContainerValidationContext {
  #parent: ArgsParentValidationContext;
  #positional: SourceSpan;
  #named: SourceSpan;

  constructor(parent: ArgsParentValidationContext, positional: SourceSpan, named: SourceSpan) {
    this.#parent = parent;
    this.#positional = positional;
    this.#named = named;
  }

  positionalArgs(): PositionalValidationContext {
    return new PositionalValidationContext(this.#parent, this.#positional);
  }

  namedContainer(container: NamedArgContainer) {
    return new NamedArgValidationContext(this.#parent, container);
  }

  namedArg(arg: NamedArgContainer & { value: AnyNode }): ValueValidationContext {
    return this.namedContainer(arg).value(arg.value);
  }
}

export class PositionalValidationContext {
  #parent: ArgsParentValidationContext;
  #span: SourceSpan;

  constructor(parent: ArgsParentValidationContext, span: SourceSpan) {
    this.#parent = parent;
    this.#span = span;
  }

  value(value: HasSourceSpan) {
    return ValueValidationContext.positional(this.#parent, loc(value));
  }
}

export class ConcatValidationContext {
  #parent: FullElementParameterValidationContext;
  #span: SourceSpan;

  constructor(parent: FullElementParameterValidationContext, span: SourceSpan) {
    this.#parent = parent;
    this.#span = span;
  }

  value(value: HasSourceSpan) {
    return ValueValidationContext.concat(this.#parent, loc(value));
  }
}

export class NamedArgValidationContext {
  #parent: ArgsParentValidationContext;
  #container: NamedArgContainer;

  constructor(parent: ArgsParentValidationContext, container: NamedArgContainer) {
    this.#parent = parent;
    this.#container = container;
  }

  value(arg: HasSourceSpan) {
    return ValueValidationContext.named(this.#parent, loc(arg), this.#container);
  }
}

export interface NamedArgContainer {
  key: SourceSlice;
  loc: SourceSpan;
}

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
      parent: AppendValueValidationContext;
    }
  | {
      type: 'callee';
      parent: CalleeParentContext;
    }
  | {
      type: 'attr' | 'arg';
      parent: FullElementParameterValidationContext;
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

  static concat(parent: FullElementParameterValidationContext, value: SourceSpan) {
    return new ValueValidationContext({ type: 'concat', parent }, value);
  }

  static named(
    parent: ArgsParentValidationContext,
    value: SourceSpan,
    container: NamedArgContainer
  ) {
    return new ValueValidationContext({ type: 'named', parent, container }, value);
  }

  static append(parent: AppendValueValidationContext, value: SourceSpan) {
    return new ValueValidationContext({ type: 'append', parent }, value);
  }

  static callee(parent: CalleeParentContext, value: SourceSpan): ValueValidationContext {
    return new ValueValidationContext({ type: 'callee', parent }, value);
  }

  static parameter(
    parent: FullElementParameterValidationContext,
    value: SourceSpan,
    { curly }: { curly: SourceSpan }
  ) {
    return new ValueValidationContext({ type: parent.type, parent, curly }, value);
  }

  #parent: ValueParent;
  #value: SourceSpan;
  /**
   * If the argument is named, this includes the `name=` part.
   */
  #arg: Optional<SourceSpan>;
  #label: Optional<string>;

  private constructor(parent: ValueParent, value: SourceSpan, arg?: SourceSpan, label?: string) {
    this.#parent = parent;
    this.#value = value;
    this.#arg = arg;
    this.#label = label;
  }

  resolved(node: NameNode): VariableReferenceValidationContext {
    return new PathValidationContext(this, loc(node), this.#parent.type === 'callee').head(node);
  }

  custom(node: KeywordNode): InvokeCustomSyntaxValidationContext {
    return InvokeCustomSyntaxValidationContext.expr(this, node);
  }

  subexpression(node: CallNode): SubExpressionValidationContext {
    return new SubExpressionValidationContext(this, loc(node));
  }

  path(): PathValidationContext {
    return new PathValidationContext(this, this.#value, false);
  }

  labelled(name: string): ValueValidationContext {
    return new ValueValidationContext(this.#parent, this.#value, this.#arg, name);
  }
}

export class AppendValueValidationContext {
  static of(span: HasSourceSpan) {
    return new AppendValueValidationContext(loc(span));
  }

  #append: SourceSpan;

  constructor(span: SourceSpan) {
    this.#append = span;
  }

  subexpression(value: CallNode) {
    return new SubExpressionValidationContext(this, loc(value));
  }

  append(value: HasSourceSpan) {
    return ValueValidationContext.append(this, loc(value));
  }
}

export class InvokeBlockValidationContext {
  static of(span: HasSourceSpan) {
    return new InvokeBlockValidationContext(loc(span));
  }

  #block: SourceSpan;

  constructor(span: SourceSpan) {
    this.#block = span;
  }

  callee(callee: AnyNode) {
    return ValueValidationContext.callee(this, loc(callee));
  }

  resolved(node: NameNode): VariableReferenceValidationContext {
    return ValueValidationContext.callee(this, loc(node)).resolved(node);
  }

  args(args: ArgsNode) {
    return new ArgsValidationContext(this, loc(args.positional), loc(args.named));
  }
}

export class InvokeCustomSyntaxValidationContext implements ArgsContainerValidationContext {
  static keyword(syntax: KeywordNode) {
    return new InvokeCustomSyntaxValidationContext(syntax.keyword, loc(syntax));
  }

  static expr(parent: ValueValidationContext, syntax: KeywordNode) {
    return new InvokeCustomSyntaxValidationContext(syntax.keyword, loc(syntax), parent);
  }

  /**
   * This is present for expression keywords
   */
  #parent: Optional<ValueValidationContext>;
  #name: SourceSpan;
  #syntax: SourceSpan;

  constructor(name: SourceSpan, syntax: SourceSpan, parent?: Optional<ValueValidationContext>) {
    this.#name = name;
    this.#syntax = syntax;
    this.#parent = parent;
  }

  callee(callee: AnyNode) {
    return ValueValidationContext.callee(this, loc(callee));
  }

  positionalArgs(positional: AnyNode) {
    return new PositionalValidationContext(this, loc(positional));
  }

  positional(name: string, positional: AnyNode) {
    return ValueValidationContext.positional(this, loc(positional)).labelled(name);
  }

  namedContainer(container: NamedArgContainer) {
    return new NamedArgValidationContext(this, container);
  }

  namedArg(arg: NamedArgContainer & { value: AnyNode }): ValueValidationContext {
    return this.namedContainer(arg).value(arg.value);
  }
}

export class AppendInvokeValidationContext {
  static of(span: HasSourceSpan) {
    return new AppendInvokeValidationContext(loc(span));
  }

  #append: SourceSpan;

  constructor(span: SourceSpan) {
    this.#append = span;
  }

  resolvedCallee(callee: NameNode) {
    return ValueValidationContext.callee(this, loc(callee)).resolved(callee);
  }

  callee(callee: HasSourceSpan) {
    return ValueValidationContext.callee(this, loc(callee));
  }

  args(args: ArgsNode) {
    return new ArgsValidationContext(this, loc(args.positional), loc(args.named));
  }
}

export type CalleeParentContext =
  | ElementParameterValidationContext
  | InvokeBlockValidationContext
  | AppendInvokeValidationContext
  | InvokeCustomSyntaxValidationContext
  | SubExpressionValidationContext;

/**
 * These represent `{{}}`s that live inside of an element or component tag:
 *
 * - attribute values
 * - argument values
 * - modifiers
 */
export class ElementParameterValidationContext {
  #parent: FullElementParameterValidationContext | AngleBracketValidationContext;
  #curly: SourceSpan;
  readonly type: FullElementParameterValidationContext['type'] | 'modifier';

  constructor(parent: AngleBracketValidationContext, curly: SourceSpan, type: 'modifier');
  constructor(
    parent: FullElementParameterValidationContext,
    curly: SourceSpan,
    type: FullElementParameterValidationContext['type']
  );
  constructor(
    parent: FullElementParameterValidationContext | AngleBracketValidationContext,
    curly: SourceSpan,
    type: FullElementParameterValidationContext['type'] | 'modifier'
  ) {
    this.#parent = parent;
    this.#curly = curly;
    this.type = type;
  }

  callee(callee: HasSourceSpan): ValueValidationContext {
    return ValueValidationContext.callee(this, loc(callee));
  }

  value(value: HasSourceSpan) {
    return ValueValidationContext.parameter(this, loc(value));
  }

  resolved(node: NameNode): VariableReferenceValidationContext {
    return new PathValidationContext(this, loc(node), this.type === 'modifier').head(node);
  }

  path(path: PathNode): PathValidationContext {
    return new PathValidationContext(this, loc(path), false);
  }

  keyword(node: NameNode) {
    return new PathValidationContext(this, loc(node), false).keyword(node);
  }

  args(args: ArgsNode) {
    return new ArgsValidationContext(this, loc(args.positional), loc(args.named));
  }
}

export type ValueParentContext =
  | ElementParameterValidationContext
  | PositionalValidationContext
  | NamedArgValidationContext
  | AppendInvokeValidationContext
  | ValueValidationContext;

export type SubExpressionParentContext =
  | ElementParameterValidationContext
  | AppendValueValidationContext
  | ArgsValidationContext
  | ValueValidationContext;

export class SubExpressionValidationContext {
  readonly type = 'subexpression';
  #custom: Optional<string>;
  #parent: SubExpressionParentContext;
  #call: SourceSpan;

  constructor(parent: SubExpressionParentContext, call: SourceSpan) {
    this.#parent = parent;
    this.#call = call;
  }

  resolved(callee: NameNode) {
    return new PathValidationContext(this, loc(callee), true).head(callee);
  }

  callee(callee: AnyNode) {
    return ValueValidationContext.callee(this, loc(callee));
  }

  args(args: ArgsNode) {
    return new ArgsValidationContext(this, loc(args.positional), loc(args.named));
  }
}

/**
 * All of these types are parents of an args list
 */
export type ArgsParentValidationContext =
  | AngleBracketValidationContext
  | ElementParameterValidationContext
  | SubExpressionValidationContext
  | AppendInvokeValidationContext
  | InvokeCustomSyntaxValidationContext
  | InvokeBlockValidationContext;

export class KeywordValidationContext {
  #parent: PathValidationContext;
  #name: string;
  #keyword: SourceSpan;

  constructor(parent: PathValidationContext, name: string, keyword: SourceSpan) {
    this.#parent = parent;
    this.#name = name;
    this.#keyword = keyword;
  }
}

export type PathParentValidationContext = ArgsParentValidationContext | ValueValidationContext;

export class PathValidationContext {
  #parent: PathParentValidationContext;
  #path: SourceSpan;
  /**
   * Whether the path is used as a callee. If a path is used as a callee, error messages will report
   * errors for syntax like `{{foo bar}}` as "attempted to invoke ...", where syntax like `{{foo}}`
   * will report as "attempted to append" or equivalent.
   */
  #callee: boolean;

  constructor(parent: PathParentValidationContext, path: SourceSpan, callee: boolean) {
    this.#parent = parent;
    this.#path = path;
    this.#callee = callee;
  }

  head(head: NameNode): VariableReferenceValidationContext {
    return new VariableReferenceValidationContext(this, head.name, this.#callee, loc(head));
  }

  keyword(node: NameNode) {
    return new KeywordValidationContext(this, node.name, loc(node));
  }
}

export type ExpressionValidationContext = PathValidationContext;
