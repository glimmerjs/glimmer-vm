import { expect, assert } from '@glimmer/util';
import { Dict, Option } from '@glimmer/interfaces';
import { UpdatableReference } from './property';

abstract class IdType {
  abstract getId(dict: Dict): string[];
}

class ColumnId extends IdType {
  constructor(private column: string) {
    super();
  }

  getId(dict: Dict): string[] {
    let value = dict[this.column];

    assert(typeof value === 'string', 'id columns must be strings');

    return [value as string];
  }
}

class CompositeId extends IdType {
  constructor(private columns: string[]) {
    super();
  }

  getId(dict: Dict): string[] {
    let keys = [];

    for (let column of this.columns) {
      let value = dict[column];
      assert(typeof value === 'string', 'id columns must be strings');

      keys.push(value as string);
    }

    return keys;
  }
}

export class RowReference {
  constructor(readonly sheet: string, readonly id: string[]) {}
}

export class Entry {
  constructor(readonly data: Dict, readonly metadata?: Dict) {}
}

export class Sheet {
  private rows = new Map();
  private allRowsReference: UpdatableReference<UpdatableReference[]> = new UpdatableReference([]);

  constructor(readonly name: string, readonly id: IdType, readonly columns: string[]) {}

  allRows(): UpdatableReference<UpdatableReference[]> {
    return this.allRowsReference;
  }

  getRowReference(entry: Entry): RowReference {
    let id = this.id.getId(entry.data);
    return new RowReference(this.name, id);
  }

  insertRow(row: Dict, metadata?: Dict): RowReference {
    let key = this.id.getId(row);
    this.insertRowByKey(key, new Entry(row, metadata));

    return new RowReference(this.name, key);
  }

  updateRow(row: Dict, metadata?: Dict) {
    let key = this.id.getId(row);
    this.insertRowByKey(key, new Entry(row, metadata));
  }

  getRow(id: string | string[]): Option<UpdatableReference> {
    id = typeof id === 'string' ? [id] : id;

    let map = this.rows;

    for (let part of id.slice(0, -1)) {
      if (map.has(part)) {
        map = map.get(part);
      } else {
        return null;
      }
    }

    let last = id[id.length - 1];

    return map.get(last);
  }

  private insertRowByKey(key: string[], row: Dict) {
    assert(key.length > 0, 'keys must have at least one part');

    let map = this.rows;

    for (let part of key.slice(0, -1)) {
      if (map.has(part)) {
        map = map.get(part);
      } else {
        let nested = new Map();
        map.set(part, nested);
        map = nested;
      }
    }

    let last = key[key.length - 1];

    if (map.has(last)) {
      let ref = map.get(last) as UpdatableReference;
      ref.update(row);
    } else {
      let ref = new UpdatableReference(row);
      map.set(last, ref);
    }

    this.allRowsReference.update(toArray(this.rows.values()));
  }
}

// `[...x]` is not available in this environment
function toArray<T>(iterable: Iterable<T>): T[] {
  let out = [];

  for (let item of iterable) {
    out.push(item);
  }

  return out;
}

export interface SheetDefinition {
  name: string;
  id: 'column' | { type: 'column'; column: string } | { type: 'columns'; columns: string[] };
  columns: string[];
}

export class Store {
  private sheets: Sheet[] = [];

  defineSheet(definition: SheetDefinition) {
    let id: IdType;

    if (definition.id === 'column') {
      id = new ColumnId('id');
    } else if (definition.id.type === 'column') {
      id = new ColumnId(definition.id.column);
    } else {
      id = new CompositeId(definition.id.columns);
    }

    let sheet = new Sheet(definition.name, id, definition.columns);
    this.sheets.push(sheet);
  }

  getSheet(name: string): Sheet {
    return expect(
      this.sheets.find(s => s.name === name),
      `Expected name of registered sheet, got ${name}`
    );
  }

  getRow(ref: RowReference): Option<UpdatableReference> {
    let sheet = this.getSheet(ref.sheet);

    return sheet.getRow(ref.id);
  }
}
