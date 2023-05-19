import {
  consumeTag,
  dirtyTagFor,
  tagFor,
  type TagMeta,
  tagMetaFor,
  type UpdatableTag,
} from '@glimmer/validator';

import type { Cell } from './interfaces';

class CellImpl<T> implements Cell<T> {
  private _meta: TagMeta;
  private _obj: object;
  private _key: string;
  private _tag: UpdatableTag;
  private _value: T;

  constructor(parent: object, key: string, initialValue: T) {
    const meta = tagMetaFor(parent);
    this._meta = meta;
    this._obj = parent;
    this._key = key;
    this._tag = tagFor(parent, key, meta) as UpdatableTag;
    this._value = initialValue;
  }

  get(): T {
    consumeTag(this._tag);
    return this._value;
  }

  set(value: T) {
    dirtyTagFor(this._obj, this._key, this._meta);
    this._value = value;
  }
}

export default function createCell<T>(value: object, key: string, initialValue: T): Cell<T> {
  return new CellImpl(value, key, initialValue);
}
