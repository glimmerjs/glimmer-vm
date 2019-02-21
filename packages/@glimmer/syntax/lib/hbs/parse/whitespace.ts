import * as hbs from '../../types/handlebars-ast';
import { TokenKind } from '../lex';
import { HandlebarsParser, Syntax, UNMATCHED } from './core';

export const TRAILING_WS: Syntax<void> = {
  description: 'trailing whitespace',

  parse(parser): void | UNMATCHED {
    if (parser.is(TokenKind.Newline)) {
      parser.shift();
      return undefined;
    }

    let next = parser.peek();
    if (next.kind !== TokenKind.Content) {
      return UNMATCHED;
    }

    let slice = parser.slice(next.span);

    if (!slice.match(/^\s*$/)) return UNMATCHED;

    let after = parser.peek2();

    if (after === undefined || after.kind !== TokenKind.Newline) {
      return UNMATCHED;
    }

    parser.shift();
    parser.shift();

    return;
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

export class OptionalLeadingWhitespace<T extends { span: hbs.Span }>
  implements Syntax<{ outer: hbs.Span; inner: T }> {
  constructor(private inner: Syntax<T>) {}

  get description(): string {
    return `${this.inner.description} with leading whitespace`;
  }

  parse(parser: HandlebarsParser): { outer: hbs.Span; inner: T } | UNMATCHED {
    {
      const { value, span } = parser.spanned(() => parser.parse(this.inner));
      if (value !== UNMATCHED) {
        return { outer: span, inner: value };
      }
    }

    if (!parser.isStartLine()) return UNMATCHED;

    let next = parser.peek();

    let slice = parser.slice(next.span);

    if (!slice.match(/^\s*$/)) return UNMATCHED;

    let checkpoint = parser.checkpoint();
    checkpoint.shift();

    const value = checkpoint.parse(this.inner);

    if (value === UNMATCHED) {
      return UNMATCHED;
    } else {
      let startPos = parser.position();
      parser.commit(checkpoint);
      let endPos = parser.position();

      return { outer: { start: startPos, end: endPos }, inner: value };
    }
  }
}

export function optionalLeadingWS<T extends { span: hbs.Span }>(
  syntax: Syntax<T>
): Syntax<{ outer: hbs.Span; inner: T }> {
  return new OptionalLeadingWhitespace(syntax);
}
