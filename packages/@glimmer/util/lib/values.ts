import { UserValue } from '@glimmer/interfaces';

export function asUserValue<T>(input: T): T & UserValue {
  return input;
}
