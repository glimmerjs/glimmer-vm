import { Syntax, node, HandlebarsParser, Thunk } from './core';
import { TokenKind } from '../lex';
import { Option } from '@glimmer/interfaces';

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

export class OptionalLeadingWhitespace<T, U extends NonNullable<unknown>> implements Syntax<T, U> {
  constructor(private inner: Syntax<T, U>) {}

  get description(): string {
    return `${this.inner.description} with leading whitespace`;
  }

  test(parser: HandlebarsParser): Option<U> {
    let inner = this.inner.test(parser);
    if (inner !== null) {
      return inner;
    }

    if (!parser.isStartLine()) return null;

    let next = parser.peek();

    let slice = parser.slice(next.span);

    if (!slice.match(/^\s*$/)) return null;

    let checkpoint = parser.checkpoint();
    checkpoint.shift();

    return this.inner.test(checkpoint);
  }

  parse(parser: HandlebarsParser): Thunk<T> {
    let inner = this.inner.test(parser);

    if (inner !== null) {
      return this.inner.parse(parser, inner);
    } else {
      parser.skipToken();
      let inner = this.inner.test(parser);
      return this.inner.parse(parser, inner!);
    }
  }
}

export function optionalLeadingWS<T, U>(syntax: Syntax<T, U>): Syntax<T, U> {
  return new OptionalLeadingWhitespace(syntax);
}
