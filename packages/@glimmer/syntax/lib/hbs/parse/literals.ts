import * as hbs from '../../types/handlebars-ast';
import { Syntax, HandlebarsParser, UNMATCHED } from './core';
import { TokenKind } from '../lex';
import { Option } from '@glimmer/interfaces';

export class NumberLiteralSyntax implements Syntax<hbs.NumberLiteral> {
  readonly description = `Literal{number}`;

  parse(parser: HandlebarsParser): hbs.NumberLiteral | UNMATCHED {
    if (!parser.is(TokenKind.Number)) {
      return UNMATCHED;
    }

    let token = parser.shift();
    let value = parseFloat(parser.slice(token.span));

    return {
      type: 'NumberLiteral',
      span: token.span,
      value,
    };
  }
}

export const NUMBER = new NumberLiteralSyntax();

export class StringLiteralSyntax implements Syntax<hbs.StringLiteral> {
  readonly description = `Literal{string}`;

  test(parser: HandlebarsParser): Option<true> {
    return parser.is(TokenKind.String) ? true : null;
  }

  parse(parser: HandlebarsParser): hbs.StringLiteral | UNMATCHED {
    if (!parser.is(TokenKind.String)) {
      return UNMATCHED;
    }

    let token = parser.shift();
    let value = parser.slice(token.span).slice(1, -1);

    return {
      type: 'StringLiteral',
      span: token.span,
      value,
    };
  }
}

export const STRING = new StringLiteralSyntax();
