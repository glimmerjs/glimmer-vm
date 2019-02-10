import { Dict, Option } from '@glimmer/interfaces';
import { assert, assign, unwrap, expect } from '@glimmer/util';
import * as hbs from '../types/handlebars-ast';
import { TokenKind } from './lex';
import { Debug, LexItem, Spanned, Tokens } from './lexing';
import { FALSE_MACRO, Macro, NULL_MACRO, THIS_MACRO, TRUE_MACRO, UNDEFINED_MACRO } from './macros';

export interface Macros {
  expr: Dict<Macro<hbs.Expression>>;
  head: Dict<Macro<hbs.Head>>;
}

const MACROS_V1 = {
  expr: {
    true: TRUE_MACRO,
    false: FALSE_MACRO,
    null: NULL_MACRO,
    undefined: UNDEFINED_MACRO,
  },

  head: {
    this: THIS_MACRO,
  },
};

class Frame {
  private items: hbs.Span[] = [];
  private marked = false;

  constructor(private startPos: number) {}

  add(item: hbs.Span): void {
    if (this.marked) {
      throw new Error(`Can't parse while applying span to final parsed syntax`);
    }

    this.items.push(item);
  }

  mark(): void {
    this.marked = true;
  }

  unmark(): void {
    this.marked = false;
  }

  finalize(syntax: Syntax<unknown>): hbs.Span;
  finalize(syntax: ListSyntax<unknown>): hbs.Span | null;
  finalize(syntax: Syntax<unknown> | ListSyntax<unknown>): hbs.Span | null {
    if (syntax.allowEmpty && this.items.length === 0) {
      return { start: this.startPos, end: this.startPos };
    }
    if (this.items.length === 0) {
      throw new Error(
        `Can't finalize <<${syntax.description()}>> without any consumed tokens (perhaps the consumption is in the span callback?)`
      );
    }

    let first = this.items[0];
    let last = this.items[this.items.length - 1];

    return { start: first.start, end: last.end };
  }
}

export class HandlebarsParser {
  private errors: Diagnostic[] = [];
  private debugStack: string[] = [];
  private frames: Frame[] = [];

  constructor(
    private input: string,
    private tokens: Tokens,
    private debug: Debug,
    private macros: Macros = MACROS_V1,
    private isCheckpoint = false,
    private pos = 0
  ) {}

  RootProgram(): hbs.AnyProgram {
    this.frames.push(new Frame(this.pos));
    let ret = this.expect(ROOT);
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
      this.pos
    );
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

  report(message: string, span: hbs.Span): Diagnostic {
    return reportError(this.errors, message, span);
  }

  shift(): LexItem<TokenKind> {
    this.trace(
      `Shifting ${JSON.stringify(this.slice(this.tokens.peek().span))} @ ${JSON.stringify(
        this.tokens.peek().span
      )}`
    );
    let next = this.tokens.consume();
    if (!this.isCheckpoint) this.currentFrame.add(next.span);
    this.pos = next.span.end;
    return next;
  }

  peek(): LexItem<TokenKind> {
    return this.tokens.peek();
  }

  isEOF(): boolean {
    return this.tokens.peek().kind === TokenKind.EOF;
  }

  test(syntax: Syntax<unknown>): boolean {
    return syntax.test(this);
  }

  frame<T>(
    syntax: Syntax<T> | ListSyntax<T>,
    callback: () => (span: hbs.Span) => T
  ): { span: hbs.Span; value: (span: hbs.Span) => T } {
    let ret: (span: hbs.Span) => T;
    this.frames.push(new Frame(this.pos));
    ret = callback();
    let frame = this.frames.pop()!;
    return { span: frame.finalize(syntax), value: unwrap(ret) };
  }

  get currentFrame(): Frame {
    return expect(this.frames[this.frames.length - 1], `Unexpected syntax push into empty frame`);
  }

  expect<T>(syntax: Syntax<T> | ListSyntax<T>): T {
    this.debugStack.push(syntax.description());
    this.trace(JSON.stringify(this.debugStack));

    try {
      let { span, value: thunk } = this.frame<T>(syntax, () => {
        let maybeThunk = syntax.parse(this);
        if (isThunk(maybeThunk)) {
          return maybeThunk;
        } else {
          let value = maybeThunk;
          return (_span: hbs.Span) => value;
        }
      });

      this.currentFrame.add(span);
      this.currentFrame.mark();

      let out = thunk(span);
      this.currentFrame.unmark();
      return out;
    } finally {
      this.debugStack.pop();
    }
  }

