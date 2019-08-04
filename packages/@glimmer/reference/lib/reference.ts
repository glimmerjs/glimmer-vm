import { Opaque, Option } from '@glimmer/util';
import { Revision, Tag, Tagged, value, validate } from './validators';

export interface Reference<T> {
  value(): T;
}

export default Reference;

export interface PathReference<T> extends Reference<T> {
  get(key: string): PathReference<Opaque>;
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

    if (lastRevision === null || !validate(tag, lastRevision)) {
      lastValue = this.lastValue = this.compute();
      this.lastRevision = value(tag);
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

    if (validate(tag, lastRevision as number)) return NOT_MODIFIED;
    this.lastRevision = value(tag);

    let { lastValue } = this;
    let currentValue = reference.value();
    if (currentValue === lastValue) return NOT_MODIFIED;
    this.lastValue = currentValue;

    return currentValue;
  }

  private initialize(): T {
    let { reference } = this;

    let currentValue = (this.lastValue = reference.value());
    this.lastRevision = value(reference.tag);
    this.initialized = true;

    return currentValue;
  }
}

export type Validation<T> = T | NotModified;

export type NotModified = 'adb3b78e-3d22-4e4b-877a-6317c2c5c145';

const NOT_MODIFIED: NotModified = 'adb3b78e-3d22-4e4b-877a-6317c2c5c145';

export function isModified<T>(value: Validation<T>): value is T {
  return value !== NOT_MODIFIED;
}
