// eslint-disable-next-line import/no-extraneous-dependencies
import type { PresentArray } from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { unreachable } from '@glimmer/util';
import type { LocatedWithOffsets, LocatedWithOptionalOffsets } from './location';
import type { SourceOffset, SourceOffsets } from './offsets/abstract';
import { AbstractSourceOffsets, SourceOffsetKind } from './offsets/abstract';
import { collapsed, concrete, ConcreteSourceOffsets } from './offsets/concrete';
import {
  BROKEN,
  InvisibleSourceOffsets,
  isInvisible,
  NON_EXISTENT,
  _BROKEN,
} from './offsets/invisible';
import type { Source } from './source';

export type HasOffsets = SourceOffsets | LocatedWithOffsets | PresentArray<LocatedWithOffsets>;
export type MaybeHasOffsets =
  | SourceOffsets
  | LocatedWithOptionalOffsets
  | LocatedWithOptionalOffsets[]
  | null;

export function isSourceOffsets(v: object): v is SourceOffsets {
  return v instanceof AbstractSourceOffsets;
}

export type ToSourceOffset = number | SourceOffset;

export class SourceOffsetList {
  static range(offsets: PresentArray<HasSourceOffsets>): SourceOffsets;
  static range(offsets: HasSourceOffsets[], fallback: SourceOffsets): SourceOffsets;
  static range(offsets: HasSourceOffsets[], fallback: SourceOffsets = NON_EXISTENT): SourceOffsets {
    return new SourceOffsetList(offsets.map(loc)).getRangeOffset(fallback);
  }

  constructor(private offsets: SourceOffsets[] = []) {}

  add(offset: ConcreteSourceOffsets): void {
    this.offsets.push(offset);
  }

  getRangeOffset(fallback: SourceOffsets): SourceOffsets {
    if (this.offsets.length === 0) {
      return fallback;
    } else {
      let first = this.offsets[0];
      let last = this.offsets[this.offsets.length - 1];

      if (isInvisible(first) || isInvisible(last)) {
        if (LOCAL_DEBUG) {
          return BROKEN(`creating a range offset with non-concrete offset is not advisable`);
        } else {
          return _BROKEN;
        }
      }

      return first.extend(last);
    }
  }
}

export type SerializedConcreteSourceOffsets =
  | /** collapsed */ number
  | /** normal */ [start: number, size: number]
  | /** synthetic */ [chars: string];

export type SerializedSourceOffsets =
  | SerializedConcreteSourceOffsets
  | SourceOffsetKind.NonExistent
  | SourceOffsetKind.Broken;

export function loadSourceOffsets(
  source: Source,
  serialized: SerializedSourceOffsets
): SourceOffsets {
  if (typeof serialized === 'number') {
    return collapsed(source, serialized);
  } else if (Array.isArray(serialized)) {
    if (typeof serialized[0] === 'string') {
      return InvisibleSourceOffsets.synthetic(serialized[0]);
    } else {
      return concrete(source, serialized[0], serialized[0]);
    }
  } else if (serialized === SourceOffsetKind.NonExistent) {
    return NON_EXISTENT;
  } else if (serialized === SourceOffsetKind.Broken) {
    return BROKEN();
  } else {
    throw unreachable();
  }
}

export type HasSourceOffsets =
  | { loc: SourceOffsets }
  | SourceOffsets
  | [HasSourceOffsets, ...HasSourceOffsets[]];

export function loc(offsets: HasSourceOffsets): SourceOffsets {
  if (Array.isArray(offsets)) {
    let first = offsets[0];
    let last = offsets[offsets.length - 1];

    return loc(first).extend(loc(last));
  } else if (isSourceOffsets(offsets)) {
    return offsets;
  } else {
    return offsets.loc;
  }
}

export type MaybeHasSourceOffsets =
  | { loc: SourceOffsets }
  | SourceOffsets
  | MaybeHasSourceOffsets[];

export function hasOffsets(offsets: MaybeHasSourceOffsets): offsets is HasSourceOffsets {
  if (Array.isArray(offsets) && offsets.length === 0) {
    return false;
  }

  return true;
}

export function maybeLoc(location: MaybeHasSourceOffsets, fallback: SourceOffsets): SourceOffsets {
  if (hasOffsets(location)) {
    return loc(location);
  } else {
    return fallback;
  }
}