  trace(value: string): void {
    if (this.debug.trace) {
      this.debug.trace(value);
    }
  }
}

export interface Syntax<T> {
  allowEmpty?: boolean;
  description(): string;
  test(parser: HandlebarsParser): boolean;
  parse(parser: HandlebarsParser): ((span: hbs.Span) => T) | T;
}

export interface ListSyntax<T> {
  allowEmpty: true;
  description(): string;
  test(parser: HandlebarsParser): boolean;
  parse(parser: HandlebarsParser): ((span: hbs.Span | null) => T) | T;
}

export function isThunk<T>(parsed: ((span: hbs.Span) => T) | T): parsed is (span: hbs.Span) => T {
  return typeof parsed === 'function';
}

export type AstSyntax<T extends hbs.AnyNode = hbs.AnyNode> = Syntax<T>;
export type StatementSyntax<T extends hbs.Statement = hbs.Statement> = Syntax<T>;
export type ExpressionSyntax<T extends hbs.Expression = hbs.Expression> = Syntax<T>;

const NO_SPAN = { start: -1, end: -1 };
const NO_STRIP: hbs.StripFlags = { open: false, close: false };

export const ROOT: Syntax<hbs.AnyProgram> = {
  description() {
    return 'root';
  },

  test() {
    return true;
  },

  parse(parser) {
    let statements: hbs.Statement[] = [];

    while (true) {
      let next = parser.peek();
      if (next.kind === TokenKind.EOF) {
        break;
      } else {
        statements.push(parser.expect(TOP));
      }
    }

    return span => ({
      type: 'Program',
      span,
      body: statements,
    });
  },
};

export const TOP: StatementSyntax<hbs.Statement> = {
  description() {
    return 'top level';
  },

  test(parser) {
    return (
      parser.test(CONTENT) || parser.test(CURLIES) || parser.test(COMMENT) || parser.test(BLOCK)
    );
  },

  parse(parser) {
    if (parser.test(CONTENT)) {
      let content = parser.expect(CONTENT);
      return () => content;
    } else if (parser.test(CURLIES)) {
      let curlies = parser.expect(CURLIES);
      return () => curlies;
    } else if (parser.test(COMMENT)) {
      let comment = parser.expect(COMMENT);
      return () => comment;
    } else if (parser.test(BLOCK)) {
      let block = parser.expect(BLOCK);
      return () => block;
    } else {
      let token = parser.peek();
      throw new Error(
        `unimplemented (Top @ ${JSON.stringify(token)} :: ${parser.slice(token.span)})`
      );
    }
  },
};

export const BLOCK_UNTIL_ELSE: Syntax<hbs.Program> = {
  allowEmpty: true,

  description() {
    return '{{#...}} -> ( ... ) -> {{else | {{/...}}';
  },

  test(parser) {
    let next = parser.peek().kind;

    if (next === TokenKind.OpenEndBlock || next === TokenKind.EOF) {
      return false;
    } else if (parser.isCurlyPath('else')) {
      return false;
    } else {
      return true;
    }
  },

  parse(parser) {
    let blockStatements: hbs.Statement[] = [];

    while (true) {
      if (parser.is(TokenKind.OpenEndBlock)) {
        break;
      } else if (parser.is(TokenKind.EOF)) {
        throw new Error('unimplemented: unexpected EOF');
      } else if (parser.isCurlyPath('else')) {
        break;
      }

      let next = parser.expect(TOP);

      blockStatements.push(next);
    }

    return span => ({
      type: 'Program',
      span,
      body: blockStatements,
      blockParams: [],
    });
  },
};

export function EMPTY_PROGRAM(span: hbs.Span): hbs.Program {
  return {
    type: 'Program',
    span,
    body: [],
    blockParams: [],
  };
}

export const END_BLOCK: Syntax<Spanned<LexItem<TokenKind.Identifier>>> = {
  description() {
    return `{{/...}}`;
  },

  test(parser) {
    return parser.is(TokenKind.OpenEndBlock);
  },

  parse(parser) {
    parser.expect(new TokenSyntax(TokenKind.OpenEndBlock));
    let id = parser.expect(new TokenSyntax(TokenKind.Identifier));
    parser.expect(new TokenSyntax(TokenKind.Close));

    return span => ({
      span,
      value: id,
    });
  },
};

