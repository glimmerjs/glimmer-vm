import type {
  DeeplyConstantReactiveCell,
  DefaultDescriptionFields,
  Described,
  DescriptionSpec,
  MutableReactiveCell,
  ReactiveCell,
  ReferenceDescription,
  RETURN_TYPE,
} from '@glimmer/interfaces';
import { devmode, setDescription, toValidatableDescription } from '@glimmer/util';
import { CONSTANT_TAG, consumeTag, createTag, dirtyTag } from '@glimmer/validator';

import { unwrapReactive, updateReactive } from './core';
import {
  DEEPLY_CONSTANT,
  InternalReactive,
  MUTABLE_CELL,
  READONLY_CELL,
} from './internal/reactive';

/**
 * Read the current value of a cell. Since a cell cannot be in an error state, this always
 * (infallibly) produces the value of the cell.
 */
export function readCell<T>(cell: ReactiveCell<T>): T {
  return unwrapReactive(cell);
}

/**
 * Write a value to a *mutable* cell. This operation is infallible.
 */
export function writeCell<T>(cell: MutableReactiveCell<T>, value: T): void {
  updateReactive(cell, value);
}

const MUTABLE_CELL_DEFAULTS = devmode(
  () =>
    ({
      type: 'MutableCell',
      read: 'infallible',
      write: 'infallible',
      label: ['{cell}'],
    }) satisfies DefaultDescriptionFields
);

/**
 * Create a mutable cell.
 *
 * A mutable cell is a place to store a single value.
 *
 * Reads and writes are infallible.
 */
export function MutableCell<T>(value: T, description?: DescriptionSpec): MutableReactiveCell<T> {
  const ref = new InternalReactive(MUTABLE_CELL);

  const tag = (ref.tag = createTag(toValidatableDescription(description, MUTABLE_CELL_DEFAULTS)));
  ref.lastValue = value;

  ref.update = (value) => {
    ref.lastValue = value;
    dirtyTag(tag);
  };

  setDescription(
    ref,
    devmode(() => toValidatableDescription(description, MUTABLE_CELL_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}

const READONLY_CELL_DEFAULTS = devmode(
  () =>
    ({
      type: 'ReadonlyCell',
      read: 'infallible',
      write: 'none',
      label: ['{readonly cell}'],
    }) satisfies DefaultDescriptionFields
);

/**
 * Create a readonly cell.
 *
 * A readonly cell is a place to store a single value that cannot change.
 *
 * Reads are infallible. Properties are not readonly.
 *
 * @see {DeeplyReadonlyCell}
 */
export function ReadonlyCell<T>(value: T, description?: DescriptionSpec): ReactiveCell<T> {
  const ref = new InternalReactive(READONLY_CELL);

  ref.tag = CONSTANT_TAG;
  ref.lastValue = value;

  setDescription(
    ref,
    devmode(() => toValidatableDescription(description, READONLY_CELL_DEFAULTS))
  );

  return ref as RETURN_TYPE;
}

/**
 * Create a deeply constant cell.
 *
 * A deeply constant cell behaves like a readonly cell, but properties of a deeply constant cell are
 * also deeply constant.
 *
 * Reads are infallible. Properties are readonly.
 *
 * @see {ReadonlyCell}
 *
 * @remarks
 *
 * The concept of a "deeply readonly cell" was previously referred to as an "unbound reference".
 */
export function DeeplyReadonlyCell<T>(
  value: T,
  debugLabel?: false | string
): DeeplyConstantReactiveCell<T> {
  const ref = new InternalReactive(DEEPLY_CONSTANT);

  ref.tag = CONSTANT_TAG;
  ref.lastValue = value;

  if (import.meta.env.DEV) {
    ref.description = devmode(
      () =>
        ({
          type: 'DeeplyReadonlyCell',
          read: 'fallible',
          write: 'none',
          label: [debugLabel || `{deeply readonly cell}`],
        }) satisfies ReferenceDescription
    );
  }

  return ref as RETURN_TYPE;
}

interface Marker extends Described<ReferenceDescription> {
  updated: () => void;
  consumed: () => void;
}

/**
 * Create an external marker.
 *
 * An external marker is an object that allows you to reflect external state into the reactivity
 * system. It is used to create custom reactive objects that don't use tracked fields to store their
 * state.
 *
 * For example, you could use a marker to implement a reactive wrapper around local storage.
 *
 * ```js
 * class ReactiveLocalStorage {
 *   #markers: Record<string, Marker>;
 *
 *   get(key) {
 *     this.#initialized(key).consumed();
 *     return localStorage[key]
 *   }
 *
 *   set(key, value) {
 *     localStorage[key] = value;
 *     this.#initialized(key).updated();
 *   }
 *
 *   #initialized(key) {
 *     return (this.#marker[key] ??= ExternalMarker());
 *   }
 * }
 * ```
 *
 * You could use the same technique to implement tracked builtins or other custom reactive objects.
 * In general, this approach is most useful when you have a source of truth in external data and
 * want to avoid duplicating it.
 */
export function ExternalMarker(debugLabel?: DescriptionSpec): Marker {
  const description = toValidatableDescription(
    debugLabel,
    devmode(() => ({ label: ['{external marker}'] }))
  );
  const tag = createTag(description);

  const marker = {
    mark: () => dirtyTag(tag),
    consume: () => consumeTag(tag),
  };

  setDescription(marker, description);

  return marker as RETURN_TYPE;
}
