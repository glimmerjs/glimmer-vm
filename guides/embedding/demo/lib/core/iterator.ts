import type { Nullable } from '@glimmer/interfaces';
import type { IteratorDelegate } from '@glimmer/reference';

export function isNativeIterable(value: unknown): value is Iterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.iterator in value;
}

export class NativeIterator<T = unknown> implements IteratorDelegate {
  static from<T>(iterable: Iterable<T>): Nullable<NativeIterator> {
    const iterator = iterable[Symbol.iterator]();
    const result = iterator.next();
    const { done } = result;

    if (done === true) {
      return null;
    } else {
      return new this(iterator, result);
    }
  }

  private position = 0;

  constructor(
    private iterable: Iterator<T>,
    private result: IteratorResult<T>
  ) {}

  isEmpty(): false {
    return false;
  }

  next(): Nullable<{ value: T; memo: number }> {
    const { iterable, result, position } = this;

    if (result.done) {
      return null;
    }

    const value = result.value;
    const memo = position;

    this.position++;
    this.result = iterable.next();

    return { value, memo };
  }
}