export const IN_BLOCK: Syntax<
  Spanned<{
    block: hbs.Program;
    inverse: Option<hbs.Program>;
  }>
> = {
  description() {
    return '{{#...}} -> ( ... ) -> {{/...}}';
  },

  test(parser) {
    return parser.is(TokenKind.OpenEndBlock) || parser.test(TOP);
  },

  parse(parser) {
    let inverse: Option<hbs.Program> = null;

    let program = parser.expect(BLOCK_UNTIL_ELSE);

    if (parser.isCurlyPath('else')) {
      let chainStartToken = parser.shift();
      parser.shift();
      if (parser.test(MUSTACHE_CALL_AFTER_CURLY)) {
        let chainMustache = parser.expect(MUSTACHE_CALL_AFTER_CURLY);
        let chainBlock = parser.expect(IN_BLOCK);

        let block: hbs.BlockStatement = {
          type: 'BlockStatement',
          span: { start: chainStartToken.span.start, end: chainBlock.span.end },
          chained: false,
          // TODO: model this correctly
          call: chainMustache.mustache.call as hbs.PathExpression,
          params: chainMustache.mustache.params,
          hash: chainMustache.mustache.hash,
          program: chainBlock.value.block,
          inverse: chainBlock.value.inverse,
          openStrip: NO_STRIP,
          closeStrip: NO_STRIP,
          inverseStrip: NO_STRIP,
        };

        inverse = {
          type: 'Program',
          span: block.span,
          body: [block],
          blockParams: chainMustache.blockParams.value.map(p => parser.slice(p.span)),
        };
      } else {
        parser.expect(new TokenSyntax(TokenKind.Close));
        inverse = parser.expect(BLOCK_FROM_ELSE);
      }
    }

    return span => ({
      value: { block: program, inverse },
      span,
    });
  },
};

export const BLOCK_FROM_ELSE: Syntax<hbs.Program> = {
  allowEmpty: true,

  description() {
    return `{{else}} -> ( ... ) -> {{/...}}`;
  },

  test() {
    return true;
  },

  parse(parser) {
    let out: hbs.Statement[] = [];

    while (true) {
      if (parser.test(END_BLOCK) || parser.is(TokenKind.EOF)) {
        break;
      }

      if (parser.isCurlyPath('else')) {
        let token = parser.shift();
        parser.shift();
        parser.report(`Unexpected {{else}} after last {{else}}`, token.span);

        while (true) {
          if (parser.is(TokenKind.EOF) || parser.is(TokenKind.Close)) break;

          parser.shift();
        }
      }

      out.push(parser.expect(TOP));
    }

    return span => ({
      type: 'Program',
      span,
      body: out,
      blockParams: [],
    });
  },
};

export const COMMENT: StatementSyntax<hbs.CommentStatement> = {
  description() {
    return `{{!...}}`;
  },

  test(parser: HandlebarsParser): boolean {
    return parser.is(TokenKind.InlineComment) || parser.is(TokenKind.BlockComment);
  },

  parse(parser: HandlebarsParser) {
    let next = parser.shift();

    let string = parser.slice(next.span);
    let value = next.kind === TokenKind.InlineComment ? string.slice(3, -2) : string.slice(5, -4);

    return span => ({
      span,
      type: 'CommentStatement',
      value,
      strip: { open: false, close: false },
    });
  },
};

export const CURLIES: Syntax<hbs.MustacheStatement | hbs.ContentMustache> = {
  description() {
    return `{{...}}`;
  },

  test(parser: HandlebarsParser): boolean {
    return parser.is(TokenKind.Open);
  },

  parse(parser: HandlebarsParser): (span: hbs.Span) => hbs.MustacheStatement | hbs.ContentMustache {
    parser.expect(new TokenSyntax(TokenKind.Open));
    let rest = parser.expect(MUSTACHE_AFTER_CURLY);

    if (rest.kind === 'call') {
      let mustache = rest.contents.mustache;
      return span => assign(mustache, { span });
    } else {
      let mustache = rest.contents;
      return span => assign(mustache, { span });
    }
  },
};

export type MustacheCall = {
  mustache: hbs.MustacheStatement;
  blockParams: BlockParams;
};

export type MustacheCallContents = {
  kind: 'call';
  contents: MustacheCall;
};

export type MustacheContents =
  | MustacheCallContents
  | { kind: 'content'; contents: hbs.ContentMustache };

