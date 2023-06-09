import type { Tag, TagDebug } from '@glimmer/interfaces';

import { debug } from './debug';
import { unwrap, unwrapDebug } from './utils';
import {
  combine,
  CONSTANT_TAG,
  isConstTag,
  type Revision,
  validateTag,
  valueForTag,
} from './validators';
import { LOCAL_SHOULD_LOG_TRACES, LOCAL_SHOULD_LOG_TRACKING } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';

/**
 * An object that that tracks @tracked accessor properties that were consumed.
 */
class Tracker {
  private tags = new Set<Tag>();
  private last: Tag | null = null;
  declare readonly name?: string | undefined;

  constructor(name?: string) {
    if (import.meta.env.DEV) this.name = name;
  }

  add(tag: Tag) {
    if (tag === CONSTANT_TAG) return;

    this.tags.add(tag);

    if (import.meta.env.DEV) {
      unwrap(debug.markTagAsConsumed)(tag);
    }

    this.last = tag;
  }

  combine(): Tag {
    let { tags } = this;

    if (tags.size === 0) {
      return CONSTANT_TAG;
    } else if (tags.size === 1) {
      return this.last as Tag;
    } else {
      let tagsArray: Tag[] = [];
      for (let tag of tags) tagsArray.push(tag);
      return import.meta.env.DEV ? combine(tagsArray, this.name) : combine(tagsArray);
    }
  }
}

/**
 * Whenever a tracked computed property is entered, the current tracker is
 * saved off and a new tracker is replaced.
 *
 * Any tracked properties consumed are added to the current tracker.
 *
 * When a tracked computed property is exited, the tracker's tags are
 * combined and added to the parent tracker.
 *
 * The consequence is that each tracked computed property has a tag
 * that corresponds to the tracked properties consumed inside of
 * itself, including child tracked computed properties.
 */
let CURRENT_TRACKER: Tracker | null = null;

const OPEN_TRACK_FRAMES: (Tracker | null)[] = [];

export function beginTrackFrame(debuggingContext?: string | false): void {
  if (import.meta.env.DEV) {
    if (LOCAL_SHOULD_LOG_TRACKING) {
      if (typeof debuggingContext === 'string') {
        LOCAL_LOGGER.groupCollapsed(
          `%ctracking frame: %c${debuggingContext}`,
          `color: #999; font-weight: normal`,
          `color: #599; font-weight: normal`
        );
      } else {
        LOCAL_LOGGER.groupCollapsed('tracking frame');
      }
    }

    OPEN_TRACK_FRAMES.push(CURRENT_TRACKER);
    CURRENT_TRACKER = new Tracker(debuggingContext || undefined);

    unwrap(debug.beginTrackingTransaction)(debuggingContext);
    return;
  }

  OPEN_TRACK_FRAMES.push(CURRENT_TRACKER);
  CURRENT_TRACKER = new Tracker();
}

export function endTrackFrame(): Tag {
  let current = CURRENT_TRACKER;

  if (import.meta.env.DEV) {
    if (OPEN_TRACK_FRAMES.length === 0) {
      throw new Error('attempted to close a tracking frame, but one was not open');
    }

    unwrap(debug.endTrackingTransaction)();
  }

  CURRENT_TRACKER = OPEN_TRACK_FRAMES.pop() || null;
  let tag = unwrap(current).combine();

  if (import.meta.env.DEV && LOCAL_SHOULD_LOG_TRACKING) {
    LOCAL_LOGGER.log(`%cframe revision = %c${valueForTag(tag)}`, `color: #999;`, `color: #595;`);
    LOCAL_LOGGER.groupEnd();
  }

  return tag;
}

export function beginUntrackFrame(): void {
  OPEN_TRACK_FRAMES.push(CURRENT_TRACKER);
  CURRENT_TRACKER = null;
}

export function endUntrackFrame(): void {
  if (import.meta.env.DEV && OPEN_TRACK_FRAMES.length === 0) {
    throw new Error('attempted to close a tracking frame, but one was not open');
  }

  CURRENT_TRACKER = OPEN_TRACK_FRAMES.pop() || null;
}

