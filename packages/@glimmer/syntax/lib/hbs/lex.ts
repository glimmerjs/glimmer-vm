import { Option } from '@glimmer/interfaces';
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
  PushState,
  PopState,
  PushBegin,
  PopBegin,
  Skip,
  Debug,
} from './lexing';

const LOOKAHEAD = /^[=~;}\s;\/.)|]/;
const ID = /^[^\s\d!"#%-,\.\/;->@\[-\^`\{-~][^\s!"#%-,\.;->@\[-\^`\{-~]+/;

function testWs(s: string): Option<string> {
  let match = s.match(/^\s+/);

  if (match) {
    return match[0];
  } else {
    return null;
  }
}

function testId(s: string): Option<string> {
  let match = s.match(ID);

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
  Top = 'Top',
  Content = 'Content',
  Comment = 'Comment',
  BlockComment = 'BlockComment',
  InlineComment = 'InlineComment',
  DoubleMustache = 'DoubleMustache',
  TripleMustache = 'TripleMustache',
  ExpectCloseCurly = 'ExpectCloseCurly',
  EndBlock = 'EndBlock',
  Raw = 'Raw',

  BlockParams = 'BlockParams',
  BlockParamList = 'BlockParamList',
  ElseBlock = 'ElseBlock',

  Expression = 'Expression',
  ExpressionList = 'ExpressionList',
  Number = 'Number',
  AtName = 'AtName',
  AfterIdent = 'AfterIdent',
  AfterDot = 'AfterDot',
  DoubleString = 'DoubleString',
  SingleString = 'SingleString',
  EscapeChar = 'EscapeChar',
}

export const enum TokenKind {
  Identifier = 'Identifier',
  AtName = 'AtName',
  Number = 'Number',
  String = 'String',

  Pipe = 'Pipe',
  Dot = 'Dot',
  Equals = 'Equals',
  Else = 'Else',

  Content = 'Content',
  OpenRawBlock = 'OpenRawBlock',
  EndRawBlock = 'EndRawBlock',
  CloseRawBlock = 'CloseRawBlock',
  InlineComment = 'Comment',
  BlockComment = 'BlockComment',
  OpenSexpr = 'OpenSexpr',
  CloseSexpr = 'CloseSexpr',
  OpenPartial = 'OpenPartial',
  OpenPartialBlock = 'ClosePartial',
  OpenBlock = 'OpenBlock',
  OpenEndBlock = 'OpenEndBlock',
  Inverse = 'Inverse',
  OpenInverse = 'OpenInverse',
  OpenInverseChain = 'OpenInverseChain',
  OpenUnescaped = 'OpenUnescaped',
  CloseUnescaped = 'CloseUnescaped',
  Open = 'Open',
  Close = 'Close',
  OpenParen = 'OpenParen',
  CloseParen = 'CloseParen',
  EOF = 'EOF',
}

export interface TokenContents {
  kind: TokenKind;
  value: string;
}

export class HandlebarsLexerDelegate implements LexerDelegate<State, TokenKind> {
  token!: TokenKind;

  constructor(private debug: Debug, private state: State = State.Top) {}

  describe() {
    return this.state;
  }

  top(): this {
    return new HandlebarsLexerDelegate(this.debug, State.Top) as this;
  }

  eof(): TokenKind {
    return TokenKind.EOF;
  }

  for(state: State): LexerDelegate<State, TokenKind> {
    return new HandlebarsLexerDelegate(this.debug, state);
  }

  next(char: Option<string>, rest: string): LexerNext<State, TokenKind> {
    let { state } = this;

    function unexpected(): Error {
      return new Error(
        `not implemented (in HandlebarsLexerDelegate#${state}) for rest=${JSON.stringify(rest)}`
      );
    }

    function unexpectedEOF(): Error {
      throw new Error(`unexpected EOF (in HandlebarsLexerDelegate#${state})`);
    }

    this.trace(`rest=${JSON.stringify(rest)}`);

    switch (this.state) {
      case State.Top: {
        if (char === null) {
          return EOF();
        } else if (rest.startsWith('{{!')) {
          return PushBegin(State.Comment, Consume(3));
        } else if (rest.startsWith('{{/')) {
          return PushState(Emit(TokenKind.OpenEndBlock, { first: Consume(3) }), State.EndBlock);
        } else if (rest.startsWith('{{#')) {
          return PushBegin(State.DoubleMustache, Reconsume());
        } else if (rest.startsWith('{{{')) {
          return PushState(
            Emit(TokenKind.OpenUnescaped, { first: Consume(3) }),
            State.TripleMustache
          );
        } else if (rest.startsWith('{{')) {
          return PushState(Emit(TokenKind.Open, { first: Consume(2) }), State.DoubleMustache);
        } else if (rest.startsWith('\\')) {
          return Transition(Continue(Reconsume()), State.EscapeChar);
        } else {
          return PushBegin(State.Content, Reconsume());
        }
      }

      case State.Content: {
        if (char === null) {
          return Transition(Emit(TokenKind.Content, { first: Reconsume() }), State.Top);
        } else if (rest.startsWith('{{')) {
          return Transition(Emit(TokenKind.Content), State.Top);
        } else if (rest.startsWith('\\')) {
          return Transition(Continue(Reconsume()), State.EscapeChar);
        } else {
          return Remain(Continue(Consume()));
        }
      }

      case State.ElseBlock: {
        let match;

        if (char === null) {
          throw unexpectedEOF();
        } else if ((match = testWs(rest))) {
          return Remain(Skip(match.length));
        } else if (rest.startsWith('}}')) {
          return PopState(Emit(TokenKind.Close, { first: Consume(2) }));
        } else {
          return PushBegin(State.Expression, Reconsume());
        }
      }

      case State.EndBlock: {
        let match;

        if (char === null) {
          throw unexpectedEOF();
        } else if ((match = testId(rest))) {
          return Transition(
            Emit(TokenKind.Identifier, { first: Consume(match.length) }),
            State.ExpectCloseCurly
          );
        } else {
          throw unexpected();
        }
      }

      case State.ExpectCloseCurly: {
        if (char === null) {
          throw unexpectedEOF();
        } else if (rest.startsWith('}}')) {
          return PopState(Emit(TokenKind.Close, { first: Consume(2) }));
        } else {
          throw unexpected();
        }
      }

      case State.DoubleMustache: {
        if (rest.startsWith('{{#')) {
          return PushState(Emit(TokenKind.OpenBlock, { first: Consume(3) }), State.ExpressionList);
        } else if (rest.startsWith('{{')) {
          return PushState(Emit(TokenKind.Open, { first: Consume(2) }), State.ExpressionList);
        } else if (rest.startsWith('}}')) {
          return Transition(Emit(TokenKind.Close, { first: Consume(2) }), State.Top);
        } else {
          return PushBegin(State.ExpressionList, Reconsume());
        }
      }

      case State.ExpressionList: {
        let match;

        if ((match = testWs(rest))) {
          return Remain(Skip(match.length));
        } else if (rest.startsWith('as')) {
          return PushState(Emit(TokenKind.Identifier, { first: Consume(2) }), State.BlockParams);
        } else if (rest.startsWith('}}')) {
          return PopBegin(Reconsume());
        } else {
          return PushBegin(State.Expression, Reconsume());
        }
      }

      case State.BlockParams: {
        let match;

        if ((match = testWs(rest))) {
          return Remain(Skip(match.length));
        } else if (char === '|') {
          return Transition(Emit(TokenKind.Pipe, { first: Consume() }), State.BlockParamList);
        } else {
          throw unexpected();
        }
      }

      case State.BlockParamList: {
        let match;

        if ((match = testWs(rest))) {
          return Remain(Skip(match.length));
        } else if ((match = testId(rest))) {
          return Remain(Emit(TokenKind.Identifier, { first: Consume(match.length) }));
        } else if (char === '|') {
          return PopState(Emit(TokenKind.Pipe, { first: Consume() }));
        } else {
          throw unexpected();
        }
      }

      case State.Expression: {
        let match;

        if ((match = testWs(rest))) {
          return PopState(Continue(Reconsume()));
        } else if (rest.match(/^\d/)) {
          return PushState(Continue(Reconsume()), State.Number);
        } else if (char === '@') {
          return Transition(Continue(Consume()), State.AtName);
        } else if (char === '"') {
          return PushBegin(State.DoubleString, Consume());
        } else if (char === "'") {
          return PushBegin(State.SingleString, Consume());
        } else if ((match = testId(rest))) {
          return Transition(
            Emit(TokenKind.Identifier, { first: Consume(match.length) }),
            State.AfterIdent
          );
        } else if (char === '}') {
          return PopBegin(Reconsume());
        } else {
          throw unexpected();
        }
      }

      case State.AtName: {
        let id;

        if (char === null) {
          throw unexpectedEOF();
        } else if ((id = testId(rest))) {
          return Transition(
            Emit(TokenKind.AtName, { first: Consume(id.length) }),
            State.AfterIdent
          );
        } else {
          throw unexpected();
        }
      }

      case State.AfterIdent: {
        let match;

        if (char === null) {
          // TODO: this is an error case
          return PopState(Emit(TokenKind.Number, { first: Reconsume() }));
        } else if (char === '=') {
          return Transition(Emit(TokenKind.Equals, { first: Consume() }), State.Expression);
        } else if (char === '.') {
          return PushState(Emit(TokenKind.Dot, { first: Consume() }), State.AfterDot);
        } else if ((match = testWs(rest))) {
          return PopState(Skip(match.length));
        } else if (char === '}') {
          return PopState(Continue(Reconsume()));
        } else {
          throw unexpected();
        }
      }

      case State.AfterDot: {
        let match;

        if (char === null) {
          throw unexpectedEOF();
        } else if ((match = testId(rest))) {
          return PopState(Emit(TokenKind.Identifier, { first: Consume(match.length) }));
        } else {
          throw unexpected();
        }
      }

      case State.Number: {
        if (char === null) {
          // TODO: this is an error case
          return PopState(Emit(TokenKind.Number, { first: Reconsume() }));
        } else if (char.match(/\d/)) {
          return Remain(Continue(Consume()));
        } else {
          return PopState(Emit(TokenKind.Number, { first: Reconsume() }));
        }
      }

      case State.EscapeChar:
        throw new Error('not implemented');

      case State.Comment:
        if (rest.startsWith('--')) {
          return Transition(Continue(Consume()), State.BlockComment);
        } else {
          return Transition(Continue(Reconsume()), State.InlineComment);
        }

      case State.BlockComment:
        if (rest.startsWith('--}}')) {
          return Transition(Emit(TokenKind.BlockComment, { first: Consume(4) }), State.Top);
        } else {
          return Remain(Continue(Consume(1)));
        }

      case State.InlineComment:
        if (rest.startsWith('}}')) {
          return Transition(Emit(TokenKind.InlineComment, { first: Consume(2) }), State.Top);
        } else {
          return Remain(Continue(Consume(1)));
        }

      case State.DoubleString: {
        if (char === '"') {
          return PopState(Emit(TokenKind.String, { first: Consume() }));
        } else if (char === '\\') {
          return PushState(Continue(Consume(1)), State.EscapeChar);
        } else {
          return Remain(Continue(Consume(1)));
        }
      }

      case State.SingleString: {
        if (char === "'") {
          return PopState(Emit(TokenKind.String, { first: Consume() }));
        } else if (char === '\\') {
          return PushState(Continue(Consume(1)), State.EscapeChar);
        } else {
          return Remain(Continue(Consume(1)));
        }
      }

      case State.EscapeChar: {
        return PopState(Continue(Consume(1)));
      }

      case State.TripleMustache:
        throw new Error('not implemented (TripleMustache)');

      case State.Raw:
        throw new Error('Not implemented');

      default:
        throw new Error(`unexhausted ${this.state}`);
    }
  }

  trace(message: string) {
    if (this.debug.trace) {
      this.debug.trace(`${this.state} -> ${message}`);
    }
  }

  clone(): HandlebarsLexerDelegate {
    return new HandlebarsLexerDelegate(this.debug, this.state);
  }
}
