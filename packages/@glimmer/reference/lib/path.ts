import {
  CONSTANT_TAG,
  UpdatableTag,
  Tag,
  VersionedPathReference as IVersionedPathReference,
  TagWrapper,
  DirtyableTag,
  isConst,
  pair
} from "./validators";
import { Opaque, Option } from "@glimmer/interfaces";

export const UPDATE = "UPDATE [00bf381d-bcd2-4c42-8203-1f34d0707030]";

export interface ObjectModel {
  get(parent: Opaque, key: string): Opaque;
  set(parent: Opaque, key: string, value: Opaque): void;
  tagFor(parent: Opaque, key: string): Tag;
  trackTag(tag: Tag, key: string, reference: IVersionedPathReference<Opaque>): Tag;
}

export abstract class PathReference<Value = Opaque> implements IVersionedPathReference {
  abstract tag: Tag;

  constructor(protected objectModel: ObjectModel) {}

  get(property: string): IVersionedPathReference<Opaque> {
    return prop(this, property, this.objectModel);
  }

  abstract value(): Value;
}

export abstract class CachedPathReference<Value = Opaque> extends PathReference<Value> {
  private lastRevision: number = -1;
  private lastValue: Option<Value> = null;

  constructor(objectModel: ObjectModel) {
    super(objectModel);
  }

  abstract compute(): Value;

  value(): Value {
    let { tag, lastRevision, lastValue } = this;

    if (lastRevision === -1 || !tag.validate(lastRevision)) {
      lastValue = this.lastValue = this.compute();
      this.lastRevision = tag.value();
    }

    return lastValue as Value;
  }
}

export class RootPropertyReference extends CachedPathReference {
  tag: Tag;

  constructor(
    private parentValue: Opaque,
    private property: string,
    objectModel: ObjectModel
  ) {
    super(objectModel);

    this.tag = objectModel.trackTag(objectModel.tagFor(parentValue, property), property, this);
  }

  compute() {
    let { parentValue, property, objectModel } = this;

    return objectModel.get(parentValue, property);
  }

  [UPDATE](value: Opaque): void {
    this.objectModel.set(this.parentValue, this.property, value);
  }
}

export class NestedPropertyReference extends CachedPathReference {
  tag: Tag;

  private parentObjectTag: TagWrapper<UpdatableTag>;

  constructor(
    private parentReference: IVersionedPathReference<Opaque>,
    private property: string,
    objectModel: ObjectModel
  ) {
    super(objectModel);

    let parentReferenceTag = parentReference.tag;
    let parentObjectTag = this.parentObjectTag = UpdatableTag.create(CONSTANT_TAG);

    this.tag = objectModel.trackTag(pair(parentReferenceTag, parentObjectTag), property, this);
  }

  compute(): Opaque {
    let { parentReference, parentObjectTag, property, objectModel } = this;

    let parent = parentReference.value();

    parentObjectTag.inner.update(objectModel.tagFor(parent, property));

    if (typeof parent === 'string' && property === 'length') {
      return (parent as string).length;
    }

    if (parent && typeof parent === 'object') {
      return objectModel.get(parent, property);
    }

    return undefined;
  }

  [UPDATE](value: Opaque): void {
    let parent = this.parentReference.value();
    this.objectModel.set(parent, this.property, value);
  }
}

export function prop(parent: PathReference, key: string, objectModel: ObjectModel): PathReference {
  if (isConst(parent)) {
    return new RootPropertyReference(parent.value(), key, objectModel);
  } else {
    return new NestedPropertyReference(parent, key, objectModel);
  }
}

export class UpdatablePropertyReference extends PathReference {
  tag: TagWrapper<DirtyableTag>;

  constructor(private inner: Opaque, objectModel: ObjectModel) {
    super(objectModel);

    this.tag = DirtyableTag.create();
  }

  value(): Opaque {
    return this.inner;
  }

  update(value: Opaque): void {
    let { inner } = this;

    if (value !== inner) {
      this.tag.inner.dirty();
      this.inner = value;
    }
  }
}

export class DeepConstantReference extends PathReference {
  tag: Tag = CONSTANT_TAG;

  constructor(private inner: Opaque, objectModel: ObjectModel) {
    super(objectModel);
  }

  value(): Opaque {
    return this.inner;
  }

  get(property: string): DeepConstantReference {
    let { inner, objectModel } = this;
    return new DeepConstantReference(objectModel.get(inner, property), objectModel);
  }
}

export type Primitive = undefined | null | boolean | number | string;

export class PrimitiveReference<T extends Primitive> implements IVersionedPathReference<T> {
  static create<T extends Primitive>(value: T): PrimitiveReference<T> {
    if (value === undefined) {
      return UNDEFINED_REFERENCE as PrimitiveReference<T>;
    } else if (value === null) {
      return NULL_REFERENCE as PrimitiveReference<T>;
    } else if (value === true) {
      return TRUE_REFERENCE as PrimitiveReference<T>;
    } else if (value === false) {
      return FALSE_REFERENCE as PrimitiveReference<T>;
    } else if (typeof value === 'number') {
      return new ValueReference(value) as PrimitiveReference<T>;
    } else {
      return new StringReference(value as string) as any as PrimitiveReference<T>;
    }
  }

  tag: Tag = CONSTANT_TAG;

  protected constructor(protected inner: T) {
  }

  value(): T {
    return this.inner;
  }

  get(_key: string): PrimitiveReference<Primitive> {
    return UNDEFINED_REFERENCE;
  }
}

class StringReference extends PrimitiveReference<string> {
  private lengthReference: Option<PrimitiveReference<number>> = null;

  get(key: string): PrimitiveReference<Primitive> {
    if (key === 'length') {
      let { lengthReference } = this;

      if (lengthReference === null) {
        lengthReference = this.lengthReference = new ValueReference(this.inner.length);
      }

      return lengthReference;
    } else {
      return super.get(key);
    }
  }
}

type Value = undefined | null | number | boolean;

class ValueReference<T extends Value> extends PrimitiveReference<T> {
  constructor(value: T) {
    super(value);
  }
}

export const UNDEFINED_REFERENCE: PrimitiveReference<undefined> = new ValueReference(undefined);
export const NULL_REFERENCE: PrimitiveReference<null> = new ValueReference(null);
export const TRUE_REFERENCE: PrimitiveReference<boolean> = new ValueReference(true);
export const FALSE_REFERENCE: PrimitiveReference<boolean> = new ValueReference(false);
