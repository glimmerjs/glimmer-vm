import { Option } from '@glimmer/interfaces';
import { TokenKind } from './lex';
import { Diagnostic, reportError } from './parser';
import { Span } from '../types/handlebars-ast';
import { assert } from '@glimmer/util';

export const EOF_SPAN = { start: -1, end: -1 };

export interface Position {
  offset: number;
}

export interface Tokens {
  peek(): LexItem<TokenKind>;
  consume(): LexItem<TokenKind>;
  clone(): Tokens;
}

export type Ok<T> = { status: 'ok'; value: T };
export type Err = { status: 'err'; value: Diagnostic };

export type Result<T> = Ok<T> | Err;

export type Spanned<T> = { value: T; span: Span };
export type LexItem<T> = { kind: T; span: Span };

export type LexerNext<S, T> =
  | {
      type: 'eof';
    }
  | {
      type: 'remain';
      value: LexerAccumulate<T>;
    }
  | {
      type: 'transition';
      value: LexerAccumulate<T>;
      state: S;
    }
  | {
      type: 'push-state';
      value: LexerAccumulate<T>;
      state: S;
    }
  | {
      type: 'pop-state';
      value: LexerAccumulate<T>;
    };

export type LexerAccumulate<T> =
  | {
      type: 'begin';
      action: LexerAction;
    }
  | {
      type: 'nothing';
      action: LexerAction;
    }
  | {
      type: 'continue';
      action: LexerAction;
    }
  | {
      type: 'skip';
      action: LexerAction;
    }
  | {
      type: 'emit';
      before?: LexerAction;
      after?: LexerAction;
      token: T;
    };

type LoopCompletion<T> =
  | {
      type: 'continue';
    }
  | { type: 'return'; value: T };

type LexerAction = { type: 'consume'; amount: number } | { type: 'reconsume' };
export interface LexerDelegate<S, T> {
  token: T;
  state: S;

  describe(): string;
  for(state: S): LexerDelegate<S, T>;

  top(): this;
  eof(): T;

  next(char: Option<string>, rest: string): LexerNext<S, T>;

  clone(): LexerDelegate<S, T>;
}

export interface Debug {
  trace?(v: string): void;
}

export class Lexer<T, S> {
  private rest: string;
  private state: LexerDelegate<S, T>;

  private startPos = 0;
  private tokenLen = 0;
  private stack: LexerDelegate<S, T>[] = [];

  constructor(
    private input: string,
    private delegate: LexerDelegate<S, T>,
    private errors: Diagnostic[],
    private debug: Debug = {}
  ) {
    this.rest = input;
    this.state = delegate.top();
  }

  next(): Result<LexItem<T>> {
    let count = 0;

    while (true) {
      count += 1;

      if (count > 1000) {
        return Err(reportError(this.errors, 'infinite loop detected', { start: -1, end: -1 }));
      }

      let { state, rest } = this;

      let nextChar: Option<string> = rest.length > 0 ? rest[0] : null;

      let next = state.next(nextChar, rest);

      let step = this.step(next);

      switch (step.type) {
        case 'continue':
          continue;
        case 'return':
          return this.emit(step.value);
      }
    }
  }

  step(next: LexerNext<S, T>): LoopCompletion<Result<LexItem<T>>> {
    switch (next.type) {
      case 'eof':
        return {
          type: 'return',
          value: Ok({ kind: this.delegate.eof(), span: EOF_SPAN }),
        };

      case 'remain':
        return this.accumulate(next.value);

      case 'transition': {
        let ret = this.accumulate(next.value);
        this.transition(this.delegate.for(next.state));
        return ret;
      }

      case 'push-state': {
        let ret = this.accumulate(next.value);
        this.stack.push(this.state);

        this.transition(this.delegate.for(next.state));

        return ret;
      }

      case 'pop-state': {
        let ret = this.accumulate(next.value);
        let state = this.stack.pop();

        if (state === undefined) {
          throw new Error('state machine bug');
        }

        this.transition(state);

        return ret;
      }
    }
  }

  emit(token: Result<LexItem<T>>): Result<LexItem<T>> {
    return token;
  }

