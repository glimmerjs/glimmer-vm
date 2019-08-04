import { Slice, LinkedListNode, assert } from '@glimmer/util';
import { DEBUG } from '@glimmer/local-debug-flags';

//////////

// utils
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((
  k: infer I
) => void)
  ? I
  : never;

const symbol =
  typeof Symbol !== 'undefined'
    ? Symbol
    : (key: string) => `__${key}${Math.floor(Math.random() * Date.now())}__` as any;

//////////

export type Revision = number;

export const CONSTANT: Revision = 0;
export const INITIAL: Revision = 1;
export const VOLATILE: Revision = 9007199254740991; // MAX_INT

let $REVISION = INITIAL;

export function bump() {
  $REVISION++;
}

//////////

export const VALUE: unique symbol = symbol('TAG_VALUE');
export const VALIDATE: unique symbol = symbol('TAG_VALIDATE');
export const COMPUTE: unique symbol = symbol('TAG_COMPUTE');

export interface EntityTag<T> {
  [VALUE](): T;
  [VALIDATE](snapshot: T): boolean;
}

export interface Tag extends EntityTag<Revision> {
  [COMPUTE](): Revision;
}

export interface EntityTagged<T> {
  tag: EntityTag<T>;
}

export interface Tagged {
  tag: Tag;
}

//////////

export function value(tag: Tag) {
  return tag[VALUE]();
}

export function validate(tag: Tag, snapshot: Revision) {
  return tag[VALIDATE](snapshot);
}

//////////

/**
 * This enum represents all of the possible tag types for the monomorphic tag class.
 * Other custom tag classes can exist, such as CurrentTag and VolatileTag, but for
 * performance reasons, any type of tag that is meant to be used frequently should
 * be added to the monomorphic tag.
 */
const enum MonomorphicTagTypes {
  Dirtyable,
  Updatable,
  Combinator,
  Constant,
}

const DIRTY: unique symbol = symbol('TAG_DIRTY');
const UPDATE: unique symbol = symbol('TAG_UPDATE');

const TYPE: unique symbol = symbol('TAG_TYPE');
const UPDATE_SUBTAGS: unique symbol = symbol('TAG_UPDATE_SUBTAGS');

interface MonomorphicTagBase<T extends MonomorphicTagTypes> extends Tag {
  [TYPE]: T;
}

export interface DirtyableTag extends MonomorphicTagBase<MonomorphicTagTypes.Dirtyable> {
  [DIRTY](): void;
}

export interface UpdatableTag extends MonomorphicTagBase<MonomorphicTagTypes.Updatable> {
  [DIRTY](): void;
  [UPDATE](tag: Tag): void;
}

export interface CombinatorTag extends MonomorphicTagBase<MonomorphicTagTypes.Combinator> {}
export interface ConstantTag extends MonomorphicTagBase<MonomorphicTagTypes.Constant> {}

interface MonomorphicTagMapping {
  [MonomorphicTagTypes.Dirtyable]: DirtyableTag;
  [MonomorphicTagTypes.Updatable]: UpdatableTag;
  [MonomorphicTagTypes.Combinator]: CombinatorTag;
  [MonomorphicTagTypes.Constant]: ConstantTag;
}

type MonomorphicTag = UnionToIntersection<MonomorphicTagMapping[MonomorphicTagTypes]>;
type MonomorphicTagType = UnionToIntersection<MonomorphicTagTypes>;

export class MonomorphicTagImpl implements MonomorphicTag {
  private revision: Revision = INITIAL;
  protected lastChecked: Revision = INITIAL;
  protected lastValue: Revision = INITIAL;

  private isUpdating = false;
  private subtag: Tag | null = null;
  private subtags: Tag[] | null = null;

  [TYPE]: MonomorphicTagType;

  constructor(type: MonomorphicTagType) {
    this[TYPE] = type;
  }

  [VALIDATE](snapshot: Revision): boolean {
    return snapshot >= this[COMPUTE]();
  }

  [VALUE]() {
    return $REVISION;
  }

