import { Syntax, node, HandlebarsParser, Thunk } from './core';
import { TokenKind } from '../lex';
import { Option } from '@glimmer/interfaces';
import * as hbs from '../../types/handlebars-ast';

export const TRAILING_WS: Syntax<void, true> = {
  description: 'trailing whitespace',

  test(parser): Option<true> {
    if (parser.is(TokenKind.Newline)) return true;

    let next = parser.peek();
    if (next.kind !== TokenKind.Content) {
      return null;
    }

    let slice = parser.slice(next.span);

    if (!slice.match(/^\s*$/)) return null;

    let after = parser.peek2();

    if (after === undefined || after.kind !== TokenKind.Newline) {
      return null;
    }

    return true;
  },

  parse(parser) {
    if (parser.is(TokenKind.Newline)) {
      parser.shift();
    } else {
      parser.shift();
      parser.shift();
    }

    return node(undefined);
  },
};

const enum LeadingWhitespaceStart {
  NoWhitespace,
  Whitespace,
}

export type LeadingWhitespaceKind<T> =
  | {
      type: LeadingWhitespaceStart.NoWhitespace;
      start: T;
    }
  | {
      type: LeadingWhitespaceStart.Whitespace;
      start: T;
    };

export class OptionalLeadingWhitespace<T extends { span: hbs.Span }, U extends NonNullable<unknown>>
  implements Syntax<{ outer: hbs.Span; inner: T }, LeadingWhitespaceKind<U>> {
  constructor(private inner: Syntax<T, U>) {}

  get description(): string {
    return `${this.inner.description} with leading whitespace`;
  }

  test(parser: HandlebarsParser): Option<LeadingWhitespaceKind<U>> {
    let inner = this.inner.test(parser);
    if (inner !== null) {
      return { type: LeadingWhitespaceStart.NoWhitespace, start: inner };
    }

    if (!parser.isStartLine()) return null;

    let next = parser.peek();

    let slice = parser.slice(next.span);

    if (!slice.match(/^\s*$/)) return null;

    let checkpoint = parser.checkpoint();
    checkpoint.shift();

    inner = this.inner.test(checkpoint);

    if (inner === null) {
      return null;
    } else {
      return {
        type: LeadingWhitespaceStart.Whitespace,
        start: inner,
      };
    }
  }

  parse(
    parser: HandlebarsParser,
    start: LeadingWhitespaceKind<U>
  ): Thunk<{ outer: hbs.Span; inner: T }> {
    switch (start.type) {
      case LeadingWhitespaceStart.NoWhitespace: {
        let inner = parser.parse(this.inner, start.start);
        return span => ({ outer: span, inner });
      }

      case LeadingWhitespaceStart.Whitespace: {
        let startPos = parser.position();
        parser.skipToken();
        let inner = parser.parse(this.inner, start.start);
        return span => ({ outer: { start: startPos, end: span.end }, inner });
      }
    }
  }
}

export function optionalLeadingWS<T extends { span: hbs.Span }, U>(
  syntax: Syntax<T, U>
): Syntax<{ outer: hbs.Span; inner: T }, LeadingWhitespaceKind<U>> {
  return new OptionalLeadingWhitespace(syntax);
}
