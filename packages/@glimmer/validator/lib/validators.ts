import { scheduleRevalidate } from '@glimmer/global-context';
import type {
  COMBINATOR_TAG_ID as ICOMBINATOR_TAG_ID,
  CONSTANT_TAG_ID as ICONSTANT_TAG_ID,
  ConstantTag,
  CURRENT_TAG_ID as ICURRENT_TAG_ID,
  DIRTYABLE_TAG_ID as IDIRTYABLE_TAG_ID,
  DirtyableTag,
  MonomorphicTagTypeId,
  Tag,
  TagComputeSymbol,
  TagTypeSymbol,
  UPDATABLE_TAG_ID as IUPDATABLE_TAG_ID,
  UpdatableTag,
  VOLATILE_TAG_ID as IVOLATILE_TAG_ID,
  TagDebug,
} from '@glimmer/interfaces';

import { debug } from './debug';
import { unwrap } from './utils';
import { LOCAL_SHOULD_LOG_TRACES, LOCAL_SHOULD_LOG_TRACKING } from '@glimmer/local-debug-flags';
import { LOCAL_LOGGER } from '@glimmer/util';

//////////

export type Revision = number;

export const CONSTANT: Revision = 0;
export const INITIAL: Revision = 1;
export const VOLATILE: Revision = Number.NaN;

export let $REVISION = INITIAL;

