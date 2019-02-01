import { Option } from '@glimmer/interfaces';

export interface Span {
  start: number;
  end: number;
}

export interface Position {
  offset: number;
}

export type Result<T> = { status: 'ok'; value: T } | { status: 'err'; value: LexerError };

export type Item<T> = Result<{ token: T; span: Span }>;

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
      state: S;
    };

export type LexerAccumulate<T> =
  | {
      type: 'begin';
    }
  | {
      type: 'nothing';
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

  for(state: S): LexerDelegate<S, T>;

  top(): this;

  next(char: Option<string>, rest: string): LexerNext<S, T>;

  clone(): LexerDelegate<S, T>;
}

export class Lexer<T, S> {
  private rest: string;
  private tokenStart: string;
  private state: LexerDelegate<S, T>;

  private startPos = 0;
  private tokenLen = 0;
  private stack: LexerDelegate<S, T>[] = [];

  constructor(private input: string, private delegate: LexerDelegate<S, T>) {
    this.rest = input;
    this.tokenStart = input;
    this.state = delegate.top();
  }

  next(): Option<Item<T>> {
    let count = 0;

    while (true) {
      count += 1;

      if (count > 1000) {
        return err('infinite loop detected', { start: 0, end: 0 });
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

  step(next: LexerNext<S, T>): LoopCompletion<Option<Item<T>>> {
    switch (next.type) {
      case 'eof':
        return { type: 'return', value: null };

      case 'remain':
        return this.accumulate(next.value);

      case 'transition': {
        let ret = this.accumulate(next.value);
        this.transition(this.delegate.for(next.state));
        return ret;
      }

      case 'push-state': {
        let ret = this.accumulate(next.value);
        this.stack.push(this.delegate.for(next.state));

        this.transition(this.delegate.for(next.state));

        return ret;
      }

      case 'pop-state': {
        let ret = this.accumulate(next.value);
        let state = this.stack.pop()!;
        this.transition(state);

        return ret;
      }
    }
  }

  emit(token: Option<Item<T>>): Option<Item<T>> {
    return token;
  }

  transition(state: LexerDelegate<S, T>): void {
    this.state = state;
  }

  accumulate(accum: LexerAccumulate<T>): LoopCompletion<Option<Item<T>>> {
    switch (accum.type) {
      case 'begin':
        return { type: 'continue' };

      case 'nothing':
        return { type: 'continue' };

      case 'continue':
        this.action(accum.action);

        return { type: 'continue' };

      case 'skip':
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

        return {
          type: 'return',
          value: {
            status: 'ok',
            value: {
              token,
              span: { start: startPos, end: startPos + tokenLen },
            },
          },
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
}

function ok<T>(value: T): Result<T> {
  return { status: 'ok', value };
}

function err<T>(reason: string, span: Span): Result<T> {
  return { status: 'err', value: new LexerError(reason, span) };
}

export class LexerError {
  constructor(readonly reason: string, span: Span) {}
}

export function Begin<S, T>(state: S): LexerNext<S, T> {
  return { type: 'transition', value: { type: 'begin' }, state };
}

export function Consume(c: string | number = 1): LexerAction {
  return { type: 'consume', amount: typeof c === 'string' ? c.length : c };
}

export function Reconsume(): LexerAction {
  return { type: 'reconsume' };
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

export function EOF<S, T>(): LexerNext<S, T> {
  return { type: 'eof' };
}