// This function is only for handling errors and resetting to a valid state
export function resetTracking(): string | void {
  while (OPEN_TRACK_FRAMES.length > 0) {
    OPEN_TRACK_FRAMES.pop();
  }

  CURRENT_TRACKER = null;

  if (import.meta.env.DEV) {
    return unwrap(debug.resetTrackingTransaction)();
  }
}

export function isTracking(): boolean {
  return CURRENT_TRACKER !== null;
}

export function consumeTag(tag: Tag): void {
  if (CURRENT_TRACKER !== null) {
    if (import.meta.env.DEV && LOCAL_SHOULD_LOG_TRACKING) {
      let debug = unwrapDebug(tag.debug);
      logTag(debug);

      // eslint-disable-next-line no-inner-declarations
      function logTag(tag: TagDebug) {
        if (tag.subtags) {
          if (tag.subtags.length === 0) {
            LOCAL_LOGGER.log(...leaf(tag, ' consumed '));
          } else {
            LOCAL_LOGGER.groupCollapsed(...leaf(tag, 'consumed '));
            for (let subtag of leafSubtags(tag.subtags)) {
              LOCAL_LOGGER.log(...leaf(subtag, `╰► `));
            }
            LOCAL_LOGGER.groupEnd();
          }
        } else if (tag.delegate) {
          logTag(tag.delegate);
        } else {
          LOCAL_LOGGER.log(...leaf(tag, 'consumed '));
        }
      }

      // eslint-disable-next-line no-inner-declarations
      function leaf(tag: TagDebug, label?: string): unknown[] {
        return [
          `%c${label}%c${String(tag)} %c(updated @ ${tag.updatedAt()})`,
          'font-weight: normal; color: #999;',
          'font-weight: normal; color: #959;',
          'font-weight: normal; font-style: italic; color: #595',
        ];
      }

      // eslint-disable-next-line no-inner-declarations
      function leafSubtags(tags: TagDebug[]): TagDebug[] {
        return tags.flatMap((tag) => {
          if (tag.delegate) {
            return leafSubtags([tag.delegate]);
          } else if (tag.subtags) {
            return leafSubtags(tag.subtags);
          } else {
            return [tag];
          }
        });
      }
    }

    CURRENT_TRACKER.add(tag);
  }
}

//////////

const CACHE_KEY = Symbol('CACHE_KEY');

// public interface
export interface Cache<T = unknown> {
  [CACHE_KEY]: T;
}

// `Cache` is a global in browsers so it works poorly with auto-import.
export type TrackedCache<T = unknown> = Cache<T>;

const FN = Symbol('FN');
const LAST_VALUE = Symbol('LAST_VALUE');
const TAG = Symbol('TAG');
const SNAPSHOT = Symbol('SNAPSHOT');
const DEBUG_LABEL = Symbol('DEBUG_LABEL');

interface CacheDebug {
  label: string;
  tag: TagDebug;
  id: number;
}

let id = 0;

interface InternalCache<T = unknown> {
  [FN]: (...args: unknown[]) => T;
  [LAST_VALUE]: T | undefined;
  [TAG]: Tag | undefined;
  [SNAPSHOT]: Revision;
  [DEBUG_LABEL]?: string | false | undefined;
  debug?: CacheDebug;
}