export function bump(tag?: TagDebug): Revision {
  if (import.meta.env.DEV && LOCAL_SHOULD_LOG_TRACES && tag) {
    {
      // eslint-disable-next-line no-console
      console.groupCollapsed(
        `%cbumped %c${tag} %c→ %c${$REVISION + 1}`,
        'font-weight: normal; color: #999',
        'font-weight: normal; color: #959',
        'font-weight: normal; color: #999',
        'font-weight: normal; color: #595'
      );
      // eslint-disable-next-line no-console
      console.trace();
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
  }
  return ++$REVISION;
}

export function now(): Revision {
  return $REVISION;
}

//////////

const DIRYTABLE_TAG_ID: IDIRTYABLE_TAG_ID = 0;
const UPDATABLE_TAG_ID: IUPDATABLE_TAG_ID = 1;
const COMBINATOR_TAG_ID: ICOMBINATOR_TAG_ID = 2;
const CONSTANT_TAG_ID: ICONSTANT_TAG_ID = 3;
type TagTypeId = IDIRTYABLE_TAG_ID | IUPDATABLE_TAG_ID | ICOMBINATOR_TAG_ID | ICONSTANT_TAG_ID;

//////////

export const COMPUTE: TagComputeSymbol = Symbol('TAG_COMPUTE') as TagComputeSymbol;

//////////

/**
 * `value` receives a tag and returns an opaque Revision based on that tag. This
 * snapshot can then later be passed to `validate` with the same tag to
 * determine if the tag has changed at all since the time that `value` was
 * called.
 *
 * @param tag
 */
export function valueForTag(tag: Tag): Revision {
  return tag[COMPUTE]();
}

/**
 * `validate` receives a tag and a snapshot from a previous call to `value` with
 * the same tag, and determines if the tag is still valid compared to the
 * snapshot. If the tag's state has changed at all since then, `validate` will
 * return false, otherwise it will return true. This is used to determine if a
 * calculation related to the tags should be rerun.
 *
 * @param tag
 * @param snapshot
 */
export function validateTag(tag: Tag, snapshot: Revision): boolean {
  if (import.meta.env.DEV && LOCAL_SHOULD_LOG_TRACKING) {
    let subtags = tag.debug?.subtags;
    let header = [
      `%cvalidate %c${tag} %c@ %c${snapshot} %c→ ${snapshot >= tag[COMPUTE]() ? 'fresh' : 'stale'}`,
      'font-weight: normal; color: #999',
      'font-weight: normal; color: #959',
      'font-weight: normal; color: #999',
      'font-weight: normal; color: #595',
      'font-weight: normal; color: #599',
    ];

    if (subtags) {
      LOCAL_LOGGER.groupCollapsed(...header);
      for (let subtag of subtags) {
        LOCAL_LOGGER.log(
          `%c%c${String(subtag)} %c(updated @ ${subtag.updatedAt})`,
          'font-weight: normal; color: #999;',
          'font-weight: normal; color: #959;',
          'font-weight: normal; font-style: italic; color: #595'
        );
      }
      LOCAL_LOGGER.groupEnd();
    } else {
      LOCAL_LOGGER.log(...header);
    }
  }

  return snapshot >= tag[COMPUTE]();
}

//////////

const TYPE: TagTypeSymbol = Symbol('TAG_TYPE') as TagTypeSymbol;

// this is basically a const
export let ALLOW_CYCLES: WeakMap<Tag, boolean> | undefined;

if (import.meta.env.DEV) {
  ALLOW_CYCLES = new WeakMap();
}

function allowsCycles(tag: Tag): boolean {
  return ALLOW_CYCLES === undefined ? true : ALLOW_CYCLES.has(tag);
}

let id = 0;

class MonomorphicTagImpl<T extends MonomorphicTagTypeId = MonomorphicTagTypeId> implements Tag {
  static combine(this: void, tags: Tag[], name?: string): Tag {
    switch (tags.length) {
      case 0:
        return CONSTANT_TAG;
      case 1:
        return tags[0] as Tag;
      default: {
        let tag: MonomorphicTagImpl = new MonomorphicTagImpl(COMBINATOR_TAG_ID, name);
        tag.subtag = tags;
        return tag;
      }
    }
  }

  static updateTag(this: void, _tag: UpdatableTag, _subtag: Tag) {
    if (import.meta.env.DEV && _tag[TYPE] !== UPDATABLE_TAG_ID) {
      throw new Error('Attempted to update a tag that was not updatable');
    }

    // TODO: TS 3.7 should allow us to do this via assertion
    let tag = _tag as MonomorphicTagImpl;
    let subtag = _subtag as MonomorphicTagImpl;

    if (subtag === CONSTANT_TAG) {
      tag.subtag = null;
    } else {
      // There are two different possibilities when updating a subtag:
      //
      // 1. subtag[COMPUTE]() <= tag[COMPUTE]();
      // 2. subtag[COMPUTE]() > tag[COMPUTE]();
      //
      // The first possibility is completely fine within our caching model, but
      // the second possibility presents a problem. If the parent tag has
      // already been read, then it's value is cached and will not update to
      // reflect the subtag's greater value. Next time the cache is busted, the
      // subtag's value _will_ be read, and it's value will be _greater_ than
      // the saved snapshot of the parent, causing the resulting calculation to
      // be rerun erroneously.
      //
      // In order to prevent this, when we first update to a new subtag we store
      // its computed value, and then check against that computed value on
      // subsequent updates. If its value hasn't changed, then we return the
      // parent's previous value. Once the subtag changes for the first time,
      // we clear the cache and everything is finally in sync with the parent.
      tag.subtagBufferCache = subtag[COMPUTE]();
      tag.subtag = subtag;
    }
  }

  static dirtyTag(
    this: void,
    tag: DirtyableTag | UpdatableTag,
    disableConsumptionAssertion?: boolean
  ) {
    if (
      import.meta.env.DEV &&
      !(tag[TYPE] === UPDATABLE_TAG_ID || tag[TYPE] === DIRYTABLE_TAG_ID)
    ) {
      throw new Error('Attempted to dirty a tag that was not dirtyable');
    }

    if (import.meta.env.DEV && disableConsumptionAssertion !== true) {
      // Usually by this point, we've already asserted with better error information,
      // but this is our last line of defense.
      unwrap(debug.assertTagNotConsumed)(tag);
    }

    (tag as MonomorphicTagImpl).revision = import.meta.env.DEV ? bump(tag.debug) : bump();

    scheduleRevalidate();
  }

  private revision = INITIAL;
  private lastChecked = INITIAL;
  private lastValue = INITIAL;
  readonly id = id++;

  private isUpdating = false;
  public subtag: Tag | Tag[] | null = null;
  private subtagBufferCache: Revision | null = null;

  [TYPE]: T;
  declare readonly debug?: TagDebug;

  constructor(type: T, name?: string) {
    this[TYPE] = type;

    if (import.meta.env.DEV) installDebugInfo(name, this, type);
  }

  [COMPUTE](): Revision {
    let { lastChecked } = this;

    if (this.isUpdating === true) {
      if (import.meta.env.DEV && !allowsCycles(this)) {
        throw new Error('Cycles in tags are not allowed');
      }

      this.lastChecked = bump(this.debug);
    } else if (lastChecked !== now()) {
      this.isUpdating = true;
      this.lastChecked = now();

      try {
        let { subtag, revision } = this;

        if (subtag !== null) {
          if (Array.isArray(subtag)) {
            for (let tag of subtag) {
              let value = tag[COMPUTE]();
              revision = Math.max(value, revision);
            }
          } else {
            let subtagValue = subtag[COMPUTE]();

            if (subtagValue === this.subtagBufferCache) {
              revision = Math.max(revision, this.lastValue);
            } else {
              // Clear the temporary buffer cache
              this.subtagBufferCache = null;
              revision = Math.max(revision, subtagValue);
            }
          }
        }

        this.lastValue = revision;
      } finally {
        this.isUpdating = false;
      }
    }

    return this.lastValue;
  }
}

export const DIRTY_TAG = MonomorphicTagImpl.dirtyTag;
export const UPDATE_TAG = MonomorphicTagImpl.updateTag;

//////////

export function createTag(name?: string): DirtyableTag {
  return new MonomorphicTagImpl(DIRYTABLE_TAG_ID, name);
}

export function createUpdatableTag(name?: string): UpdatableTag {
  return new MonomorphicTagImpl(UPDATABLE_TAG_ID, name);
}

//////////

export const CONSTANT_TAG: ConstantTag = new MonomorphicTagImpl(CONSTANT_TAG_ID);

export function isConstTag(tag: Tag): tag is ConstantTag {
  return tag === CONSTANT_TAG;
}

//////////

const VOLATILE_TAG_ID: IVOLATILE_TAG_ID = 100;

export class VolatileTag implements Tag {
  readonly [TYPE] = VOLATILE_TAG_ID;
  readonly id = id++;

  constructor(name?: string) {
    if (import.meta.env.DEV) installDebugInfo(name, this);
  }

  [COMPUTE](): Revision {
    return VOLATILE;
  }
}

export const VOLATILE_TAG = new VolatileTag();

//////////

const CURRENT_TAG_ID: ICURRENT_TAG_ID = 101;

export class CurrentTag implements Tag {
  readonly [TYPE] = CURRENT_TAG_ID;
  readonly id = id++;

  constructor(name?: string) {
    if (import.meta.env.DEV) installDebugInfo(name, this);
  }

  [COMPUTE](): Revision {
    return $REVISION;
  }
}

export const CURRENT_TAG = new CurrentTag();

//////////

function installDebugInfo(
  specifiedName: string | undefined,
  target: object & Partial<{ name: string }>,
  type: TagTypeId | string = target.name ?? 'Tag'
): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-inner-declarations
    function getTagName(): string {
      if (typeof type === 'string') {
        return type;
      }

      switch (type) {
        case UPDATABLE_TAG_ID:
          return 'UpdatableTag';
        case DIRYTABLE_TAG_ID:
          return 'DirtyableTag';
        case CONSTANT_TAG_ID:
          return 'ConstantTag';
        case COMBINATOR_TAG_ID:
          return 'CombinatorTag';
      }
    }

    let tagName = getTagName();

    Reflect.defineProperty(target, 'toString', {
      configurable: true,
      value: function (this: Tag): string {
        return specifiedName ? `{${specifiedName} id=${this.id}}` : `{${tagName} id=${this.id}}`;
      },
    });
    Reflect.defineProperty(target, Symbol.toStringTag, {
      configurable: true,
      value: tagName,
    });
    Reflect.defineProperty(target, 'debug', {
      configurable: true,
      get: function (this: Tag): TagDebug {
        // eslint-disable-next-line prefer-let/prefer-let
        const subtag = this.subtag;

        let debug = {
          type: this[TYPE],
          id: this.id,
          updatedAt: () => this[COMPUTE](),
          toString: () => {
            return String(this);
          },
        };

        if (Array.isArray(subtag)) {
          Object.defineProperty(debug, 'subtags', {
            configurable: true,
            get: () => {
              return subtag.map((tag) => unwrap(tag.debug));
            },
          });
        } else if (subtag) {
          Object.defineProperty(debug, 'subtag', {
            configurable: true,
            get: () => unwrap(subtag.debug),
          });
        }

        return debug;
      },
    });

    if (LOCAL_SHOULD_LOG_TRACES) {
      LOCAL_LOGGER.groupCollapsed(
        `%ccreated %c${target}`,
        'font-weight: normal; color: #999',
        'font-weight: normal; color: #959'
      );
      LOCAL_LOGGER.trace();
      LOCAL_LOGGER.groupEnd();
    }
  }
}

//////////

export const combine = MonomorphicTagImpl.combine;

// Warm

let tag1 = createUpdatableTag();
let tag2 = createUpdatableTag();
let tag3 = createUpdatableTag();

valueForTag(tag1);
DIRTY_TAG(tag1);
valueForTag(tag1);
UPDATE_TAG(tag1, combine([tag2, tag3]));
valueForTag(tag1);
DIRTY_TAG(tag2);
valueForTag(tag1);
DIRTY_TAG(tag3);
valueForTag(tag1);
UPDATE_TAG(tag1, tag3);
valueForTag(tag1);
DIRTY_TAG(tag3);
valueForTag(tag1);
