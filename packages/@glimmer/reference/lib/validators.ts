import Reference, { PathReference } from './reference';
import { Opaque, Option, Slice, LinkedListNode } from '@glimmer/util';

//////////

export interface EntityTag<T> extends Reference<T> {
  validate(snapshot: T): boolean;
}

export interface EntityTagged<T> {
  tag: EntityTag<T>;
}

export interface Tagged {
  tag: Tag;
}

//////////

export type Revision = number;

export const CONSTANT: Revision = 0;
export const INITIAL: Revision = 1;
export const VOLATILE: Revision = NaN;

let $REVISION = INITIAL;

export function bump() {
  $REVISION++;
}

export class Tag implements EntityTag<Revision> {
  revision: Revision = INITIAL;
  lastChecked: Revision = INITIAL;
  lastValue: Revision = INITIAL;

  isUpdating = false;

  subtags: Tag[] | null = null;

  static create(subtag: Tag | null = null) {
    return new this(subtag);
  }

  constructor(private subtag: Tag | null = null) {}

  value() {
    return $REVISION;
  }

  protected compute(): Revision {
    let { lastChecked } = this;

    if (lastChecked !== $REVISION) {
      this.isUpdating = true;
      this.lastChecked = $REVISION;

      try {
        let { subtags, subtag, revision } = this;

        if (subtag !== null) {
          revision = Math.max(revision, subtag.compute());
        }

        if (subtags !== null) {
          for (let i = 0; i < subtags.length; i++) {
            let value = subtags[i].compute();
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

  validate(snapshot: Revision): boolean {
    return snapshot >= this.compute();
  }

  update(tag: Tag) {
    this.subtag = tag === CONSTANT_TAG ? null : tag;
  }

  dirty() {
    this.revision = ++$REVISION;
  }
}

class CurrentTag extends Tag {
  value() {
    return $REVISION;
  }

  compute() {
    return $REVISION;
  }

  validate(snapshot: Revision) {
    return snapshot === $REVISION;
  }
}

export const CONSTANT_TAG = new Tag();
export const CURRENT_TAG = new CurrentTag();

export function isConst({ tag }: Tagged): boolean {
  return tag === CONSTANT_TAG;
}

export function isConstTag(tag: Tag): boolean {
  return tag === CONSTANT_TAG;
}

///

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
      let tag = new Tag();
      tag.subtags = tags;
      return tag;
  }
}

//////////

export interface VersionedReference<T = Opaque> extends Reference<T>, Tagged {}

export interface VersionedPathReference<T = Opaque> extends PathReference<T>, Tagged {
  get(property: string): VersionedPathReference<Opaque>;
}

export abstract class CachedReference<T> implements VersionedReference<T> {
  public abstract tag: Tag;

  private lastRevision: Option<Revision> = null;
  private lastValue: Option<T> = null;

  value(): T {
    let { tag, lastRevision, lastValue } = this;

    if (lastRevision === null || !tag.validate(lastRevision)) {
      lastValue = this.lastValue = this.compute();
      this.lastRevision = tag.value();
    }

    return lastValue as T;
  }

  protected abstract compute(): T;

  protected invalidate() {
    this.lastRevision = null;
  }
}

//////////

export type Mapper<T, U> = (value: T) => U;

class MapperReference<T, U> extends CachedReference<U> {
  public tag: Tag;

  private reference: VersionedReference<T>;
  private mapper: Mapper<T, U>;

  constructor(reference: VersionedReference<T>, mapper: Mapper<T, U>) {
    super();
    this.tag = reference.tag;
    this.reference = reference;
    this.mapper = mapper;
  }

  protected compute(): U {
    let { reference, mapper } = this;
    return mapper(reference.value());
  }
}

export function map<T, U>(
  reference: VersionedReference<T>,
  mapper: Mapper<T, U>
): VersionedReference<U> {
  return new MapperReference<T, U>(reference, mapper);
}

//////////

export class ReferenceCache<T> implements Tagged {
  public tag: Tag;

  private reference: VersionedReference<T>;
  private lastValue: Option<T> = null;
  private lastRevision: Option<Revision> = null;
  private initialized = false;

  constructor(reference: VersionedReference<T>) {
    this.tag = reference.tag;
    this.reference = reference;
  }

  peek(): T {
    if (!this.initialized) {
      return this.initialize();
    }

    return this.lastValue as T;
  }

  revalidate(): Validation<T> {
    if (!this.initialized) {
      return this.initialize();
    }

    let { reference, lastRevision } = this;
    let tag = reference.tag;

    if (tag.validate(lastRevision as number)) return NOT_MODIFIED;
    this.lastRevision = tag.value();

    let { lastValue } = this;
    let value = reference.value();
    if (value === lastValue) return NOT_MODIFIED;
    this.lastValue = value;

    return value;
  }

  private initialize(): T {
    let { reference } = this;

    let value = (this.lastValue = reference.value());
    this.lastRevision = reference.tag.value();
    this.initialized = true;

    return value;
  }
}

export type Validation<T> = T | NotModified;

export type NotModified = 'adb3b78e-3d22-4e4b-877a-6317c2c5c145';

const NOT_MODIFIED: NotModified = 'adb3b78e-3d22-4e4b-877a-6317c2c5c145';

export function isModified<T>(value: Validation<T>): value is T {
  return value !== NOT_MODIFIED;
}
