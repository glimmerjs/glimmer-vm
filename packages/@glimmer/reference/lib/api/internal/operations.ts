import type { Reactive, ReactiveResult, Tag } from '@glimmer/interfaces';
import { Err, getDescription, Ok } from '@glimmer/util';
import { consumeTag, track, validateTag, valueForTag } from '@glimmer/validator';

import type { InternalReactive } from './reactive';

import { describeReactive } from './debug';

function getValidResult<T>(ref: InternalReactive<T>): ReactiveResult<T> {
  return ref.error ? Err(ref.error) : Ok(ref.lastValue as T);
}

export function readInternalReactive<T>(reactive: InternalReactive<T>): ReactiveResult<T> {
  const { tag, compute } = reactive;

  if (validateInternalReactive(reactive)) {
    consumeTag(reactive.tag);
    return getValidResult(reactive);
  }

  // a data cell
  if (compute === null) {
    if (tag) consumeTag(tag);
    return getValidResult(reactive);
  }

  // a formula
  const newTag = track(compute, getDescription(reactive));

  reactive.tag = newTag;
  reactive.lastRevision = valueForTag(newTag);
  consumeTag(newTag);
  return getValidResult(reactive);
}

/**
 * @internal
 */

export function validateInternalReactive<T>(
  reactive: Reactive<T> | InternalReactive<T>
): reactive is Reactive<T> & { tag: Tag } {
  const { tag, lastRevision } = reactive as InternalReactive<T>;

  // not yet computed
  if (tag === null) return false;

  return validateTag(tag, lastRevision);
}

export function updateInternalReactive<T>(
  reactive: InternalReactive<T>,
  value: T
): ReactiveResult<void> {
  if (reactive.update) {
    reactive.update(value);
  } else if (import.meta.env.DEV) {
    throw Error(`cannot update ${describeReactive(reactive as Reactive)}`);
  }

  return Ok(undefined);
}
