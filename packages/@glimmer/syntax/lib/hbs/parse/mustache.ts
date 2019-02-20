import * as hbs from '../../types/handlebars-ast';
import { Syntax, HandlebarsParser, Thunk, FallibleSyntax, node } from './core';
import { Option } from '@glimmer/interfaces';
import { TokenKind } from '../lex';
import { NUMBER, STRING } from './literals';
import { TOKENS } from './tokens';
import { PATH, PathKind } from './path';
import { PARAMS, HASH } from './expressions';

export const enum MustacheKind {
  Double,
  Triple,
}

export class MustacheSyntax
  implements Syntax<hbs.MustacheStatement | hbs.MustacheContent, MustacheKind> {
  readonly description = `{{...}}`;

  test(parser: HandlebarsParser): Option<MustacheKind> {
    let next = parser.peek();

    switch (next.kind) {
      case TokenKind.Open:
        return MustacheKind.Double;
      case TokenKind.OpenTrusted:
        return MustacheKind.Triple;
      default:
        return null;
    }
  }

  parse(
    parser: HandlebarsParser,
    kind: MustacheKind
  ): Thunk<hbs.MustacheStatement | hbs.MustacheContent> {
    switch (kind) {
      case MustacheKind.Double: {
        parser.shift();

        let body = new CallBody(TOKENS['}}']);
        let next = body.test(parser);

        if (next !== null) {
          let result = parser.parse(body, next);
          return span => buildMustache(result, false, span);
        } else {
          throw new Error('unimplemented, parse error recovery after {{');
        }
      }

      case MustacheKind.Triple: {
        parser.shift();

        let body = new CallBody(TOKENS['}}}']);
        let next = body.test(parser);

        if (next !== null) {
          let result = parser.parse(body, next);
          return span => buildMustache(result, true, span);
        } else {
          throw new Error('unimplemented, parse error recovery after {{');
        }
      }
    }
  }
}

export const MUSTACHE = new MustacheSyntax();

const enum CallBodyStartKind {
  Sexp,
  Path,
  ExprMacro,
  StringLiteral,
  NumberLiteral,
}

export type CallBodyStart =
  | {
      type: CallBodyStartKind.Sexp;
    }
  | {
      type: CallBodyStartKind.Path;
      kind: PathKind;
    }
  | { type: CallBodyStartKind.ExprMacro }
  | {
      type: CallBodyStartKind.StringLiteral;
    }
  | {
      type: CallBodyStartKind.NumberLiteral;
    };

export class CallBody implements FallibleSyntax<hbs.CallBody, CallBodyStart> {
  readonly fallible = true;

  constructor(private close: FallibleSyntax<{ span: hbs.Span }, unknown>) {}

  get description() {
    return `call body (closed by ${this.close}})`;
  }

  test(parser: HandlebarsParser): Option<CallBodyStart> {
    let next = parser.peek();

    switch (next.kind) {
      case TokenKind.OpenParen:
        return { type: CallBodyStartKind.Sexp };

      case TokenKind.Number:
        return { type: CallBodyStartKind.NumberLiteral };

      case TokenKind.String:
        return { type: CallBodyStartKind.StringLiteral };

      case TokenKind.Identifier: {
        if (parser.isMacro('expr')) {
          return { type: CallBodyStartKind.ExprMacro };
        }

        let pathKind = parser.test(PATH);
        if (pathKind !== null) {
          return { type: CallBodyStartKind.Path, kind: pathKind };
        }

        return null;
      }

      case TokenKind.AtName: {
        return { type: CallBodyStartKind.Path, kind: PathKind.ArgReference };
      }

      default:
        return null;
    }
  }

  parse(parser: HandlebarsParser, start: CallBodyStart): Thunk<hbs.CallBody> {
    switch (start.type) {
      case CallBodyStartKind.NumberLiteral: {
        let number = parser.parse(NUMBER, true);
        parser.expect(this.close);

        return span => buildCallBody({ start: span.start, end: number.span.end }, number);
      }

      case CallBodyStartKind.StringLiteral: {
        let string = parser.parse(STRING, true);
        parser.expect(this.close);

        return span => buildCallBody({ start: span.start, end: string.span.end }, string);
      }

      case CallBodyStartKind.Path: {
        let path = parser.parse(PATH, start.kind);

        if (parser.maybe(this.close) !== null) {
          return node(buildCallBody(path.span, path));
        }

        let params = parser.maybe(PARAMS);
        let hash = parser.maybe(HASH);
        let end = parser.position();

        parser.expect(this.close);

        return span => buildCallBody({ start: span.start, end }, path, params, hash);
      }

      case CallBodyStartKind.ExprMacro: {
        let expr = parser.expandExpressionMacro();
        parser.expect(this.close);

        return span => buildCallBody(span, expr);
      }

      case CallBodyStartKind.Sexp: {
        throw new Error('not implemented: sexp in {{...}}');
      }
    }
  }

  orElse(): Thunk<hbs.CallBody> {
    return span =>
      buildCallBody(span, {
        type: 'UndefinedLiteral',
        span,
        value: undefined,
      });
  }
}

function buildCallBody(
  span: hbs.Span,
  call: hbs.Expression,
  params: Option<hbs.Expression[]> = null,
  hash: Option<hbs.Hash> = null
): hbs.CallBody {
  return {
    type: 'CallBody',
    span,
    call,
    params: params || null,
    hash: hash || null,
  };
}

function buildMustache(
  mustache: hbs.CallBody,
  trusted: boolean,
  span: hbs.Span
): hbs.MustacheContent | hbs.MustacheStatement {
  if (mustache.params === null && mustache.hash === null) {
    return {
      type: 'MustacheContent',
      span,
      value: mustache.call,
      trusted,
    };
  } else {
    return {
      type: 'MustacheStatement',
      span,
      body: mustache,
      trusted,
    };
  }
}
