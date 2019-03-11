import * as hbs from '../../types/handlebars-ast';
import { TokenKind } from '../lex';
import { LexItem, Tokens, Debug } from '../lexing';
import { Macro } from '../macros';
import { Dict } from '@glimmer/interfaces';
import { MACROS_V1 } from './macros';
import { ROOT } from './top';
import { ElementStack } from './html';

export function node<T>(value: T): (span: hbs.Span) => T {
  return () => value;
}

export type Thunk<T> = (span: hbs.Span) => T;

export const UNMATCHED: UNMATCHED = 'UNMATCHED [2aa17b5c-bf5e-4f6f-8ca9-09aa3af80902]';
export type UNMATCHED = 'UNMATCHED [2aa17b5c-bf5e-4f6f-8ca9-09aa3af80902]';

export interface Macros {
  expr: Dict<Macro<hbs.Expression>>;
  head: Dict<Macro<hbs.Head>>;
}

export interface Syntax<T> {
  readonly description: string;
  // If `parse` returns null, no tokens may be consumed
  parse(parser: HandlebarsParser): T | UNMATCHED;
}

export interface InfallibleSyntax<T> {
  readonly description: string;
  // If `parse` returns null, no tokens may be consumed
  parse(parser: HandlebarsParser): T;
}

export interface FallibleSyntax<T> extends Syntax<T> {
  readonly fallible: true;
  readonly description: string;
  parse(parser: HandlebarsParser): T | UNMATCHED;
  orElse(parser: HandlebarsParser): T;
}

export class HandlebarsParser {
  private errors: Diagnostic[] = [];
  private debugStack: string[] = [];
  readonly stack: ElementStack;

  constructor(
    readonly source: string,
    private tokens: Tokens,
    private debug: Debug,
    private macros: Macros = MACROS_V1
  ) {
    this.stack = new ElementStack(source, this);
  }

  RootProgram(): hbs.Root {
    return this.expect(ROOT);
  }

  appendNode(node: hbs.ConcatContent): void {
    this.stack.appendNode(node, this.source);
  }

  appendBlock(node: hbs.BlockStatement): void {
    this.stack.appendBlock(node);
  }

  checkpoint() {
    this.trace('checkpoint');
    return new HandlebarsParser(this.source, this.tokens.clone(), this.debug, this.macros);
  }

  isStartLine(): boolean {
    return this.tokens.isBeginningOfLine;
  }

  position(): number {
    return this.tokens.charPos;
  }

  is(token: TokenKind, value?: string): boolean {
    let next = this.tokens.peek();
    let isToken = next.kind === token;

    if (!isToken) return false;

    if (value !== undefined) {
      return this.slice(next.span) === value;
    } else {
      return true;
    }
  }

  isCurlyPath(value: string): boolean {
    if (this.peek().kind === TokenKind.Open) {
      let checkpoint = this.checkpoint();
      checkpoint.shift();

      let next = checkpoint.peek();
      return next.kind === TokenKind.Identifier && this.slice(next.span) === value;
    }

    return false;
  }

  isPath(value: string): boolean {
    let token = this.tokens.peek();

    if (token.kind === TokenKind.Identifier && this.slice(token.span) === value) {
      return true;
    } else {
      return false;
    }
  }

  isMacro(kind: keyof Macros): boolean {
    let next = this.tokens.peek();

    if (kind in this.macros) {
      if (next.kind === TokenKind.Identifier) {
        let macros = this.macros[kind]!;
        let name = this.slice(next.span);

        return name in macros;
      }
    }

    return false;
  }

  expandExpressionMacro(): hbs.Expression {
    let next = this.shift();

    let macros = this.macros.expr!;
    let macro = macros[this.slice(next.span)];

    return macro.parse(next.span, this);
  }

  expandHeadMacro(): hbs.Head {
    let next = this.shift();

    let macros = this.macros.head!;
    let macro = macros[this.slice(next.span)];

    return macro.parse(next.span, this);
  }

  slice(span: hbs.Span): string {
    return this.source.slice(span.start, span.end);
  }

  peekSlice(): string {
    return this.slice(this.peek().span);
  }

  report(message: string, span: hbs.Span): Diagnostic {
    return reportError(this.errors, message, span);
  }

  shift(): LexItem<TokenKind> {
    return this.consume();
  }

  skipToken(): LexItem<TokenKind> {
    return this.consume();
  }

  private consume(): LexItem<TokenKind> {
    this.trace(
      `Consuming ${JSON.stringify(this.slice(this.tokens.peek().span))} @ ${JSON.stringify(
        this.tokens.peek().span
      )}`
    );

    return this.tokens.consume();
  }

  peek(): LexItem<TokenKind> {
    return this.tokens.peek();
  }

  peek2(): LexItem<TokenKind> | undefined {
    return this.tokens.peek2();
  }

  isEOF(): boolean {
    return this.tokens.peek().kind === TokenKind.EOF;
  }

  parse<T>(syntax: Syntax<T>): T | UNMATCHED {
    this.enter(syntax);

    let next = syntax.parse(this);

    this.exit(syntax);

    return next;
  }

  /**
   * This method computes a span for the tokens consumed inside the callback.
   *
   * The span starts from the first token consumed inside of the callback and ends
   * at the last token consumed.
   */
  spanned<T>(callback: () => T): { value: T; span: hbs.Span } {
    let start = this.peek().span.start;
    let value = callback();
    let end = this.position();

    return { value, span: { start, end } };
  }

  commit(checkpoint: HandlebarsParser) {
    this.tokens.commit(checkpoint.tokens);
  }

  private orElse<T>(syntax: FallibleSyntax<T>): T {
    let value = syntax.orElse(this);

    let span = { start: this.position(), end: this.position() };
    this.report(
      `Expected ${syntax.description} (saw ${JSON.stringify(this.peek())} / ${this.source.slice(
        this.position(),
        this.position() + 3
      )}...)`,
      span
    );

    return value;
  }

  expect<T>(syntax: FallibleSyntax<T>): T {
    let result = this.parse(syntax);
    if (result !== UNMATCHED) {
      return result;
    } else {
      return this.orElse(syntax);
    }
  }

  test(syntax: Syntax<unknown>): boolean {
    let checkpoint = this.checkpoint();
    let result = syntax.parse(checkpoint);

    return result !== UNMATCHED;
  }

  private enter(syntax: Syntax<unknown>): void {
    this.debugStack.push(syntax.description);
    this.trace(JSON.stringify(this.debugStack));
  }

  private exit(_syntax: Syntax<unknown>): void {
    this.debugStack.pop();
  }

  trace(value: string): void {
    if (this.debug.trace) {
      this.debug.trace(value);
    }
  }
}

export function reportError(errors: Diagnostic[], message: string, span: hbs.Span): Diagnostic {
  let diagnostic = new Diagnostic(span, message);
  errors.push(diagnostic);

  throw new Error(`${message} at ${span.start}:${span.end}`);

  return diagnostic;
}

export class Diagnostic {
  constructor(readonly span: hbs.Span, readonly message: string) {}
}
