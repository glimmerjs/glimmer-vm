import * as hbs from '../../types/handlebars-ast';
import { Syntax, HandlebarsParser, Thunk } from './core';
import { TokenKind } from '../lex';
import { Option } from '@glimmer/interfaces';

export class NumberLiteralSyntax implements Syntax<hbs.NumberLiteral, true> {
  readonly description = `Literal{number}`;

  test(parser: HandlebarsParser): Option<true> {
    return parser.is(TokenKind.Number) ? true : null;
  }

  parse(parser: HandlebarsParser): Thunk<hbs.NumberLiteral> {
    let token = parser.shift();
    let value = parseFloat(parser.slice(token.span));

    return span => ({
      type: 'NumberLiteral',
      span,
      value,
    });
  }
}

export const NUMBER = new NumberLiteralSyntax();

export class StringLiteralSyntax implements Syntax<hbs.StringLiteral, true> {
  readonly description = `Literal{string}`;

  test(parser: HandlebarsParser): Option<true> {
    return parser.is(TokenKind.String) ? true : null;
  }

  parse(parser: HandlebarsParser): Thunk<hbs.StringLiteral> {
    let token = parser.shift();
    let value = parser.slice(token.span).slice(1, -1);

    return span => ({
      type: 'StringLiteral',
      span,
      value,
    });
  }
}

export const STRING = new StringLiteralSyntax();
