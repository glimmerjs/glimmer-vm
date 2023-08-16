import type { UserException } from '@glimmer/interfaces';

import { tracked } from './tracked';

type Handler = (error: UserException, retry: () => void) => void;

export class Woops {
  static noop(value = `no woops`): Woops {
    return new Woops(false, value);
  }

  static error(value = `no woops`): Woops {
    return new Woops(true, value);
  }

  @tracked _value: string;
  @tracked isError = false;
  readonly handleError: Handler;
  #retry: undefined | (() => void);

  private constructor(isError = false, value: string) {
    this.isError = isError;
    this.handleError = (error, retry) => {
      this.#retry = retry;
    };
    this._value = value;
  }

  get value() {
    if (this.isError) {
      throw Error(`woops`);
    } else {
      return this._value;
    }
  }

  set value(value: string) {
    if (this.isError) {
      throw Error(`woops`);
    } else {
      this._value = value;
    }
  }

  recover() {
    this.isError = false;
    if (this.#retry) {
      this.#retry();
    }
  }
}
