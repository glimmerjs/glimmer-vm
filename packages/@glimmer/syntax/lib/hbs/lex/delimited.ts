import { Delimiter, Syntax, Token, ResultImpl } from '../syntax';

type HandlebarsLexer = any;

export class Delimited<D extends Delimiter, T extends Syntax> implements Syntax<Token<T>> {
  constructor(private delimiters: D, private content: T) {}

  test(lexer: HandlebarsLexer): boolean {
    return lexer.test(this.delimiters.openSyntax());
  }

  expect(lexer: HandlebarsLexer): ResultImpl<Token<T>> {
    let { delimiters, content } = this;

    let open = lexer.expect(delimiters.openSyntax()) as ResultImpl<Token<T>>;
    if (open.status === 'err') return open;

    let token = lexer.expect(content);
    if (token.status === 'err') return token;

    let close = lexer.expect(delimiters.closeSyntax()) as ResultImpl<Token<T>>;
    if (close.status === 'err') return close;

    return token;
  }
}
