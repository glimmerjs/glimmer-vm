import { Dict, Option } from '@glimmer/interfaces';
import { unreachable } from '@glimmer/util';
import * as hbs from '../types/handlebars-ast';
import { TokenKind } from './lex';
import { LexItem, Spanned, Tokens, Debug } from './lexing';
import { FALSE_MACRO, Macro, NULL_MACRO, TRUE_MACRO, UNDEFINED_MACRO } from './macros';

export interface Macros {
  expr: Dict<Macro<hbs.Expression>>;
}

const MACROS_V1 = {
  expr: {
    true: TRUE_MACRO,
    false: FALSE_MACRO,
    null: NULL_MACRO,
    undefined: UNDEFINED_MACRO,
  },
};

export class HandlebarsParser {
  private errors: Diagnostic[] = [];
  private debugStack: string[] = [];

  constructor(
    private input: string,
    private tokens: Tokens,
    private debug: Debug,
    private macros: Macros = MACROS_V1
  ) {}

  RootProgram(): hbs.AnyProgram {
    let statements: hbs.Statement[] = [];

    while (true) {
      let next = this.peek();
      if (next.kind === TokenKind.EOF) {
        break;
      } else {
        statements.push(this.expect(TOP));
      }
    }

    return {
      type: 'Program',
      span: { start: 0, end: this.input.length },
      body: statements,
    };
  }

  Top(): hbs.Statement {
    return this.expect(TOP);
  }

  checkpoint() {
    this.trace('checkpoint');
    return new HandlebarsParser(this.input, this.tokens.clone(), this.debug, this.macros);
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

  slice(span: hbs.Span): string {
    return this.input.slice(span.start, span.end);
  }

  report(message: string, span: hbs.Span): Diagnostic {
    return reportError(this.errors, message, span);
  }

  shift(): LexItem<TokenKind> {
    this.trace(`Shifting ${this.slice(this.tokens.peek().span)}`);
    return this.tokens.consume();
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

  expect<T>(syntax: Syntax<T>): T {
    this.debugStack.push(syntax.description());
    this.trace(JSON.stringify(this.debugStack));
    try {
      return syntax.parse(this);
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
  description(): string;
  test(parser: HandlebarsParser): boolean;
  parse(parser: HandlebarsParser): T;
}

export type AstSyntax<T extends hbs.Node = hbs.Node> = Syntax<T>;
export type StatementSyntax<T extends hbs.Statement = hbs.Statement> = Syntax<T>;
export type ExpressionSyntax<T extends hbs.Expression = hbs.Expression> = Syntax<T>;

const NO_SPAN = { start: -1, end: -1 };
const NO_HASH: hbs.Hash = { span: NO_SPAN, pairs: [] };
const NO_STRIP: hbs.StripFlags = { open: false, close: false };

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
      return parser.expect(CONTENT);
    } else if (parser.test(CURLIES)) {
      return parser.expect(CURLIES);
    } else if (parser.test(COMMENT)) {
      return parser.expect(COMMENT);
    } else if (parser.test(BLOCK)) {
      return parser.expect(BLOCK);
    } else {
      let token = parser.peek();
      throw new Error(
        `unimplemented (Top @ ${JSON.stringify(token)} :: ${parser.slice(token.span)})`
      );
    }
  },
};

export const BLOCK_UNTIL_ELSE: Syntax<hbs.Program> = {
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
    let blockFirst = -1;
    let blockLast = -1;
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
      blockFirst = blockFirst === undefined ? next.span.start : blockFirst;
      blockLast = next.span.end;

      blockStatements.push(next);
    }

    return {
      type: 'Program',
      span: { start: blockFirst, end: blockLast },
      body: blockStatements,
      blockParams: [],
    };
  },
};

