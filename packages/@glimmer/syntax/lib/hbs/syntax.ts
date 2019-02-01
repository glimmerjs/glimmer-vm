import { Result } from './lexing';

type HandlebarsLexer = any;

export class ResultImpl<T> {
  constructor(private inner: Result<T>) {}

  get status(): 'ok' | 'err' {
    return this.inner.status;
  }

  andThen(callback: (value: T) => ResultImpl<T>): ResultImpl<T> {
    if (this.inner.status === 'ok') {
      return new ResultImpl(callback(this.inner.value).inner);
    } else {
      return this;
    }
  }

  ifOk(callback: (value: T) => ResultImpl<unknown>): ResultImpl<T> {
    if (this.inner.status === 'ok') {
      let result = callback(this.inner.value);

      if (result.inner.status === 'ok') {
        return this;
      } else {
        return (result as unknown) as ResultImpl<T>;
      }
    } else {
      return this;
    }
  }
}

export interface Syntax<T = unknown> {
  test(lexer: HandlebarsLexer): boolean;
  expect(lexer: HandlebarsLexer): ResultImpl<T>;
}

export type Token<S extends Syntax<unknown>> = S extends Syntax<infer T> ? T : never;

export interface Delimiter<Open extends Syntax = Syntax, Close extends Syntax = Syntax> {
  openSyntax(): Open;
  closeSyntax(): Close;
}

export type OpenToken<D extends Delimiter> = D extends Delimiter<infer T, any> ? T : never;
export type CloseToken<D extends Delimiter> = D extends Delimiter<any, infer T> ? T : never;
