import * as hbs from '../../types/handlebars-ast';
import { Syntax, HandlebarsParser, Thunk } from './core';
import { TokenKind } from '../lex';
import { Option } from '@glimmer/interfaces';

export class NumberLiteralSyntax implements Syntax<hbs.NumberLiteral, true> {
  get description() {
    return `Literal{number}`;
  }

  test(parser: HandlebarsParser): Option<true> {
    let next = parser.peek();

    return next.kind === TokenKind.Number ? true : null;
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
  get description() {
    return `Literal{string}`;
  }

  test(parser: HandlebarsParser): Option<true> {
    let next = parser.peek();

    return next.kind === TokenKind.String ? true : null;
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
