import { Option } from '@glimmer/interfaces';
import { TokenKind } from '../lex';
import { LexItem } from '../lexing';
import { FallibleSyntax, HandlebarsParser, Thunk, node } from './core';

class TokenSyntax implements FallibleSyntax<LexItem<TokenKind>, true> {
  readonly fallible = true;

  constructor(private token: TokenKind) {}

  get description() {
    return `Token{${this.token}}`;
  }

  test(parser: HandlebarsParser): Option<true> {
    return parser.is(this.token) ? true : null;
  }

  parse(parser: HandlebarsParser): Thunk<LexItem<TokenKind>> {
    return node(parser.shift());
  }

  orElse(): Thunk<LexItem<TokenKind>> {
    return span => ({ kind: this.token, span });
  }
}

export const TOKENS = {
  '}}': new TokenSyntax(TokenKind.Close),
  '}}}': new TokenSyntax(TokenKind.CloseTrusted),
  '{{/': new TokenSyntax(TokenKind.OpenEndBlock),
  '.': new TokenSyntax(TokenKind.Dot),
  '=': new TokenSyntax(TokenKind.Equals),
  ID: new TokenSyntax(TokenKind.Identifier),
};
