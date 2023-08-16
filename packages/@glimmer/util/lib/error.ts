import type { Reactive, UserException as UserExceptionInterface } from '@glimmer/interfaces';

import { isObject } from './collections';
import { stringifyDebugLabel } from './devmode/description';

export function isUserException(error: Error): error is UserException {
  return error instanceof UserException;
}

export function isError(value: unknown): value is Error {
  return isObject(value) && value instanceof Error;
}

export class EarlyError extends Error {
  static reactive(message: string, reactive: Reactive) {
    return new EarlyError(message, reactive);
  }

  readonly reactive: Reactive | null;

  constructor(message: string, reactive: Reactive | null = null) {
    super(fullMessage(message, reactive));

    this.reactive = reactive;
  }
}

function fullMessage(message: string, reactive: Reactive | null) {
  const label = reactive ? stringifyDebugLabel(reactive) : null;
  if (label && message.includes('%r')) {
    return message.replace('%r', `(${label})`);
  } else {
    return message;
  }
}

export class UserException extends Error implements UserExceptionInterface {
  static from(exception: unknown, defaultMessage: string): UserException {
    if (isObject(exception) && exception instanceof UserException) {
      return exception;
    } else {
      return new UserException(exception, defaultMessage);
    }
  }

  readonly #error: Error | undefined;
  readonly #exception: unknown;

  private constructor(exception: unknown, defaultMessage: string) {
    const error = isError(exception) ? exception : undefined;
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
