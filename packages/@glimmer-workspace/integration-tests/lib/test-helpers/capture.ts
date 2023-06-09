import { unwrap } from '@glimmer/validator/lib/utils';
import type { EmberishCurlyComponent, GlimmerishComponent } from '../components';

export class Capturing<T> {
  #value: T | undefined;

  capture(value: T) {
    this.#value = value;
  }

  get value() {
    return unwrap(this.#value);
  }

  assert() {
    return unwrap(this.#value);
  }
}

export function capturing<T>(): Capturing<T> {
  return new Capturing<T>();
}

export function capturingComponent<
  T extends typeof EmberishCurlyComponent | typeof GlimmerishComponent
>(ComponentClass: T): { instance: Capturing<InstanceType<T>>; Class: T } {
  let instance = capturing<InstanceType<T>>();
  let Class = class extends ComponentClass {
    constructor(...args: unknown[]) {
      super(...args);
      instance.capture(this as InstanceType<T>);
    }
  };

  return {
    instance,
    Class,
  };
}
