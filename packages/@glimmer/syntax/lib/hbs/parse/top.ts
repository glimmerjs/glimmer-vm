import { FallibleSyntax, Syntax, node, Thunk, HandlebarsParser } from './core';
import * as hbs from '../../types/handlebars-ast';
import { TokenKind } from '../lex';
import { TRAILING_WS, optionalLeadingWS } from './whitespace';
import { Option } from '@glimmer/interfaces';
import { MUSTACHE, MustacheKind } from './mustache';

export const ROOT: Syntax<hbs.AnyProgram, true> = {
  description: 'root',

  test() {
    return true;
  },

  parse(parser) {
    let statements: hbs.Statement[] = [];

    while (true) {
      if (parser.isEOF()) {
        break;
      } else {
        let next = parser.expect(TOP);

        if (next !== undefined) {
          statements.push(next);
        }
      }
    }

    return () => ({
      type: 'Program',
      span: { start: 0, end: parser.position() },
      body: statements,
    });
  },
};

export const enum TopSyntaxKind {
  Newline,
  Content,
  Comment,
  Mustache,
}

export type TopSyntax =
  | { kind: TopSyntaxKind.Newline }
  | { kind: TopSyntaxKind.Content }
  | { kind: TopSyntaxKind.Comment }
  | { kind: TopSyntaxKind.Mustache; state: MustacheKind };

export const TOP: FallibleSyntax<hbs.Statement, TopSyntax> = {
  description: 'top level',
  fallible: true,

  test(parser) {
    if (parser.test(COMMENT)) {
      return { kind: TopSyntaxKind.Comment };
    }

    let state = parser.test(MUSTACHE);

    if (state !== null) {
      return { kind: TopSyntaxKind.Mustache, state };
    }

    if (parser.test(NEWLINE) !== null) {
      return { kind: TopSyntaxKind.Newline };
    }

    if (parser.test(CONTENT) !== null) {
      return { kind: TopSyntaxKind.Content };
    }

    return null;
  },

  parse(parser, top) {
    switch (top.kind) {
      case TopSyntaxKind.Comment:
        return node(parser.parse(COMMENT, true));

      case TopSyntaxKind.Content:
        return node(parser.parse(CONTENT, true));

      case TopSyntaxKind.Newline:
        return node(parser.parse(NEWLINE, true));

      case TopSyntaxKind.Mustache:
        return node(parser.parse(MUSTACHE, top.state));
    }
  },

  orElse(): Thunk<hbs.Statement> {
    return span => ({ type: 'ContentStatement', span, value: '<error>' });
  },
};

export class ContentSyntax implements FallibleSyntax<hbs.ContentStatement, true> {
  readonly fallible = true;
  readonly description = 'content';

  test(parser: HandlebarsParser): Option<true> {
    return parser.is(TokenKind.Content) || null;
  }

  parse(parser: HandlebarsParser): Thunk<hbs.ContentStatement> {
    parser.shift();

    return span => ({
      type: 'ContentStatement',
      span,
      value: parser.slice(span),
    });
  }

  orElse(): Thunk<hbs.ContentStatement> {
    return span => ({
      type: 'ContentStatement',
      span,
      value: '',
    });
  }
}

export const CONTENT = new ContentSyntax();

export class NewlineSyntax implements Syntax<hbs.Newline, true> {
  readonly description = 'content';

  test(parser: HandlebarsParser): Option<true> {
    return parser.is(TokenKind.Newline) || null;
  }

  parse(parser: HandlebarsParser): Thunk<hbs.Newline> {
    parser.shift();

    return span => ({
      type: 'Newline',
      span,
    });
  }
}

export const NEWLINE = new NewlineSyntax();

export const BARE_COMMENT: Syntax<hbs.CommentStatement, true> = {
  description: `{{!...}}`,

  test(parser: HandlebarsParser): Option<true> {
    return parser.is(TokenKind.InlineComment) || parser.is(TokenKind.BlockComment) || null;
  },

  parse(parser: HandlebarsParser) {
    let next = parser.shift();

    let string = parser.slice(next.span);
    let value = next.kind === TokenKind.InlineComment ? string.slice(3, -2) : string.slice(5, -4);

    let trailingNext = parser.test(TRAILING_WS);
    if (trailingNext !== null) {
      parser.skip(TRAILING_WS, trailingNext);
    }

    return span => ({
      span,
      type: 'CommentStatement',
      value,
    });
  },
};

export const COMMENT = optionalLeadingWS(BARE_COMMENT);