export const MUSTACHE_CALL_AFTER_CURLY: Syntax<MustacheCall> = {
  description() {
    return `... ...}}`;
  },

  test(parser: HandlebarsParser): boolean {
    return parser.test(EXPR);
  },

  parse(parser: HandlebarsParser): (span: hbs.Span) => MustacheCall {
    let result = parseMustache(parser, true);
    return span => result(span).contents;
  },
};

export const MUSTACHE_AFTER_CURLY = {
  description() {
    return `...}}`;
  },

  test(parser: HandlebarsParser): boolean {
    return parser.test(EXPR);
  },

  parse(parser: HandlebarsParser): (span: hbs.Span) => MustacheContents {
    return parseMustache(parser, false);
  },
};

function parseMustache(
  parser: HandlebarsParser,
  forceCall: true
): (span: hbs.Span) => MustacheCallContents;
function parseMustache(
  parser: HandlebarsParser,
  forceCall: false
): (span: hbs.Span) => MustacheContents;
function parseMustache(
  parser: HandlebarsParser,
  forceCall: boolean
): (span: hbs.Span) => MustacheContents {
  let expr = parser.expect(EXPR);
  let contentOnly = true;

  let params: hbs.Expression[] = [];

  let closeSyntax = new TokenSyntax(TokenKind.Close);
  let sawHash = false;
  let blockParams: BlockParams = BLOCK_PARAMS_PLACEHOLDER;

  while (true) {
    if (parser.isEOF()) {
      return DEFAULT_MUSTACHE_PLACEHOLDER();
    }

    if (parser.test(BLOCK_PARAMS)) {
      blockParams = parser.expect(BLOCK_PARAMS);
      contentOnly = false;
    }

    if (parser.test(closeSyntax)) {
      break;
    }

    if (parser.test(HASH_PAIR)) {
      sawHash = true;
      contentOnly = false;
      break;
    }

    let nextExpr = parser.expect(EXPR);
    contentOnly = false;

    params.push(nextExpr);
  }

  if (contentOnly && !forceCall) {
    assert(
      params.length === 0,
      `BUG: expected only content, saw more than one expression in {{...}}`
    );
    parser.expect(new TokenSyntax(TokenKind.Close));

    return span => ({
      kind: 'content',
      contents: {
        type: 'MustacheContent',
        span,
        value: expr,
      },
    });
  }

  let hash: Option<hbs.Hash> = null;
  if (sawHash) {
    hash = parser.expect(HASH);
  }

  parser.expect(new TokenSyntax(TokenKind.Close));

  return span => ({
    kind: 'call',
    contents: {
      mustache: {
        type: 'MustacheStatement',
        span,
        call: expr,
        params,
        hash,
        trusted: false,
        strip: { open: false, close: false },
      },
      blockParams,
    },
  });
}

function DEFAULT_MUSTACHE_PLACEHOLDER(): (span: hbs.Span) => MustacheContents {
  return span => ({
    kind: 'content',
    contents: {
      type: 'MustacheContent',
      span,
      value: UNDEFINED,
    },
  });
}

export const HASH: Syntax<hbs.Hash> = {
  description() {
    return `hash`;
  },

  test(parser) {
    return parser.test(HASH_PAIR);
  },

  parse(parser) {
    let pairs: hbs.HashPair[] = [];

    while (true) {
      pairs.push(parser.expect(HASH_PAIR));

      if (!parser.test(HASH_PAIR)) {
        break;
      }
    }

    return span => ({
      span,
      pairs,
    });
  },
};

export type BlockParams = Spanned<Array<LexItem<TokenKind.Identifier>>>;

export const BLOCK_PARAMS_PLACEHOLDER = {
  span: NO_SPAN,
  value: [],
};

export const BLOCK_PARAMS: Syntax<BlockParams> = {
  description() {
    return `as | ... |`;
  },

  test(parser) {
    return parser.isPath('as');
  },

  parse(parser) {
    parser.expect(new TokenSyntax(TokenKind.Identifier, 'as'));
    parser.expect(new TokenSyntax(TokenKind.Pipe));
    let tokens: Array<LexItem<TokenKind.Identifier>> = [];

    while (true) {
      if (parser.is(TokenKind.Pipe) || parser.is(TokenKind.EOF)) {
        break;
      }

      let token = parser.expect(new TokenSyntax(TokenKind.Identifier));
      tokens.push(token);
    }

    parser.expect(new TokenSyntax(TokenKind.Pipe));

    return span => ({ span, value: tokens });
  },
};

