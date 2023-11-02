import { isObject } from './collections';

export function isUserException(error: Error): error is UserException {
  return error instanceof UserException;
}

export class UserException extends Error {
  readonly #error: Error | undefined;
  readonly #exception: unknown;

  constructor(exception: unknown, defaultMessage: string) {
    const error = isObject(exception) && exception instanceof Error ? exception : undefined;
    const message = error?.message ?? defaultMessage;

    super(message);

    if (error) {
      this.#error = error;
      this.cause = error;
    } else {
      this.#error = undefined;
    }
  }

  get error(): Error | undefined {
    return this.#error;
  }

  get exception(): unknown {
    return this.#exception;
  }
}
