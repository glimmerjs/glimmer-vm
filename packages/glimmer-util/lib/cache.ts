import { dict } from './collections';

export default class Cache<T> {
  private store = dict<T>();

  get(key: string): T {
    return this.store[key];
  }

  set(key: string, value: T): T {
    return this.store[key] = value;
  }

  fetch(key: string, func: (key) => T): T {
    return this.get(key) || this.set(key, func(key));
  }
}
