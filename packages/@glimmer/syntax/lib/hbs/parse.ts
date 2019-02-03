import * as hbs from '../types/handlebars-ast';
import { Lexer, LexItem, Result, Tokens } from './lexing';
import { HandlebarsLexerDelegate, TokenKind } from './lex';
import { HandlebarsParser, Diagnostic } from './parser';
import { Printer } from './printer';

export function hbsLex(template: string, errors: Diagnostic[]): Result<LexItem<TokenKind>[]> {
  let lexer = new Lexer(template, new HandlebarsLexerDelegate(), errors);
  let out: Array<LexItem<TokenKind>> = [];

  while (true) {
    let result = lexer.next();

    if (result.status === 'err') return result;

    let item = result.value;
    out.push(item);

    if (isEOF(item)) break;
  }

  return { status: 'ok', value: out };
}

export class TokensImpl implements Tokens {
  private pos = 0;

  constructor(private tokens: Array<LexItem<TokenKind>>) {}

  peek(): LexItem<TokenKind> {
    return this.tokens[this.pos];
  }

  consume(): LexItem<TokenKind> {
    return this.tokens[this.pos++];
  }
}

function isEOF(item: LexItem<TokenKind>): item is { token: TokenKind.EOF; span: hbs.Span } {
  return item.kind !== TokenKind.EOF;
}

export function hbsParse(
  template: string | hbs.RootProgram
): { result: hbs.RootProgram; errors: Diagnostic[] } {
  if (typeof template === 'string') {
    let errors: Diagnostic[] = [];

    let tokens = hbsLex(template, errors);

    if (tokens.status === 'err') return { result: lexErrorProgram(tokens.value.span), errors };

    let parser = new HandlebarsParser(template, new TokensImpl(tokens.value));

    return { result: parser.RootProgram(), errors };
  } else {
    return { result: template, errors: [] };
  }
}

function lexErrorProgram(span: hbs.Span): hbs.RootProgram {
  return { span, type: 'Program', body: [] };
}

export function hbsPrint(ast: hbs.RootProgram): string {
  return new Printer().print(ast);
}
