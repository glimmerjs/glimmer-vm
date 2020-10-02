import { isPresent } from '@glimmer/util';
import { LiteralValue } from './expr';

export type PackedList<T extends NonNullable<unknown>> = T[] | LiteralValue.Null;

export function list<T>(list: T[]): PackedList<T> {
  if (isPresent(list)) {
    return list;
  } else {
    return LiteralValue.Null;
  }
}