export const BLOCK: StatementSyntax<hbs.BlockStatement> = {
  description() {
    return `{{#...}}...{{/...}}`;
  },

  test(parser: HandlebarsParser): boolean {
    return parser.is(TokenKind.OpenBlock);
  },

  parse(parser) {
    parser.expect(new TokenSyntax(TokenKind.OpenBlock));
    let rest = parser.expect(MUSTACHE_CALL_AFTER_CURLY);

    let body = parser.expect(IN_BLOCK);
    body.value.block.blockParams = rest.blockParams.value.map(p => parser.slice(p.span));

    parser.expect(new TokenSyntax(TokenKind.OpenEndBlock));
    parser.expect(new TokenSyntax(TokenKind.Identifier));
    parser.expect(new TokenSyntax(TokenKind.Close));

    return span => ({
      type: 'BlockStatement',
      span,
      chained: false,
      call: rest.mustache.call as hbs.PathExpression,
      params: rest.mustache.params,
      hash: rest.mustache.hash,
      program: body.value.block,
      inverse: body.value.inverse,
      openStrip: { open: false, close: false },
      inverseStrip: { open: false, close: false },
      closeStrip: { open: false, close: false },
    });
  },
};

export const HASH_PAIR: Syntax<hbs.HashPair> = {
  description() {
    return `hash pair`;
  },

  test(parser) {
    let checkpoint = parser.checkpoint();

    if (!checkpoint.is(TokenKind.Identifier)) {
      return false;
    }

    checkpoint.shift();

    return checkpoint.is(TokenKind.Equals);
  },

  parse(parser) {
    let name = parser.shift();
    parser.expect(new TokenSyntax(TokenKind.Equals));
    let value = parser.expect(EXPR);

    return span => ({
      span,
      key: parser.slice(name.span),
      value,
    });
  },
};

const UNDEFINED: hbs.Expression = {
  type: 'UndefinedLiteral',
  value: undefined,
  span: { start: -1, end: -1 },
};

class TokenSyntax<T extends TokenKind> implements Syntax<LexItem<T>> {
  constructor(private token: T, private value?: string) {}

  description() {
    return this.token;
  }

  test(parser: HandlebarsParser): boolean {
    let next = parser.peek();
    let isKind = next.kind === this.token;

    if (isKind === false) return false;

    if (typeof this.value === 'string') {
      return parser.slice(next.span) === this.value;
    } else {
      return true;
    }
  }

  parse(parser: HandlebarsParser): (span: hbs.Span) => LexItem<T> {
    if (this.test(parser)) {
      let item = parser.shift();
      return () => (item as unknown) as LexItem<T>;
    } else {
      let token = parser.peek();
      parser.report(`expected ${this.token}, got ${token.kind}`, token.span);
      throw new Error('unimplemented default token');
    }
  }
}

class ParenDelimitedSyntax implements Syntax<Spanned<hbs.Expression[]>> {
  description() {
    return `(...)`;
  }

  test(parser: HandlebarsParser): boolean {
    return parser.peek().kind === TokenKind.OpenParen;
  }

  parse(parser: HandlebarsParser): (span: hbs.Span) => Spanned<hbs.Expression[]> {
    parser.expect(new TokenSyntax(TokenKind.OpenParen));

    let exprs: hbs.Expression[] = [];

    while (true) {
      if (parser.peek().kind === TokenKind.CloseParen) {
        parser.shift();
        return span => ({ span, value: exprs });
      }

      exprs.push(parser.expect(EXPR));
    }
  }

  placeholder(): Spanned<hbs.Expression[]> {
    return { span: { start: -1, end: -1 }, value: [] };
  }
}

const PATH: AstSyntax<hbs.Expression> = {
  description() {
    return `path`;
  },

  test(parser) {
    let token = parser.peek();

    return token.kind === TokenKind.Identifier || token.kind === TokenKind.AtName;
  },

  parse(parser) {
    let tail: hbs.PathSegment[] | null = null;

    let head: hbs.Head;
    if (parser.isMacro('head')) {
      head = parser.expandHeadMacro();
    } else {
      let next = parser.shift();

      if (next.kind === TokenKind.AtName) {
        head = { type: 'ArgReference', span: next.span, name: parser.slice(next.span).slice(1) };
      } else if (parser.isMacro('head')) {
      } else {
        head = { type: 'LocalReference', span: next.span, name: parser.slice(next.span) };
      }
    }

    if (parser.test(new TokenSyntax(TokenKind.Dot))) {
      tail = [];

      while (true) {
        parser.shift();
        let next = parser.expect(new TokenSyntax(TokenKind.Identifier));

        tail.push({ type: 'PathSegment', span: next.span, name: parser.slice(next.span) });

        if (!parser.test(new TokenSyntax(TokenKind.Dot))) {
          break;
        }
      }
    }

    return span => ({
      span,
      type: 'PathExpression',
      head,
      tail,
    });
  },
};

