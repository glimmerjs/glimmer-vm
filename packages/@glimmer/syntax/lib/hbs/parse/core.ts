import * as hbs from '../../types/handlebars-ast';
import { TokenKind } from '../lex';
import { LexItem, Tokens, Debug } from '../lexing';
import { Macro } from '../macros';
import { Dict, Option } from '@glimmer/interfaces';
import { Frame } from './frame';
import { MACROS_V1 } from './macros';
import { expect, unwrap } from '@glimmer/util';
import { ROOT } from './top';

export function node<T>(value: T): (span: hbs.Span) => T {
  return () => value;
}

export type Thunk<T> = (span: hbs.Span) => T;

export interface Syntax<T, U extends NonNullable<unknown>> {
  readonly description: string;
  test(parser: HandlebarsParser): Option<U>;
  parse(parser: HandlebarsParser, state: U): Thunk<T>;
}

export interface Macros {
  expr: Dict<Macro<hbs.Expression>>;
  head: Dict<Macro<hbs.Head>>;
}

export interface FallibleSyntax<T, U extends NonNullable<unknown>> extends Syntax<T, U> {
  readonly fallible: true;
  readonly description: string;
  test(parser: HandlebarsParser): Option<U>;
  parse(parser: HandlebarsParser, state: U): Thunk<T>;
  orElse(parser: HandlebarsParser): Thunk<T>;
}

export class HandlebarsParser {
  private errors: Diagnostic[] = [];
  private debugStack: string[] = [];

  constructor(
    private input: string,
    private tokens: Tokens,
    private debug: Debug,
    private macros: Macros = MACROS_V1,
    private isCheckpoint = false,
    private frames: Frame[] = [],
    private beginningOfLine = true,
    private pos = 0
  ) {}

  RootProgram(): hbs.AnyProgram {
    this.frames.push(new Frame(this.pos));
    let ret = this.parse(ROOT, true);
    this.frames.pop();
    return ret;
  }

  checkpoint() {
    this.trace('checkpoint');
    return new HandlebarsParser(
      this.input,
      this.tokens.clone(),
      this.debug,
      this.macros,
      true,
      this.frames,
      this.beginningOfLine,
      this.pos
    );
  }

  isStartLine(): boolean {
    return this.beginningOfLine;
  }

  position(): number {
    return this.pos;
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
    return this.input.slice(span.start, span.end);
  }

  peekSlice(): string {
    return this.slice(this.peek().span);
  }

  report(message: string, span: hbs.Span): Diagnostic {
    return reportError(this.errors, message, span);
  }

  shift(): LexItem<TokenKind> {
    let next = this.consume();
    if (!this.isCheckpoint) this.currentFrame.addToken(next.span);
    return next;
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
    let next = this.tokens.consume();
    this.pos = next.span.end;

    if (next.kind === TokenKind.Newline) {
      this.beginningOfLine = true;
    } else {
      this.beginningOfLine = false;
    }

    return next;
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

  test<U extends NonNullable<unknown>>(syntax: Syntax<unknown, U>): Option<U> {
    return syntax.test(this);
  }

  parse<T, U extends NonNullable<unknown>>(syntax: Syntax<T, U>, value: U): T {
    this.enter(syntax);

    let out = this.currentFrame.addThunk(this.parseSyntax(syntax, value));

    this.exit(syntax);
    return out;
  }

  skip<T, U extends NonNullable<unknown>>(syntax: Syntax<T, U>, testValue: U): T {
    let checkpoint = this.checkpoint();
    let out = checkpoint.parse(syntax, testValue);
    this.commit(checkpoint);

    return out;
  }

  private commit(checkpoint: HandlebarsParser) {
    this.pos = checkpoint.pos;
    this.beginningOfLine = checkpoint.beginningOfLine;
    this.tokens.commit(checkpoint.tokens);
  }

  private orElse<T>(syntax: FallibleSyntax<T, unknown>): T {
    this.currentFrame.mark();
    let value = syntax.orElse(this);
    this.currentFrame.unmark();

    let span = { start: this.pos, end: this.pos };
    this.report(
      `Expected ${syntax.description} (saw ${this.input.slice(this.pos, this.pos + 3)}...)`,
      span
    );
    return this.currentFrame.addThunk({ span: { start: this.pos, end: this.pos }, value });
  }

  expect<T>(syntax: FallibleSyntax<T, unknown>): T {
    let result = this.test(syntax);
    if (result !== null) {
      return this.parse(syntax, result);
    } else {
      return this.orElse(syntax);
    }
  }

  private enter(syntax: Syntax<unknown, unknown>): void {
    this.debugStack.push(syntax.description);
    this.trace(JSON.stringify(this.debugStack));
  }

  private exit(_syntax: Syntax<unknown, unknown>): void {
    this.debugStack.pop();
  }

  private parseSyntax<T, U extends NonNullable<unknown>>(
    syntax: Syntax<T, U>,
    value: U
  ): { span: hbs.Span; value: (span: hbs.Span) => T } {
    let ret: (span: hbs.Span) => T;
    this.frames.push(new Frame(this.pos));
    ret = syntax.parse(this, value);
    let frame = this.frames.pop()!;
    return { span: frame.finalize(), value: unwrap(ret) };
  }

  get currentFrame(): Frame {
    return expect(this.frames[this.frames.length - 1], `Unexpected syntax push into empty frame`);
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
