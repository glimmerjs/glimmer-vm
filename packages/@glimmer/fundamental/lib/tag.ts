import type {
  CombinatorTagId,
  ConstantTag,
  ConstantTagId,
  DirtyableTag,
  DirtyableTagId,
  Tag,
  TagComputeSymbol,
  TagId,
  TagTypeSymbol,
  UpdatableTag,
  UpdatableTagId,
} from '@glimmer/interfaces';
import { assert, unwrap } from '@glimmer/debug-util';
import { scheduleRevalidate } from '@glimmer/global-context';

import type { Revision } from './timestamp';

import { allowsCycles, debug } from './debug';
import { bump, INITIAL, now } from './timestamp';

const DIRYTABLE_TAG_ID: DirtyableTagId = 0;
const UPDATABLE_TAG_ID: UpdatableTagId = 1;
const COMBINATOR_TAG_ID: CombinatorTagId = 2;
const CONSTANT_TAG_ID: ConstantTagId = 3;

const TYPE: TagTypeSymbol = Symbol('TAG_TYPE') as TagTypeSymbol;
export const COMPUTE: TagComputeSymbol = Symbol('TAG_COMPUTE') as TagComputeSymbol;

export class TagImpl<const T extends TagId> implements Tag<T> {
  static value(this: void, tag: Tag): Revision {
    return tag[COMPUTE]();
  }

  static is(this: void, value: unknown): value is Tag {
    return value instanceof TagImpl;
  }

  static isConst(this: void, value: Tag): value is Tag<ConstantTagId> {
    return value[TYPE] === CONSTANT_TAG_ID;
  }

  /**
   * `validate` receives a tag and a snapshot from a previous call to `value` with
   * the same tag, and determines if the tag is still valid compared to the
   * snapshot. If the tag's state has changed at all since then, `validate` will
   * return false, otherwise it will return true. This is used to determine if a
   * calculation related to the tags should be rerun.
   */
  static validate(this: void, tag: Tag, snapshot: Revision): boolean {
    return snapshot >= tag[COMPUTE]();
  }

  static combine(this: void, tags: Tag[]): Tag {
    switch (tags.length) {
      case 0:
        return CONSTANT_TAG;
      case 1:
        return tags[0] as Tag;
      default: {
        let tag = new TagImpl(COMBINATOR_TAG_ID);
        tag.subtag = tags;
        return tag;
      }
    }
  }

  private revision = INITIAL;
  private lastChecked = INITIAL;
  private lastValue = INITIAL;

  private isUpdating = false;
  public subtag: Tag | Tag[] | null = null;
  private subtagBufferCache: Revision | null = null;
  private compute: undefined | ((this: void) => Revision);

  [TYPE]: T;

  constructor(type: T, compute?: () => Revision) {
    this[TYPE] = type;
    this.compute = compute;
  }

  [COMPUTE](): Revision {
    if (this.compute) {
      return this.compute();
    }

    let { lastChecked } = this;

    if (this.isUpdating === true) {
      if (import.meta.env.DEV && !allowsCycles(this)) {
        throw new Error('Cycles in tags are not allowed');
      }

      this.lastChecked = bump();
    } else if (lastChecked !== now()) {
      this.isUpdating = true;
      this.lastChecked = now();

      try {
        let { subtag, revision } = this;

        if (subtag !== null) {
          if (Array.isArray(subtag)) {
            for (const tag of subtag) {
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

  static update(this: void, _tag: UpdatableTag, _subtag: Tag) {
    assert(_tag[TYPE] === UPDATABLE_TAG_ID, `Attempted to update a tag that was not updatable`);

    // TODO: TS 3.7 should allow us to do this via assertion
    let tag = _tag as TagImpl<UpdatableTagId>;
    let subtag = _subtag as TagImpl<TagId>;

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

    (tag as TagImpl<TagId>).revision = bump();

    scheduleRevalidate();
  }
}

export const CONSTANT_TAG: ConstantTag = new TagImpl(CONSTANT_TAG_ID);
export const combine = TagImpl.combine;

/**
 * `valueForTag` receives a tag and returns an opaque Revision based on that tag. This
 * snapshot can then later be passed to `validate` with the same tag to
 * determine if the tag has changed at all since the time that `value` was
 * called.
 */
export const valueForTag = TagImpl.value;
export const validateTag = TagImpl.validate;
export const dirtyTag = TagImpl.dirtyTag;
export const isTag = TagImpl.is;
export const isConstTag = TagImpl.isConst;
