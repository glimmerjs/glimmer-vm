import type { Reference, Revision, Tag } from '@glimmer/state';
import { unwrap } from '@glimmer/debug-util';

import { CONSTANT_TAG, isConstTag, validateTag, valueForTag } from './tag';
import { beginTrackFrame, consumeTag, endTrackFrame } from './tracking';

type Nullable<T> = T | null;

export interface ReferenceInternals<T = unknown> extends Reference<T> {
  tag: Nullable<Tag>;
  lastRevision: Revision;
  lastValue: T;
  update: Nullable<(val: T) => void>;
}

export function valueForRef<T>(_ref: Reference<T>): T {
  const ref = _ref as ReferenceInternals<T>;

  let { tag } = ref;

  if (tag === CONSTANT_TAG || isConstTag(tag)) {
    return ref.lastValue;
  }

  const { lastRevision } = ref;
  let lastValue;

  if (tag === null || !validateTag(tag, lastRevision)) {
    const { compute } = ref;

    beginTrackFrame(import.meta.env.DEV && ref.debugLabel);

    let newTag;

    try {
      lastValue = ref.lastValue = unwrap(compute)();
    } finally {
      newTag = endTrackFrame();
    }

    tag = ref.tag = newTag;

    ref.lastRevision = valueForTag(newTag);
  } else {
    lastValue = ref.lastValue;
  }

  consumeTag(tag);

  return lastValue;
}