import type { UpdatableTag } from '@glimmer/interfaces';

import { consumeTag } from './tracking';
import { createUpdatableTag, DIRTY_TAG } from './validators';

type Equality<T> = (a: T, b: T) => boolean;

export class Cell<Value> {
  static create<T>(value: T, equals: Equality<T> = Object.is): Cell<T> {
    return new Cell(value, equals);
  }

  #value: Value;
  readonly #equals?: Equality<Value> | undefined;
  readonly #tag: UpdatableTag;

  private constructor(value: Value, equals?: Equality<Value>) {
    this.#value = value;
    this.#equals = equals;
    this.#tag = createUpdatableTag();
  }

  get current() {
    consumeTag(this.#tag);

    return this.#value;
  }

  read(): Value {
    consumeTag(this.#tag);

    return this.#value;
  }

  set(value: Value): boolean {
    if (this.#equals?.(this.#value, value)) {
      return false;
    }

    this.#value = value;

    DIRTY_TAG(this.#tag);

    return true;
  }

  update(updater: (value: Value) => Value): void {
    this.set(updater(this.read()));
  }

  freeze(): void {
    throw new Error(`Not Implemented`);
  }
}
