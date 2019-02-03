import * as hbs from '../types/handlebars-ast';
import { TokenKind } from './lex';
import { LexItem, Tokens, Spanned } from './lexing';
import { consume } from '../../../reference';
import { Token } from 'acorn';
import { unreachable } from '../../../util';
import { TokensImpl } from './parse';

export class HandlebarsParser {
  private errors: Diagnostic[] = [];

  constructor(private input: string, private tokens: Tokens) {}

  RootProgram(): hbs.RootProgram {
    let statements: hbs.Statement[] = [];

    statements.push(this.Top());

    return {
      type: 'Program',
      span: { start: 0, end: this.input.length },
      body: statements,
    };
  }

  Top(): hbs.Statement {
    if (this.test(CONTENT)) {
      return this.expect(CONTENT);
    } else {
      throw new Error(`unimplemented (Top @ ${JSON.stringify(this.peek().span)})`);
    }
  }

  is(token: TokenKind): boolean {
    return this.tokens.peek().kind === token;
  }

  slice(span: hbs.Span): string {
    return this.input.slice(span.start, span.end);
  }

  report(message: string, span: hbs.Span): Diagnostic {
    return reportError(this.errors, message, span);
  }

  shift(): LexItem<TokenKind> {
    return this.tokens.consume();
  }

  peek(): LexItem<TokenKind> {
    return this.tokens.peek();
  }

  test(syntax: Syntax<unknown>): boolean {
    return syntax.test(this);
  }

  expect<T>(syntax: Syntax<T>): T {
    return syntax.parse(this);
  }

  parse<T>(syntax: Syntax<T>): T {
    if (syntax.test(this)) {
      return syntax.parse(this);
    } else {
      this.report(`Expected ${syntax.description()}`, this.peek().span);
      return syntax.placeholder();
    }
  }
}

export interface Syntax<T> {
  description(): string;
  test(parser: HandlebarsParser): boolean;
  parse(parser: HandlebarsParser): T;
  placeholder(): T;
}

export type AstSyntax<T extends hbs.Node = hbs.Node> = Syntax<T>;
export type StatementSyntax<T extends hbs.Statement = hbs.Statement> = Syntax<T>;

export class Curlies implements Syntax<hbs.Expression[]> {
  description() {
    return `{{...}}`;
  }

  test(parser: HandlebarsParser): boolean {
    return parser.is(TokenKind.Open);
  }

  parse(parser: HandlebarsParser): hbs.Expression[] {
    parser.expect(new TokenSyntax(TokenKind.Open));
    let result = parser.expect(EXPR);
    parser.expect(new TokenSyntax(TokenKind.Close));
    return [result];
  }

  placeholder(): hbs.Expression[] {
    return [];
  }
}

class TokenSyntax implements Syntax<LexItem<TokenKind>> {
  constructor(private token: TokenKind) {}

  description() {
    return this.token;
  }

  test(parser: HandlebarsParser): boolean {
    return parser.peek().kind === this.token;
  }

  parse(parser: HandlebarsParser): LexItem<TokenKind> {
    return parser.shift();
  }

  placeholder(): never {
    throw unreachable();
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

const PATH: AstSyntax<hbs.PathExpression> = {
  description() {
    return `path`;
  },

  test(parser) {
    let token = parser.peek();

    return token.kind === TokenKind.Identifier;
  },

  parse(parser) {
    let parts = [];

    let next = parser.peek();

    let start: number = next.span.start;
    let end: number = next.span.end;

    while (true) {
      if (parser.test(new TokenSyntax(TokenKind.Identifier))) {
        let token = parser.shift();
        end = token.span.end;

        parts.push(parser.slice(token.span));

        if (parser.test(new TokenSyntax(TokenKind.Dot))) {
          continue;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return {
      span: { start, end },
      type: 'PathExpression',
      data: false,
      depth: 0,
      parts,
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
    let token = parser.shift();

    if (token.kind === TokenKind.OpenParen) {
      let exprs = parser.expect(new ParenDelimitedSyntax());
      return {
        type: 'SubExpression',
        path: exprs[0],
        params: exprs.slice(1),
        hash: [],
      };
    } else if (token.kind === TokenKind.Identifier) {
      return parser.expect(PATH);
    } else {
      throw unreachable();
    }
  },

  placeholder(): hbs.Expression {
    return {
      type: 'UndefinedLiteral',
      span: { start: -1, end: -1 },
    };
  },
};

const CONTENT: AstSyntax<hbs.ContentStatement> = {
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

  placeholder() {
    return {
      span: { start: -1, end: -1 },
      type: 'ContentStatement',
      value: '',
      original: { open: false, close: false },
    };
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
