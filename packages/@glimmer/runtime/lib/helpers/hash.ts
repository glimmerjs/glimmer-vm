import { CapturedArguments, CapturedNamedArguments, Dict, Source } from '@glimmer/interfaces';
import { setCustomSourceFor } from '@glimmer/manager';
import { UNDEFINED_SOURCE } from '@glimmer/reference';
import { dict, HAS_NATIVE_PROXY } from '@glimmer/util';
import {
  getValue,
  untrack,
  storageFor,
  setDeps,
  createCache,
  createConstStorage,
} from '@glimmer/validator';
import { deprecate } from '@glimmer/global-context';
import { internalHelper } from './internal-helper';

function SourceForNamedArg(namedArgs: CapturedNamedArguments, key: string): Source {
  if (key in namedArgs) {
    // bootstrap the cache if it was not already used.
    untrack(() => getValue(namedArgs[key]));
    return namedArgs[key];
  }

  return UNDEFINED_SOURCE;
}

let hashProxyFor: (args: CapturedNamedArguments) => Record<string, unknown>;

class HashProxy implements ProxyHandler<Record<string, unknown>> {
  constructor(private named: CapturedNamedArguments, private target: Record<string, unknown>) {}

  private argsCaches = dict<Source>();

  syncKey(key: string | number) {
    const { argsCaches, named } = this;

    if (!(key in named)) return;

    let cache = argsCaches[key];

    if (cache === undefined) {
      const inner = this.named[key as string];

      argsCaches[key] = cache = createCache(() => {
        this.target[key] = getValue(inner);
      });
    }

    getValue(cache);
  }

  get(target: Record<string, unknown>, prop: string | number) {
    this.syncKey(prop);

    return target[prop];
  }

  set(target: Record<string, unknown>, prop: string | number, value: unknown) {
    deprecate(
      `You set the '${prop}' property on a {{hash}} object. Setting properties on objects generated by {{hash}} is deprecated. Please update to use an object created with a tracked property or getter, or with a custom helper.`,
      false,
      { id: 'setting-on-hash' }
    );

    this.syncKey(prop);

    target[prop] = value;

    return true;
  }

  has(target: Record<string, unknown>, prop: string | number) {
    return prop in this.named || prop in target;
  }

  ownKeys(target: {}) {
    for (let key in this.named) {
      this.syncKey(key);
    }

    return Object.getOwnPropertyNames(target);
  }

  getOwnPropertyDescriptor(target: {}, prop: string | number) {
    if (prop in this.named) {
      return {
        enumerable: true,
        configurable: true,
        writable: true,
      };
    }

    return Object.getOwnPropertyDescriptor(target, prop);
  }
}

if (HAS_NATIVE_PROXY) {
  hashProxyFor = (named) => {
    const target = dict();
    const proxy = new Proxy(target, new HashProxy(named, target));

    setCustomSourceFor(proxy, (_obj: object, key: string) => {
      let argTag = SourceForNamedArg(named, key);
      let proxyTag = storageFor(proxy, key);

      setDeps(proxyTag, null, [argTag]);

      return proxyTag;
    });

    return proxy;
  };
} else {
  hashProxyFor = (named) => {
    const proxy = dict();

    // Create a HashProxy handler to store the local state in case anyone
    // overrides a named value. It handles all of the details in terms of
    // syncing state up and returning the correct value based on autotracking.
    const localState = dict();
    const proxyHandler = new HashProxy(named, localState);

    Object.keys(named).forEach((name) => {
      Object.defineProperty(proxy, name, {
        enumerable: true,
        configurable: true,

        get() {
          return proxyHandler.get(localState, name);
        },

        set(value) {
          return proxyHandler.set(localState, name, value);
        },
      });
    });

    setCustomSourceFor(proxy, (_obj: object, key: string) => {
      let argTag = SourceForNamedArg(named, key);
      let proxyTag = storageFor(proxy, key);

      setDeps(proxyTag, null, [argTag]);

      return proxyTag;
    });

    return proxy;
  };
}

/**
   Use the `{{hash}}` helper to create a hash to pass as an option to your
   components. This is specially useful for contextual components where you can
   just yield a hash:

   ```handlebars
   {{yield (hash
      name='Sarah'
      title=office
   )}}
   ```

   Would result in an object such as:

   ```js
   { name: 'Sarah', title: this.get('office') }
   ```

   Where the `title` is bound to updates of the `office` property.

   Note that the hash is an empty object with no prototype chain, therefore
   common methods like `toString` are not available in the resulting hash.
   If you need to use such a method, you can use the `call` or `apply`
   approach:

   ```js
   function toString(obj) {
     return Object.prototype.toString.apply(obj);
   }
   ```

   @method hash
   @param {Object} options
   @return {Object} Hash
   @public
 */
export default internalHelper(
  ({ named }: CapturedArguments): Source<Dict<unknown>> => {
    return createConstStorage(hashProxyFor(named), 'hash');
  }
);
