import * as hbs from '../../types/handlebars-ast';
import { TokenKind } from '../lex';
import { BLOCK } from './block';
import { FallibleSyntax, HandlebarsParser, InfallibleSyntax, Syntax, UNMATCHED } from './core';
import { MUSTACHE, MustacheKind } from './mustache';
import { LeadingWhitespaceKind, optionalLeadingWS, TRAILING_WS } from './whitespace';

export const ROOT: InfallibleSyntax<hbs.AnyProgram> = {
  description: 'root',

  parse(parser) {
    let statements: hbs.Statement[] = [];

    while (true) {
      if (parser.isEOF()) {
        break;
      } else {
        statements.push(parser.expect(TOP));
      }
    }

    return {
      type: 'Program',
      span: { start: 0, end: parser.position() },
      body: statements,
    };
  },
};

export const enum TopSyntaxKind {
  Newline,
  Content,
  Comment,
  Mustache,
  Block,
}

export type TopSyntaxStart =
  | { kind: TopSyntaxKind.Newline }
  | { kind: TopSyntaxKind.Content }
  | { kind: TopSyntaxKind.Comment; state: LeadingWhitespaceKind<true> }
  | { kind: TopSyntaxKind.Mustache; state: MustacheKind }
  | { kind: TopSyntaxKind.Block; state: LeadingWhitespaceKind<true> };

export const TOP: FallibleSyntax<hbs.Statement> = {
  description: 'top level',
  fallible: true,

  parse(parser): hbs.Statement | UNMATCHED {
    let block = parser.parse(BLOCK);
    if (block !== UNMATCHED) return block.inner;

    let comment = parser.parse(COMMENT);
    if (comment !== UNMATCHED) return comment.inner;

    let mustache = parser.parse(MUSTACHE);
    if (mustache !== UNMATCHED) return mustache;

    let newline = parser.parse(NEWLINE);
    if (newline !== UNMATCHED) return newline;

    let content = parser.parse(CONTENT);
    if (content !== UNMATCHED) return content;

    return UNMATCHED;
  },

  orElse(parser: HandlebarsParser): hbs.Statement {
    return {
      type: 'ContentStatement',
      span: { start: parser.position(), end: parser.position() },
      value: '<error>',
    };
  },
};

export class ContentSyntax implements FallibleSyntax<hbs.ContentStatement> {
  readonly fallible = true;
  readonly description = 'content';

  parse(parser: HandlebarsParser): hbs.ContentStatement | UNMATCHED {
    if (!parser.is(TokenKind.Content)) {
      return UNMATCHED;
    }

    let { span } = parser.spanned(() => parser.shift());

    return {
      type: 'ContentStatement',
      span,
      value: parser.slice(span),
    };
  }

  orElse(parser: HandlebarsParser): hbs.ContentStatement {
    return {
      type: 'ContentStatement',
      span: { start: parser.position(), end: parser.position() },
      value: '',
    };
  }
}

export const CONTENT = new ContentSyntax();

export class NewlineSyntax implements Syntax<hbs.Newline> {
  readonly description = 'content';

  parse(parser: HandlebarsParser): hbs.Newline | UNMATCHED {
    if (!parser.is(TokenKind.Newline)) {
      return UNMATCHED;
    } else {
      let item = parser.shift();

      return {
        type: 'Newline',
        span: item.span,
      };
    }
  }
}

export const NEWLINE = new NewlineSyntax();

export const BARE_COMMENT: Syntax<hbs.CommentStatement> = {
  description: `{{!...}}`,

  parse(parser: HandlebarsParser): hbs.CommentStatement | UNMATCHED {
    let result: { value: string; span: hbs.Span };

    if (parser.is(TokenKind.InlineComment)) {
      result = parser.spanned(() => {
        let next = parser.shift();
        let string = parser.slice(next.span);
        return string.slice(3, -2);
      });
    } else if (parser.is(TokenKind.BlockComment)) {
      result = parser.spanned(() => {
        let next = parser.shift();
        let string = parser.slice(next.span);
        return string.slice(5, -4);
      });
    } else {
      return UNMATCHED;
    }

    parser.parse(TRAILING_WS);

    return {
      span: result.span,
      type: 'CommentStatement',
      value: result.value,
    };
  },
};

export const COMMENT = optionalLeadingWS(BARE_COMMENT);
