/*
  This is a proof of concept for a new approach to reactive programming.
  It's related to Glimmer-VM's `@tracked` system, but without invalidation step.
  We explicitly update DOM only when it's needed and only if tags are changed.
*/

import { scheduleRevalidate } from '@/utils/runtime';

// List of DOM operations for each tag
export const opsForTag: WeakMap<Cell | MergedCell, Array<tagOp>> = new WeakMap();
// REVISION replacement, we use a set of tags to revalidate
export const tagsToRevalidate: Set<Cell> = new Set();
// List of derived tags for each cell
export const relatedTags: WeakMap<Cell, Set<MergedCell>> = new WeakMap();

// console.info({
//   opsForTag,
//   tagsToRevalidate,
//   relatedTags,
// });

// we have only 2 types of cells
export type AnyCell = Cell | MergedCell;

let currentTracker: Set<Cell> | null = null;
let _isRendering = false;

export function isRendering() {
  return _isRendering;
}
export function setIsRendering(value: boolean) {
  _isRendering = value;
}

function tracker() {
  return new Set<Cell>();
}

// "data" cell, it's value can be updated, and it's used to create derived cells
export class Cell<T extends unknown = unknown> {
  _value!: T;
  _debugName?: string | undefined;
  constructor(value: T, debugName?: string) {
    this._value = value;
    this._debugName = debugName;
  }
  get value() {
    if (currentTracker !== null) {
      currentTracker.add(this);
    }
    return this._value;
  }
  update(value: T) {
    this._value = value;
    tagsToRevalidate.add(this);
    scheduleRevalidate();
  }
}

export function listDependentCells(cells: Array<AnyCell>, cell: MergedCell) {
  const msg = [cell._debugName, 'depends on:'];
  cells.forEach((cell) => {
    msg.push(cell._debugName);
  });
  return msg.join(' ');
}

function bindAllCellsToTag(cells: Set<Cell>, tag: MergedCell) {
  cells.forEach((cell) => {
    const tags = relatedTags.get(cell) || new Set();
    tags.add(tag);
    relatedTags.set(cell, tags);
  });
  // console.info(listDependentCells(Array.from(cells), tag));
}

// "derived" cell, it's value is calculated from other cells, and it's value can't be updated
export class MergedCell {
  fn: () => unknown;
  isConst = false;
  _debugName?: string | undefined;
  constructor(fn: () => unknown, debugName?: string) {
    this.fn = fn;
    this._debugName = debugName;
  }
  get value() {
    if (this.isConst) {
      return this.fn();
    }
    if (null === currentTracker && _isRendering) {
      currentTracker = tracker();
      try {
        return this.fn();
      } finally {
        if (currentTracker.size > 0) {
          bindAllCellsToTag(currentTracker, this);
        } else {
          this.isConst = true;
        }
        currentTracker = null;
      }
    } else {
      return this.fn();
    }
  }
}

// this function is called when we need to update DOM, values represented by tags are changed
export type tagOp = (...values: unknown[]) => void;

// this is runtime function, it's called when we need to update DOM for a specific tag
export function executeTag(tag: Cell | MergedCell) {
  try {
    const ops = opsForTag.get(tag) || [];
    const value = tag.value;
    ops.forEach((op) => {
      try {
        op(value);
      } catch (e: any) {
        console.error(`Error executing tag op: ${e.toString()}`);
      }
    });
  } catch (e: any) {
    console.error(`Error executing tag: ${e.toString()}`);
  }
}

// this is function to create a reactive cell from an object property
export function cellFor<T extends object, K extends keyof T>(obj: T, key: K): Cell<T[K]> {
  const cellValue = new Cell<T[K]>(obj[key], `${obj.constructor.name}.${String(key)}`);
  Object.defineProperty(obj, key, {
    get() {
      return cellValue.value;
    },
    set(val) {
      cellValue.update(val);
    },
  });
  return cellValue;
}

export function formula(fn: () => unknown, debugName?: string) {
  return new MergedCell(fn, `formula:${debugName ?? 'unknown'}`);
}
