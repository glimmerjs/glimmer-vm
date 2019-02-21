import { TokenKind } from '../lex';
import { LexItem } from '../lexing';
import { FallibleSyntax, HandlebarsParser, UNMATCHED } from './core';

class TokenSyntax implements FallibleSyntax<LexItem<TokenKind>> {
  readonly fallible = true;

  constructor(private token: TokenKind) {}

  get description() {
    return `Token{${this.token}}`;
  }

  parse(parser: HandlebarsParser): LexItem<TokenKind> | UNMATCHED {
    if (parser.is(this.token)) {
      return parser.shift();
    } else {
      return UNMATCHED;
    }
  }

  orElse(parser: HandlebarsParser): LexItem<TokenKind> {
    return { kind: this.token, span: { start: parser.position(), end: parser.position() } };
  }
}

export const TOKENS = {
  '{{': new TokenSyntax(TokenKind.Open),
  '}}': new TokenSyntax(TokenKind.Close),
  '{{{': new TokenSyntax(TokenKind.OpenTrusted),
  '}}}': new TokenSyntax(TokenKind.CloseTrusted),
  '{{/': new TokenSyntax(TokenKind.OpenEndBlock),
  '.': new TokenSyntax(TokenKind.Dot),
  '=': new TokenSyntax(TokenKind.Equals),
  ID: new TokenSyntax(TokenKind.Identifier),
};
