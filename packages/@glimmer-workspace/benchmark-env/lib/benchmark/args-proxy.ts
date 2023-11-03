import type { CapturedArguments, CapturedNamedArguments, SomeReactive } from '@glimmer/interfaces';
import { unwrapReactive } from '@glimmer/reference';

import type { ComponentArgs } from '../interfaces';

class ArgsProxy implements ProxyHandler<CapturedNamedArguments> {
  isExtensible() {
    return false;
  }

  ownKeys(target: CapturedNamedArguments): string[] {
    return Object.keys(target);
  }

  getOwnPropertyDescriptor(
    target: CapturedNamedArguments,
    p: PropertyKey
  ): PropertyDescriptor | undefined {
    let desc: PropertyDescriptor | undefined;
    if (typeof p === 'string' && p in target) {
      const value = unwrapReactive(target[p] as SomeReactive);
      desc = {
        enumerable: true,
        configurable: false,
        writable: false,
        value,
      };
    }
    return desc;
  }

  has(target: CapturedNamedArguments, p: PropertyKey): boolean {
    return typeof p === 'string' ? p in target : false;
  }

  get(target: CapturedNamedArguments, p: PropertyKey): unknown {
    if (typeof p === 'string' && p in target) {
      return unwrapReactive(target[p] as SomeReactive);
    }
  }

  set() {
    return false;
  }
}

export default function argsProxy(args: CapturedArguments): ComponentArgs {
  return new Proxy(args.named, new ArgsProxy());
}
