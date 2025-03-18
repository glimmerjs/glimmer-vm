const TAGS = new WeakMap<object, Record<PropertyKey, ValueTag>>();

export interface Tag {
  get revision(): number;
}

interface Runtime {
  /**
   * Consumes a tag in the current tracking frame, if one is active.
   */
  consume(tag: Tag): void;

  /**
   * Returns the timeline's current revision.
   */
  current(): number;

  /**
   * Advances the revision counter, returning the new revision.
   */
  advance(): number;

  /**
   * Begins a new tracking frame. All `consume` operations that happen after this will be
   * associated with the new frame.
   */
  begin(): void;

  /**
   * Ends the current tracking frame, returning a tag that contains all of the members that were
   * consumed in the duration of the frame. If a previous frame exists, it will become the current
   * frame, and it will consume the returned tag.
   */
  commit(): Tag;
}

export declare const runtime: Runtime;

export function tracked<V, This extends object>(
  _value: ClassAccessorDecoratorTarget<This, V>,
  context: ClassAccessorDecoratorContext<This, V>
): ClassAccessorDecoratorResult<This, V> {
  context.addInitializer(function (this: This) {
    ValueTag.init(this, context.name);
  });

  return {
    get(this: This): V {
      const tag = ValueTag.get(this, context.name);
      tag.consume();
      return context.access.get(this);
    },

    set(this: This, value: V): void {
      const tag = ValueTag.get(this, context.name);
      context.access.set(this, value);
      tag.update();
    },
  };
}

const COMPUTE = new WeakMap<Cache<unknown>, () => unknown>();

declare const FN: unique symbol;
type FN = typeof FN;

type Cache<T> = {
  [FN]: () => T;
};

export function createCache<T>(fn: () => T): Cache<T> {
  const cache = {} as Cache<T>;
  let last = undefined as { value: T; tag: Tag; revision: number } | undefined;

  COMPUTE.set(cache, () => {
    if (last && last.revision >= last.tag.revision) {
      runtime.consume(last.tag);
      return last.value;
    }

    runtime.begin();
    try {
      const result = fn();
      const tag = runtime.commit();
      last = { value: result, tag, revision: runtime.current() };
      runtime.consume(tag);
      return result;
    } catch {
      last = undefined;
    }
  });

  return cache;
}

export function getCache<T>(cache: Cache<T>): T {
  const fn = COMPUTE.get(cache);

  if (!fn) {
    throw new Error('You must only call `getCache` with the return value of `createCache`');
  }

  return fn() as T;
}

export class ValueTag implements Tag {
  static init(obj: object, key: PropertyKey): ValueTag {
    let tags = TAGS.get(obj);
    if (!tags) {
      tags = {};
      TAGS.set(obj, tags);
    }

    const tag = new ValueTag();
    tags[key] = tag;
    return tag;
  }

  static get(obj: object, key: PropertyKey): ValueTag {
    const tag = TAGS.get(obj)?.[key];
    assert(tag, `No tag found for object ${obj}@${String(key)}`);
    return tag;
  }

  #revision = runtime.current();

  get revision(): number {
    return this.#revision;
  }

  consume(this: ValueTag): void {
    runtime.consume(this);
  }

  update(this: ValueTag): void {
    this.#revision = runtime.advance();
  }
}

/**
 * Asserts an invariant. This function represents code that would be removed in user-facing code,
 * because the mechanics of the implementation should enforce the invariant.
 */
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
