import * as hbs from '../../types/handlebars-ast';
import { Syntax, HandlebarsParser, Thunk, FallibleSyntax } from './core';
import { Option } from '@glimmer/interfaces';
import { TokenKind } from '../lex';
import { NUMBER, STRING } from './literals';
import { TOKENS } from './tokens';
import { PATH, PathKind } from './path';
import { PARAMS } from './expressions';

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
          return span => buildMustache(result.call, result.params, result.hash, false, span);
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
          return span => buildMustache(result.call, result.params, result.hash, true, span);
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

type CallBodyStart =
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

class CallBody implements Syntax<hbs.CallBody, CallBodyStart> {
  constructor(private close: FallibleSyntax<unknown, unknown>) {}

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

        return () => ({
          call: number,
          params: null,
          hash: null,
        });
      }

      case CallBodyStartKind.StringLiteral: {
        let string = parser.parse(STRING, true);
        parser.expect(this.close);

        return () => ({
          call: string,
          params: null,
          hash: null,
        });
      }

      case CallBodyStartKind.Path: {
        let path = parser.parse(PATH, start.kind);

        let close = parser.test(this.close);

        if (close !== null) {
          parser.parse(this.close, close);

          return () => ({
            call: path,
            params: null,
            hash: null,
          });
        }

        let paramsTest = parser.test(PARAMS);

        if (paramsTest !== null) {
          let params = parser.parse(PARAMS, paramsTest);
          parser.expect(this.close);

          return () => ({
            call: path,
            params,
            hash: null,
          });
        }

        throw new Error('unimplemented, mustache hash arguments');
        // Not implemented {{head ... ...hash}}
      }

      case CallBodyStartKind.ExprMacro: {
        let expr = parser.expandExpressionMacro();
        parser.expect(this.close);

        return () => ({
          call: expr,
          params: null,
          hash: null,
        });
      }

      case CallBodyStartKind.Sexp: {
        throw new Error('not implemented: sexp in {{...}}');
      }
    }
  }
}

function buildMustache(
  call: hbs.Expression,
  params: hbs.Expression[] | null,
  hash: hbs.Hash | null,
  trusted: boolean,
  span: hbs.Span
): hbs.MustacheContent | hbs.MustacheStatement {
  if (params === null && hash === null) {
    return {
      type: 'MustacheContent',
      span,
      value: call,
      trusted,
    };
  } else {
    return {
      type: 'MustacheStatement',
      span,
      call,
      params,
      hash,
      trusted,
    };
  }
}
