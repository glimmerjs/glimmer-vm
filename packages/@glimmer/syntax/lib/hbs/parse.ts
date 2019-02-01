import * as hbs from '../types/handlebars-ast';
import { Lexer } from './lexing';
import { HandlebarsLexerDelegate } from './lex';

export function hbsParse(template: string | hbs.RootProgram): hbs.Program {
  if (typeof template === 'string') {
    let lexer = new Lexer(template, new HandlebarsLexerDelegate());
    let out = [];
    let token;

    do {
      token = lexer.next();
      out.push(token);
    } while (token);

    console.log(out);
    debugger;
  }
  throw new Error('not implemented (parse)');
}

export function hbsPrint(ast: hbs.Program): string {
  throw new Error('not implemented (print)');
}
