import type {
  CombinatorTagId,
  ConstantTagId,
  DirtyableTagId,
  InitialRevision,
  Revision,
  Tag,
  TagId,
  TagTypeSymbol,
  UpdatableTagId,
} from '@glimmer/state';
import { assert, unwrap } from '@glimmer/debug-util';
import { context } from '@glimmer/global-context';
import state from '@glimmer/state';

import { bump, now } from './timestamp';
import { getTrackingDebug } from './tracking';

const TYPE: TagTypeSymbol = state.TYPE;

const DIRYTABLE_TAG_ID: DirtyableTagId = 0;
const UPDATABLE_TAG_ID: UpdatableTagId = 1;
const COMBINATOR_TAG_ID: CombinatorTagId = 2;
const CONSTANT_TAG_ID: ConstantTagId = 3;

export interface TagImpl<T extends TagId> extends Tag<T> {
  [TYPE]: T;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TagImpl<const T extends TagId> implements Tag<T> {
  static value(this: void, tag: Tag): Revision {
    return compute(tag as unknown as TagImpl<TagId>);
  }

  /**
   * `validate` receives a tag and a snapshot from a previous call to `value` with
   * the same tag, and determines if the tag is still valid compared to the
   * snapshot. If the tag's state has changed at all since then, `validate` will
   * return false, otherwise it will return true. This is used to determine if a
   * calculation related to the tags should be rerun.
   */
  static validate(this: void, tag: Tag, snapshot: Revision): boolean {
    return snapshot >= compute(tag as unknown as TagImpl<TagId>);
  }

  revision: Revision = 1 satisfies InitialRevision;
  lastChecked: Revision = 1 satisfies InitialRevision;
  lastValue: Revision = 1 satisfies InitialRevision;

  isUpdating = false;
  public subtag: Tag | Tag[] | null = null;
  subtagBufferCache: Revision | null = null;
  compute: undefined | ((this: void) => Revision);

  constructor(type: T, compute?: () => Revision) {
    this[TYPE] = type;
    this.compute = compute;
  }

  static update(this: void, _tag: Tag<UpdatableTagId>, _subtag: Tag): void {
    assert(_tag[TYPE] === UPDATABLE_TAG_ID, `Attempted to update a tag that was not updatable`);

    // TODO: TS 3.7 should allow us to do this via assertion
    let tag = _tag as TagImpl<UpdatableTagId>;
    let subtag = _subtag as TagImpl<TagId>;

    if (subtag === CONSTANT_TAG || isConstTag(subtag)) {
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
      tag.subtagBufferCache = compute(subtag);
      tag.subtag = subtag;
    }
  }

  static dirtyTag(
    this: void,
    tag: Tag<DirtyableTagId> | Tag<UpdatableTagId>,
    disableConsumptionAssertion?: boolean
  ): void {
    if (
      import.meta.env.DEV &&
      !(tag[TYPE] === UPDATABLE_TAG_ID || tag[TYPE] === DIRYTABLE_TAG_ID)
    ) {
      throw new Error('Attempted to dirty a tag that was not dirtyable');
    }

    if (import.meta.env.DEV && disableConsumptionAssertion !== true) {
      // Usually by this point, we've already asserted with better error information,
      // but this is our last line of defense.
      getTrackingDebug?.()?.assertTagNotConsumed(tag);
    }

    (tag as TagImpl<TagId>).revision = bump();

    context().scheduleRevalidate();
  }
}

function compute(tag: TagImpl<TagId>): Revision {
  if (tag.compute) {
    return tag.compute();
  }

  let { lastChecked } = tag;

  if (tag.isUpdating === true) {
    if (import.meta.env.DEV && !unwrap(state.debug).cycleMap.has(tag)) {
      throw new Error('Cycles in tags are not allowed');
    }

    tag.lastChecked = bump();
  } else if (lastChecked !== now()) {
    tag.isUpdating = true;
    tag.lastChecked = now();

    try {
      let { subtag, revision } = tag;

      if (subtag !== null) {
        if (Array.isArray(subtag)) {
          for (const tag of subtag as TagImpl<TagId>[]) {
            let value = compute(tag);
            revision = Math.max(value, revision);
          }
        } else {
          let subtagValue = compute(subtag as TagImpl<TagId>);

          if (subtagValue === tag.subtagBufferCache) {
            revision = Math.max(revision, tag.lastValue);
          } else {
            // Clear the temporary buffer cache
            tag.subtagBufferCache = null;
            revision = Math.max(revision, subtagValue);
          }
        }
      }

      tag.lastValue = revision;
    } finally {
      tag.isUpdating = false;
    }
  }

  return tag.lastValue;
}

export const CONSTANT_TAG: Tag<ConstantTagId> = new TagImpl(CONSTANT_TAG_ID);

export const combineTags = (tags: Tag[]): Tag => {
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
};

/**
 * `valueForTag` receives a tag and returns an opaque Revision based on that tag. This
 * snapshot can then later be passed to `validate` with the same tag to
 * determine if the tag has changed at all since the time that `value` was
 * called.
 */
export const valueForTag: (tag: Tag) => Revision = TagImpl.value;
export const validateTag: (tag: Tag, snapshot: Revision) => boolean = TagImpl.validate;
export const dirtyTag: (
  tag: Tag<DirtyableTagId> | Tag<UpdatableTagId>,
  disableConsumptionAssertion?: boolean
) => void = TagImpl.dirtyTag;

export const isTag = (value: unknown): value is Tag => {
  return !!(value && TYPE in (value as object));
};

export const isConstTag = (value: Tag | null): value is Tag<ConstantTagId> => {
  return value?.[TYPE] === CONSTANT_TAG_ID;
};