  transition(state: LexerDelegate<S, T>): void {
    this.trace(`transition, stack = ${JSON.stringify(this.stack.map(s => s.state))}`);

    this.state = state;
  }

  accumulate(accum: LexerAccumulate<T>): LoopCompletion<Result<LexItem<T>>> {
    switch (accum.type) {
      case 'begin':
        assert(
          this.tokenLen === 0,
          'you can only begin a new token when there are no accumulated characters'
        );
        this.action(accum.action);
        return { type: 'continue' };

      case 'nothing':
        assert(
          this.tokenLen === 0,
          'you can only do nothing when there are no accumulated characters'
        );
        this.action(accum.action);
        return { type: 'continue' };

      case 'continue':
        this.action(accum.action);

        return { type: 'continue' };

      case 'skip':
        assert(
          this.tokenLen === 0,
          'you can only skip when there are no accumulated characters yet'
        );
        this.action(accum.action);

        this.startPos += this.tokenLen;
        this.tokenLen = 0;

        return { type: 'continue' };

      case 'emit':
        let { before, token } = accum;

        if (before !== undefined) {
          this.action(before);
        }

        let { startPos, tokenLen } = this;

        this.startPos = startPos + tokenLen;
        this.tokenLen = 0;

        this.trace(
          `${this.state.describe()} -> emitting ${token} start=${startPos}, end=${startPos +
            tokenLen}, slice=${JSON.stringify(this.input.slice(startPos, startPos + tokenLen))}`
        );

        return {
          type: 'return',
          value: Ok({
            kind: token,
            span: { start: startPos, end: startPos + tokenLen },
          }),
        };
    }
  }

  action(action: LexerAction) {
    switch (action.type) {
      case 'consume':
        this.tokenLen += action.amount;
        this.rest = this.rest.slice(action.amount);
        return;

      case 'reconsume':
        return;
    }
  }

  private trace(s: string) {
    if (this.debug.trace) {
      this.debug.trace(s);
    }
  }
}

export function Ok<T>(value: T): Result<T> {
  return { status: 'ok', value };
}

export function Err<T>(diagnostic: Diagnostic): Result<T> {
  return { status: 'err', value: diagnostic };
}

export function PushBegin<S, T>(state: S, action: LexerAction): LexerNext<S, T> {
  return { type: 'push-state', value: { type: 'begin', action }, state };
}

export function PopBegin<S, T>(action: LexerAction): LexerNext<S, T> {
  return { type: 'pop-state', value: { type: 'begin', action } };
}

export function Consume(c: string | number = 1): LexerAction {
  return { type: 'consume', amount: typeof c === 'string' ? c.length : c };
}

export function Reconsume(): LexerAction {
  return { type: 'reconsume' };
}

export function Skip<T>(amount: number): LexerAccumulate<T> {
  return {
    type: 'skip',
    action: { type: 'consume', amount },
  };
}

export function Continue<T>(action: LexerAction): LexerAccumulate<T> {
  return { type: 'continue', action };
}

export function Emit<T>(
  token: T,
  { first, andThen }: { first?: LexerAction; andThen?: LexerAction } = {}
): LexerAccumulate<T> {
  return { type: 'emit', token, before: first, after: andThen };
}

export function Remain<S, T>(accum: LexerAccumulate<T>): LexerNext<S, T> {
  return { type: 'remain', value: accum };
}

export function Transition<S, T>(accum: LexerAccumulate<T>, state: S): LexerNext<S, T> {
  return { type: 'transition', value: accum, state };
}

export function PushState<S, T>(accum: LexerAccumulate<T>, state: S): LexerNext<S, T> {
  return { type: 'push-state', value: accum, state };
}

export function PopState<S, T>(accum: LexerAccumulate<T>): LexerNext<S, T> {
  return { type: 'pop-state', value: accum };
}

export function Nothing<T>(action: LexerAction): LexerAccumulate<T> {
  return { type: 'nothing', action };
}

export function EOF<S, T>(): LexerNext<S, T> {
  return { type: 'eof' };
}
