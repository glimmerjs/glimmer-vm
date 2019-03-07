import * as hbs from '../../types/handlebars-ast';
import { TokenKind } from '../lex';
import { BLOCK } from './block';
import { FallibleSyntax, HandlebarsParser, Syntax, UNMATCHED } from './core';
import { MUSTACHE, MustacheKind } from './mustache';
import { LeadingWhitespaceKind, optionalLeadingWS, TRAILING_WS } from './whitespace';

export const ROOT: FallibleSyntax<hbs.Root> = {
  description: 'root',
  fallible: true,

  parse(parser) {
    while (true) {
      if (parser.isEOF()) {
        break;
      } else {
        parser.expect(TOP);
      }
    }

    return parser.stack.finalize(parser.position());
  },

  orElse() {
    return {
      type: 'Root',
      span: { start: 0, end: 0 },
      body: [],
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

export const TOP: FallibleSyntax<hbs.Statement | void> = {
  description: 'top level',
  fallible: true,

  parse(parser): hbs.Statement | void | UNMATCHED {
    let block = parser.parse(BLOCK);
    if (block !== UNMATCHED) {
      parser.appendBlock(block.inner);
      return;
    }

    let comment = parser.parse(COMMENT);
    if (comment !== UNMATCHED) {
      parser.appendNode(comment.inner);
      return;
    }

    let mustache = parser.parse(MUSTACHE);
    if (mustache !== UNMATCHED) return;

    let newline = parser.parse(NEWLINE);
    if (newline !== UNMATCHED) return;

    let content = parser.parse(CONTENT);
    if (content !== UNMATCHED) return;

    return UNMATCHED;
  },

  orElse(parser: HandlebarsParser): hbs.Statement {
    return {
      type: 'TextNode',
      span: { start: parser.position(), end: parser.position() },
      value: '<error>',
    };
  },
};

export class ContentSyntax implements FallibleSyntax<void> {
  readonly fallible = true;
  readonly description = 'content';

  parse(parser: HandlebarsParser): void | UNMATCHED {
    if (!parser.is(TokenKind.Content)) {
      return UNMATCHED;
    }

    let { span } = parser.spanned(() => parser.shift());

    parser.stack.seek(span.start);
    parser.stack.tokenize(span.start, parser.slice(span));
  }

  orElse(parser: HandlebarsParser): hbs.TextNode {
    return {
      type: 'TextNode',
      span: { start: parser.position(), end: parser.position() },
      value: '',
    };
  }
}

export const CONTENT = new ContentSyntax();

export class NewlineSyntax implements Syntax<void> {
  readonly description = 'newline';

  parse(parser: HandlebarsParser): void | UNMATCHED {
    if (!parser.is(TokenKind.Newline)) {
      return UNMATCHED;
    }

    let { span } = parser.spanned(() => parser.shift());

    parser.stack.seek(span.start);
    parser.stack.tokenize(span.start, parser.slice(span));
  }
}

export const NEWLINE = new NewlineSyntax();

export const BARE_COMMENT: Syntax<hbs.MustacheCommentStatement> = {
  description: `{{!...}}`,

  parse(parser: HandlebarsParser): hbs.MustacheCommentStatement | UNMATCHED {
    if (parser.is(TokenKind.InlineComment)) {
      return buildComment(parser, 3, -2);
    } else if (parser.is(TokenKind.BlockComment)) {
      return buildComment(parser, 5, -4);
    } else {
      return UNMATCHED;
    }
  },
};

export const BARE_COMMENT_WITH_TRAILING_WS: Syntax<hbs.MustacheCommentStatement> = {
  description: `{{!...}} / optional trailing whitespace`,

  parse(parser: HandlebarsParser): hbs.MustacheCommentStatement | UNMATCHED {
    let result = parser.parse(BARE_COMMENT);

    if (result === UNMATCHED) {
      return UNMATCHED;
    }

    parser.parse(TRAILING_WS);

    return result;
  },
};

export const COMMENT = optionalLeadingWS(BARE_COMMENT_WITH_TRAILING_WS);

function buildComment(
  parser: HandlebarsParser,
  from: number,
  to: number
): hbs.MustacheCommentStatement {
  let token = parser.shift();
  let value = parser.slice(token.span).slice(from, to);

  return {
    type: 'CommentStatement',
    span: token.span,
    value,
  };
}
