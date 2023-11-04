import type { UserException } from '@glimmer/interfaces';

import { tracked } from './tracked';

type Handler = (error: UserException, retry: () => void) => void;

export class Woops {
  static noop(value = `no woops`): Woops {
    return new Woops(() => {}, false, value);
  }

  static error(value = `no woops`): Woops {
    return new Woops(() => {}, true, value);
  }

  @tracked _value: string;
  @tracked isError = false;
  readonly handleError: Handler;

  private constructor(handler: Handler, isError = false, value: string) {
    this.isError = isError;
    this.handleError = handler;
    this._value = value;
  }

  get value() {
    if (this.isError) {
      throw Error(`woops`);
    } else {
      return this._value;
    }
  }
}