const EXPR: AstSyntax<hbs.Expression> = {
  description() {
    return `expression`;
  },

  test(parser) {
    let token = parser.peek();

    return token.kind === TokenKind.Identifier || token.kind === TokenKind.OpenParen;
  },

  parse(parser) {
    let token = parser.peek();

    switch (token.kind) {
      case TokenKind.OpenParen: {
        let exprs = parser.expect(new ParenDelimitedSyntax());
        return span => ({
          span,
          type: 'SubExpression',
          path: exprs.value[0],
          params: exprs.value.slice(1),
          hash: { pairs: [], span: { start: -1, end: -1 } },
        });
      }

      case TokenKind.Identifier:
        if (parser.isMacro('expr')) {
          return parser.expandExpressionMacro();
        }

        return parser.expect(PATH);

      case TokenKind.Number:
        return parser.expect(new LiteralSyntax('NumberLiteral'));

      case TokenKind.String:
        return parser.expect(new LiteralSyntax('StringLiteral'));

      case TokenKind.AtName:
        return parser.expect(PATH);

      default:
        throw new Error(`unimplemented in EXPR#parse ${JSON.stringify(token)}`);
    }
  },
};

class LiteralSyntax<L extends hbs.Literal> implements ExpressionSyntax<L> {
  constructor(private type: hbs.Literal['type']) {}

  description() {
    // TODO: prettier names
    return `literal ${this.type}`;
  }

  test(parser: HandlebarsParser): boolean {
    let token = parser.peek().kind;

    switch (this.type) {
      case 'NumberLiteral':
        return token === TokenKind.Number;

      case 'StringLiteral':
        return token === TokenKind.String;

      default:
        throw new Error(`unimplemented LiteralSyntax#test for ${this.type}`);
    }
  }

  parse(parser: HandlebarsParser): (span: hbs.Span) => L {
    let token = parser.shift();

    switch (this.type) {
      case 'NumberLiteral': {
        let value = parseInt(parser.slice(token.span));
        return () => this.number(value, token.span) as L;
      }

      case 'StringLiteral': {
        let value = parser.slice(token.span).slice(1, -1);
        return () => this.string(value, token.span) as L;
      }

      default:
        throw new Error(`unimplemented LiteralSyntax#test for ${this.type}`);
    }
  }

  placeholder(): L {
    switch (this.type) {
      case 'NumberLiteral':
        return this.number(0, NO_SPAN) as L;

      default:
        throw new Error(`unimplemented LiteralSyntax#placeholder for ${this.type}`);
    }
  }

  private number(value: number, span: hbs.Span): hbs.NumberLiteral {
    return {
      span,
      type: 'NumberLiteral',
      value,
    };
  }

  private string(value: string, span: hbs.Span): hbs.StringLiteral {
    return {
      span,
      type: 'StringLiteral',
      value,
    };
  }
}

const CONTENT: StatementSyntax<hbs.ContentStatement> = {
  description() {
    return `content`;
  },

  test(parser) {
    return parser.is(TokenKind.Content);
  },

  parse(parser) {
    if (CONTENT.test(parser)) {
      let item = parser.shift();
      return span => ({
        span,
        type: 'ContentStatement',
        value: parser.slice(item.span),
        strip: { open: false, close: false },
      });
    } else {
      // let span = parser.peek().span;
      parser.report('expected content', parser.peek().span);
      return span => ({
        span,
        type: 'ContentStatement',
        value: '',
        strip: { open: false, close: false },
      });
    }
  },
};

export function reportError(errors: Diagnostic[], message: string, span: hbs.Span): Diagnostic {
  let diagnostic = new Diagnostic(span, message);
  errors.push(diagnostic);
  return diagnostic;
}

export class Diagnostic {
  constructor(readonly span: hbs.Span, readonly message: string) {}
}