export function createCache<T>(fn: () => T, debuggingLabel?: string | false): Cache<T> {
  if (import.meta.env.DEV && !(typeof fn === 'function')) {
    throw new Error(
      `createCache() must be passed a function as its first parameter. Called with: ${String(fn)}`
    );
  }

  let cache: InternalCache<T> = {
    [FN]: fn,
    [LAST_VALUE]: undefined,
    [TAG]: undefined,
    [SNAPSHOT]: -1,
  };

  if (import.meta.env.DEV) {
    cache[DEBUG_LABEL] = debuggingLabel;

    let cacheId = ++id;

    Reflect.defineProperty(cache, 'debug', {
      configurable: true,
      value: {
        label: debuggingLabel || 'cache',
        id: cacheId,
        get tag(): TagDebug {
          return unwrapDebug(cache[TAG]?.debug);
        },
      } satisfies CacheDebug,
    });

    Reflect.defineProperty(cache, Symbol.toStringTag, {
      configurable: true,
      value: 'TrackedCache',
    });

    Reflect.defineProperty(cache, 'toString', {
      configurable: true,
      value: () => {
        return debuggingLabel ? `{cache ${debuggingLabel} id=${cacheId}}` : `{cache id=${cacheId}}`;
      },
    });

    if (LOCAL_SHOULD_LOG_TRACES) {
      LOCAL_LOGGER.groupCollapsed(
        `%cnew cache %c${cache}`,
        `color: #999; font-weight: normal`,
        `color: #959; font-weight: normal`
      );
      LOCAL_LOGGER.trace();
      LOCAL_LOGGER.groupEnd();
    }
  }

  return cache as unknown as Cache<T>;
}

export function getValue<T>(cache: Cache<T>): T {
  assertCache(cache, 'getValue');

  let fn = cache[FN];
  let tag = cache[TAG];
  let snapshot = cache[SNAPSHOT];

  if (tag === undefined || !validateTag(tag, snapshot)) {
    if (import.meta.env.DEV) {
      beginTrackFrame(cache.debug?.label || 'getValue');
    } else {
      beginTrackFrame();
    }

    try {
      cache[LAST_VALUE] = fn();
    } finally {
      tag = endTrackFrame();
      cache[TAG] = tag;
      cache[SNAPSHOT] = valueForTag(tag);
      consumeTag(tag);
    }
  } else {
    consumeTag(tag);
  }

  // TODO [2023/05/24] replace the `!` with unwrap() once the current refactor is done
  return cache[LAST_VALUE]!;
}

export function isConst(cache: Cache): boolean {
  assertCache(cache, 'isConst');

  let tag = cache[TAG];

  assertTag(tag, cache);

  return isConstTag(tag);
}

function assertCache<T>(
  value: Cache<T> | InternalCache<T>,
  fnName: string
): asserts value is InternalCache<T> {
  if (import.meta.env.DEV && !(typeof value === 'object' && value !== null && FN in value)) {
    throw new Error(
      `${fnName}() can only be used on an instance of a cache created with createCache(). Called with: ${String(
        value
      )}`
    );
  }
}

// replace this with `expect` when we can
function assertTag(tag: Tag | undefined, cache: InternalCache): asserts tag is Tag {
  if (import.meta.env.DEV && tag === undefined) {
    throw new Error(
      `isConst() can only be used on a cache once getValue() has been called at least once. Called with cache function:\n\n${String(
        cache[FN]
      )}`
    );
  }
}

export function getTaggedValue<T>(cache: TrackedCache<T>): [value: T, tag: Tag] {
  if (import.meta.env.DEV) {
    beginTrackFrame((cache as InternalCache).debug?.label || 'getTaggedValue');
  } else {
    beginTrackFrame();
  }

  let tag: Tag;
  let value: T;

  try {
    value = getValue(cache);
  } finally {
    tag = endTrackFrame();
  }

  return [value, tag];
}

//////////

// Legacy tracking APIs

// track() shouldn't be necessary at all in the VM once the autotracking
// refactors are merged, and we should generally be moving away from it. It may
// be necessary in Ember for a while longer, but I think we'll be able to drop
// it in favor of cache sooner rather than later.
export function track(block: () => void, debugLabel?: string | false): Tag {
  beginTrackFrame(debugLabel);

  let tag;

  try {
    block();
  } finally {
    tag = endTrackFrame();
  }

  return tag;
}

// untrack() is currently mainly used to handle places that were previously not
// tracked, and that tracking now would cause backtracking rerender assertions.
// I think once we move everyone forward onto modern APIs, we'll probably be
// able to remove it, but I'm not sure yet.
export function untrack<T>(callback: () => T): T {
  beginUntrackFrame();

  try {
    return callback();
  } finally {
    endUntrackFrame();
  }
}
