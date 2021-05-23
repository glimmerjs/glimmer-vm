import { createStorage, getValue, setValue } from '@glimmer/validator';
import { StorageSource } from '@glimmer/interfaces';
import { Cell } from './interfaces';

class CellImpl<T> implements Cell<T> {
  private storage: StorageSource<T>;

  constructor(_obj: object, _key: string, initialValue: T) {
    this.storage = createStorage(initialValue);
  }

  get(): T {
    return getValue(this.storage);
  }

  set(value: T) {
    setValue(this.storage, value);
  }
}

export default function createCell<T>(obj: object, key: string, initialValue: T): Cell<T> {
  return new CellImpl(obj, key, initialValue);
}
