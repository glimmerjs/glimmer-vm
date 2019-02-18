import * as hbs from '../types/handlebars-ast';
import { TokenKind } from './lex';
import { HandlebarsParser, Syntax } from './parse/core';
import { Option } from '@glimmer/interfaces';

class LiteralSyntax<L extends hbs.StringLiteral | hbs.NumberLiteral> implements Syntax<L, true> {
  constructor(private type: 'StringLiteral' | 'NumberLiteral') {}

  get description() {
    switch (this.type) {
      case 'StringLiteral':
        return 'string';
      case 'NumberLiteral':
        return 'number';
    }
  }

  test(parser: HandlebarsParser): Option<true> {
    let token = parser.peek().kind;

    switch (this.type) {
      case 'NumberLiteral':
        return token === TokenKind.Number ? true : null;

      case 'StringLiteral':
        return token === TokenKind.String ? true : null;
    }
  }

  parse(parser: HandlebarsParser): (span: hbs.Span) => L {
    let token = parser.shift();

    switch (this.type) {
      case 'NumberLiteral': {
        let value = parseFloat(parser.slice(token.span));
        return () => this.number(value, token.span) as L;
      }

      case 'StringLiteral': {
        let value = parser.slice(token.span).slice(1, -1);
        return () => this.string(value, token.span) as L;
      }
    }
  }

  private number(value: number, span: hbs.Span): hbs.NumberLiteral {
    return {
      span,
      type: 'NumberLiteral',
      value,
    };
  }

  private string(value: string, span: hbs.Span): hbs.StringLiteral {
    return {
      span,
      type: 'StringLiteral',
      value,
    };
  }
}
