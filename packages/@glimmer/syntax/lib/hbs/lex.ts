import { Option } from '@glimmer/interfaces';
import { Syntax } from './syntax';
import {
  Consume,
  Continue,
  Emit,
  EOF,
  Reconsume,
  Remain,
  LexerDelegate,
  LexerNext,
  Transition,
  Begin,
} from './lexing';

const LEFT_STRIP = '~';
const RIGHT_STRIP = '~';

const LOOKAHEAD = /^[=~;}\s;\/.)|]/;
const LITERAL_LOOKAHEAD = /^[~;}\s;)]/;

function testId(s: string): Option<string> {
  let match = s.match(/^[^\s!"#%-,\.\/;->@\[-\^`\{-~]+/);

  if (match) {
    let rest = s.slice(match[0].length);

    if (LOOKAHEAD.test(rest)) {
      return match[0];
    } else {
      return null;
    }
  } else {
    return null;
  }
}

const enum State {
  Top,
  Content,
  Comment,
  Mustache,
  EscapeChar,
  Raw,
}

const enum TokenKind {
  Content,
  OpenRawBlock,
  EndRawBlock,
  CloseRawBlock,
  Comment,
  OpenSexpr,
  CloseSexp,
  OpenPartial,
  OpenPartialBlock,
  OpenBlock,
  OpenEndBlock,
  Inverse,
  OpenInverse,
  OpenInverseChain,
  OpenUnescaped,
  Open,
}

export interface TokenContents {
  kind: TokenKind;
  value: string;
}

export class HandlebarsLexerDelegate implements LexerDelegate<State, TokenKind> {
  token!: TokenKind;

  constructor(private state: State = State.Top) {}

  top(): this {
    return new HandlebarsLexerDelegate(State.Top) as this;
  }

  for(state: State): LexerDelegate<State, TokenKind> {
    return new HandlebarsLexerDelegate(state);
  }

  next(char: Option<string>, rest: string): LexerNext<State, TokenKind> {
    switch (this.state) {
      case State.Top: {
        if (char === null) {
          return EOF();
        } else if (rest.startsWith('{{')) {
          return Begin(State.Mustache);
        } else if (rest.startsWith('\\')) {
          return Transition(Continue(Reconsume()), State.EscapeChar);
        } else {
          return Begin(State.Content);
        }
      }

      case State.Content: {
        if (char === null) {
          return Transition(Emit(TokenKind.Content, { first: Reconsume() }), State.Top);
        } else if (rest.startsWith('{{{')) {
          return Transition(Emit(TokenKind.Content), State.Mustache);
        } else if (rest.startsWith('{{')) {
          return Transition(Emit(TokenKind.Content), State.Mustache);
        } else if (rest.startsWith('\\')) {
          return Transition(Continue(Reconsume()), State.EscapeChar);
        } else {
          return Remain(Continue(Consume()));
        }
      }

      case State.EscapeChar:
        throw new Error('not implemented');

      case State.Comment:
        throw new Error('Not implemented');

      case State.Mustache:
        throw new Error('Not implemented');

      case State.Raw:
        throw new Error('Not implemented');

      default:
        throw new Error(`unexhausted ${this.state}`);
    }
  }

  clone(): HandlebarsLexerDelegate {
    return new HandlebarsLexerDelegate(this.state);
  }
}