  [COMPUTE](): Revision {
    let { lastChecked } = this;

    if (lastChecked !== $REVISION) {
      this.isUpdating = true;
      this.lastChecked = $REVISION;

      try {
        let { subtags, subtag, revision } = this;

        if (subtag !== null) {
          revision = Math.max(revision, subtag[COMPUTE]());
        }

        if (subtags !== null) {
          for (let i = 0; i < subtags.length; i++) {
            let value = subtags[i][COMPUTE]();
            revision = Math.max(value, revision);
          }
        }

        this.lastValue = revision;
      } finally {
        this.isUpdating = false;
      }
    }

    if (this.isUpdating) {
      this.lastChecked = ++$REVISION;
    }

    return this.lastValue;
  }

  [UPDATE](tag: Tag) {
    if (DEBUG) {
      assert(
        this[TYPE] === MonomorphicTagTypes.Updatable,
        'Attempted to update a tag that was not updatable'
      );
    }

    if (tag === CONSTANT_TAG) {
      this.subtag = null;
    } else {
      this.subtag = tag;

      if (tag instanceof MonomorphicTagImpl) {
        this.lastChecked = Math.min(this.lastChecked, tag.lastChecked);
        this.lastValue = Math.max(this.lastValue, tag.lastValue);
      } else {
        this.lastChecked = INITIAL;
      }
    }
  }

  [UPDATE_SUBTAGS](tags: Tag[]) {
    this.subtags = tags;
  }

  [DIRTY]() {
    if (DEBUG) {
      assert(
        this[TYPE] === MonomorphicTagTypes.Updatable ||
          this[TYPE] === MonomorphicTagTypes.Dirtyable,
        'Attempted to dirty a tag that was not dirtyable'
      );
    }

    this.revision = ++$REVISION;
  }
}

function _createTag<T extends MonomorphicTagTypes>(type: T): MonomorphicTagMapping[T] {
  return new MonomorphicTagImpl(type as MonomorphicTagType);
}

//////////

export function createTag() {
  return _createTag(MonomorphicTagTypes.Dirtyable);
}

export function createUpdatableTag() {
  return _createTag(MonomorphicTagTypes.Updatable);
}

export function dirty(tag: DirtyableTag | UpdatableTag) {
  tag[DIRTY]();
}

export function update(tag: UpdatableTag, subtag: Tag) {
  tag[UPDATE](subtag);
}

//////////

export const CONSTANT_TAG = _createTag(MonomorphicTagTypes.Constant);

export function isConst({ tag }: Tagged): boolean {
  return tag === CONSTANT_TAG;
}

export function isConstTag(tag: Tag): boolean {
  return tag === CONSTANT_TAG;
}

//////////

class VolatileTag implements Tag {
  [VALUE]() {
    return VOLATILE;
  }

  [COMPUTE]() {
    return VOLATILE;
  }

  [VALIDATE](snapshot: Revision) {
    return snapshot <= VOLATILE;
  }
}

export const VOLATILE_TAG = new VolatileTag();

//////////

class CurrentTag implements CurrentTag {
  [VALUE]() {
    return $REVISION;
  }

  [COMPUTE]() {
    return $REVISION;
  }

  [VALIDATE](snapshot: Revision) {
    return snapshot === $REVISION;
  }
}

export const CURRENT_TAG = new CurrentTag();

//////////

export function combineTagged(tagged: ReadonlyArray<Tagged>): Tag {
  let optimized: Tag[] = [];

  for (let i = 0, l = tagged.length; i < l; i++) {
    let tag = tagged[i].tag;
    if (tag === CONSTANT_TAG) continue;
    optimized.push(tag);
  }

  return _combine(optimized);
}

export function combineSlice(slice: Slice<Tagged & LinkedListNode>): Tag {
  let optimized: Tag[] = [];

  let node = slice.head();

  while (node !== null) {
    let tag = node.tag;

    if (tag !== CONSTANT_TAG) optimized.push(tag);

    node = slice.nextNode(node);
  }

  return _combine(optimized);
}

export function combine(tags: Tag[]): Tag {
  let optimized: Tag[] = [];

  for (let i = 0, l = tags.length; i < l; i++) {
    let tag = tags[i];
    if (tag === CONSTANT_TAG) continue;
    optimized.push(tag);
  }

  return _combine(optimized);
}

function _combine(tags: Tag[]): Tag {
  switch (tags.length) {
    case 0:
      return CONSTANT_TAG;
    case 1:
      return tags[0];
    default:
      let tag = _createTag(MonomorphicTagTypes.Combinator);
      tag[UPDATE_SUBTAGS](tags);
      return tag;
  }
}