export const END_BLOCK: Syntax<Spanned<LexItem<TokenKind.Identifier>>> = {
  description() {
    return `{{/...}}`;
  },

  test(parser) {
    return parser.is(TokenKind.OpenEndBlock);
  },

  parse(parser) {
    let start = parser.expect(new TokenSyntax(TokenKind.OpenEndBlock));
    let id = parser.expect(new TokenSyntax(TokenKind.Identifier));
    let end = parser.expect(new TokenSyntax(TokenKind.Close));

    return {
      span: { start: start.span.start, end: end.span.end },
      value: id,
    };
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

  parse(parser): Spanned<{ block: hbs.Program; inverse: Option<hbs.Program> }> {
    let inverse: Option<hbs.Program> = null;

    let program = parser.expect(BLOCK_UNTIL_ELSE);

    if (parser.isCurlyPath('else')) {
      parser.shift();
      parser.shift();
      if (parser.test(MUSTACHE_AFTER_CURLY)) {
        let chainMustache = parser.expect(MUSTACHE_AFTER_CURLY);
        let chainBlock = parser.expect(IN_BLOCK);

        let block: hbs.BlockStatement = {
          type: 'BlockStatement',
          span: { start: chainMustache.span.start, end: chainBlock.span.end },
          chained: false,
          path: chainMustache.path,
          params: chainMustache.params,
          hash: chainMustache.hash,
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
          blockParams: [],
        };
      } else {
        parser.expect(new TokenSyntax(TokenKind.Close));
        inverse = parser.expect(BLOCK_FROM_ELSE);
      }
    }

    return {
      value: { block: program, inverse },
      span: { start: program.span.start, end: inverse ? inverse.span.end : program.span.end },
    };
  },
};

export const BLOCK_FROM_ELSE: Syntax<hbs.Program> = {
  description() {
    return `{{else}} -> ( ... ) -> {{/...}}`;
  },

  test() {
    return true;
  },

  parse(parser) {
    let out: hbs.Statement[] = [];
    let first = -1;
    let last = -1;

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

      let next = parser.expect(TOP);
      first = first === undefined ? next.span.start : first;
      last = next.span.end;

      out.push(next);
    }

    return {
      type: 'Program',
      span: { start: first, end: last },
      body: out,
      blockParams: [],
    };
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
    let value = next.kind === TokenKind.InlineComment ? string.slice(3, -2) : string.slice(4, -4);

    return {
      span: next.span,
      type: 'CommentStatement',
      value,
      strip: { open: false, close: false },
    };
  },
};

export const CURLIES: StatementSyntax<hbs.MustacheStatement> = {
  description() {
    return `{{...}}`;
  },

  test(parser: HandlebarsParser): boolean {
    return parser.is(TokenKind.Open);
  },

  parse(parser: HandlebarsParser): hbs.MustacheStatement {
    let open = parser.expect(new TokenSyntax(TokenKind.Open));
    let rest = parser.expect(MUSTACHE_AFTER_CURLY);

    rest.span = { start: open.span.start, end: rest.span.end };
    return rest;
  },
};

export const MUSTACHE_AFTER_CURLY: StatementSyntax<hbs.MustacheStatement> = {
  description() {
    return `...}}`;
  },

  test(parser: HandlebarsParser): boolean {
    return parser.test(EXPR);
  },

  parse(parser: HandlebarsParser): hbs.MustacheStatement {
    let expr = parser.expect(EXPR);

    let params: hbs.Expression[] = [];

    let closeSyntax = new TokenSyntax(TokenKind.Close);
    let sawHash = false;
    let hashPairs = [];
    let hashStart;
    let hashEnd;

    while (true) {
      if (parser.isEOF()) {
        return DEFAULT_MUSTACHE_PLACEHOLDER();
      }

      if (parser.test(closeSyntax)) {
        break;
      }

      if (parser.test(HASH_PAIR)) {
        sawHash = true;
        break;
      }

      let nextExpr = parser.expect(EXPR);

      params.push(nextExpr);
    }

    if (sawHash) {
      while (true) {
        let pair = parser.expect(HASH_PAIR);
        if (hashStart === undefined) hashStart = pair.span.start;
        hashEnd = pair.span.end;
        hashPairs.push(pair);

        if (!parser.test(HASH_PAIR)) {
          break;
        }
      }
    } else {
      hashStart = hashEnd = -1;
    }

    let close = parser.expect(new TokenSyntax(TokenKind.Close));

    return {
      type: 'MustacheStatement',
      span: { start: expr.span.start, end: close.span.end },
      path: expr,
      params: params,
      hash: { span: { start: hashStart, end: hashEnd }, pairs: hashPairs },
      escaped: true,
      strip: { open: false, close: false },
    };
  },
};

function DEFAULT_MUSTACHE_PLACEHOLDER(): hbs.MustacheStatement {
  return {
    type: 'MustacheStatement',
    span: NO_SPAN,
    path: UNDEFINED,
    params: [],
    hash: NO_HASH,
    escaped: true,
    strip: { open: false, close: false },
  };
}

export const BLOCK: StatementSyntax<hbs.BlockStatement> = {
  description() {
    return `{{#...}}...{{/...}}`;
  },

  test(parser: HandlebarsParser): boolean {
    return parser.is(TokenKind.OpenBlock);
  },

  parse(parser: HandlebarsParser): hbs.BlockStatement {
    let open = parser.expect(new TokenSyntax(TokenKind.OpenBlock));
    let rest = parser.expect(MUSTACHE_AFTER_CURLY);

    let body = parser.expect(IN_BLOCK);

    parser.expect(new TokenSyntax(TokenKind.OpenEndBlock));
    parser.expect(new TokenSyntax(TokenKind.Identifier));
    let end = parser.expect(new TokenSyntax(TokenKind.Close));

    return {
      type: 'BlockStatement',
      span: { start: open.span.start, end: end.span.end },
      chained: false,
      path: rest.path,
      params: rest.params,
      hash: rest.hash,
      program: body.value.block,
      inverse: body.value.inverse,
      openStrip: { open: false, close: false },
      inverseStrip: { open: false, close: false },
      closeStrip: { open: false, close: false },
    };
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

    return {
      span: { start: name.span.start, end: value.span.end },
      key: parser.slice(name.span),
      value,
    };
  },
};

const UNDEFINED: hbs.Expression = {
  type: 'UndefinedLiteral',
  value: undefined,
  span: { start: -1, end: -1 },
};

class TokenSyntax<T extends TokenKind> implements Syntax<LexItem<T>> {
  constructor(private token: T) {}

  description() {
    return this.token;
  }

  test(parser: HandlebarsParser): boolean {
    return parser.peek().kind === this.token;
  }

  parse(parser: HandlebarsParser): LexItem<T> {
    if (this.test(parser)) {
      return (parser.shift() as unknown) as LexItem<T>;
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

  parse(parser: HandlebarsParser): Spanned<hbs.Expression[]> {
    let open = parser.expect(new TokenSyntax(TokenKind.OpenParen));

    let exprs: hbs.Expression[] = [];

    while (true) {
      if (parser.peek().kind === TokenKind.CloseParen) {
        let close = parser.shift();
        return { span: { start: open.span.start, end: close.span.end }, value: exprs };
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
    let parts = [];

    let next = parser.shift();
    let data: boolean;
    let head: string;

    if (next.kind === TokenKind.AtName) {
      data = true;
      head = parser.slice(next.span).slice(1);
    } else {
      data = false;
      head = parser.slice(next.span);
    }

    let start: number = next.span.start;
    let end: number = next.span.end;

    while (parser.test(new TokenSyntax(TokenKind.Dot))) {
      parser.shift();
      let next = parser.expect(new TokenSyntax(TokenKind.Identifier));

      parts.push(parser.slice(next.span));

      end = next.span.end;
    }

    return {
      span: { start, end },
      type: 'PathExpression',
      data,
      depth: 0,
      parts: [head, ...parts],
      original: 'todo',
    };
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

  parse(parser): hbs.Expression {
    let token = parser.peek();

    switch (token.kind) {
      case TokenKind.OpenParen: {
        let exprs = parser.expect(new ParenDelimitedSyntax());
        return {
          span: exprs.span,
          type: 'SubExpression',
          path: exprs.value[0],
          params: exprs.value.slice(1),
          hash: { pairs: [], span: { start: -1, end: -1 } },
        };
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

  parse(parser: HandlebarsParser): L {
    let token = parser.shift();

    switch (this.type) {
      case 'NumberLiteral': {
        let value = parseInt(parser.slice(token.span));
        return this.number(value, token.span) as L;
      }

      case 'StringLiteral': {
        let value = parser.slice(token.span).slice(1, -1);
        return this.string(value, token.span) as L;
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
      original: value,
    };
  }

  private string(value: string, span: hbs.Span): hbs.StringLiteral {
    return {
      span,
      type: 'StringLiteral',
      value,
      original: value,
    };
  }
}

const CONTENT: StatementSyntax<hbs.ContentStatement> = {
  description() {
    return `content`;
  },

  test(parser: HandlebarsParser) {
    return parser.is(TokenKind.Content);
  },

  parse(parser: HandlebarsParser): hbs.ContentStatement {
    if (this.test(parser)) {
      let item = parser.shift();
      return {
        span: item.span,
        type: 'ContentStatement',
        value: parser.slice(item.span),
        original: { open: false, close: false },
      };
    } else {
      let span = parser.peek().span;
      parser.report('expected content', parser.peek().span);
      return {
        span,
        type: 'ContentStatement',
        value: '',
        original: { open: false, close: false },
      };
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
