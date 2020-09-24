// eslint-disable-next-line import/no-extraneous-dependencies
import type { PresentArray } from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { unreachable } from '@glimmer/util';

import {
  _BROKEN,
  BROKEN,
  CharOffsetSpan,
  charSpan,
  collapsed,
  InvisibleKind,
  InvisibleSpan,
  isInvisible,
  isSourceSpan,
  LocatedWithOptionalSpan,
  LocatedWithSpan,
  NON_EXISTENT,
  Source,
  SourceOffset,
  SourceSpan,
} from './-internal';

export type HasSpan = SourceSpan | LocatedWithSpan | PresentArray<LocatedWithSpan>;
export type MaybeHasSpan = SourceSpan | LocatedWithOptionalSpan | LocatedWithOptionalSpan[] | null;

export type ToSourceOffset = number | SourceOffset;

export class SpanList {
  static range(span: PresentArray<HasSourceSpan>): SourceSpan;
  static range(span: HasSourceSpan[], fallback: SourceSpan): SourceSpan;
  static range(span: HasSourceSpan[], fallback: SourceSpan = NON_EXISTENT): SourceSpan {
    return new SpanList(span.map(loc)).getRangeOffset(fallback);
  }

  #span: SourceSpan[];

  constructor(span: SourceSpan[] = []) {
    this.#span = span;
  }

  add(offset: CharOffsetSpan): void {
    this.#span.push(offset);
  }

  getRangeOffset(fallback: SourceSpan): SourceSpan {
    if (this.#span.length === 0) {
      return fallback;
    } else {
      let first = this.#span[0];
      let last = this.#span[this.#span.length - 1];

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

export type SerializedConcreteSourceSpan =
  | /** collapsed */ number
  | /** normal */ [start: number, size: number]
  | /** synthetic */ [chars: string];

export type SerializedSourceSpan =
  | SerializedConcreteSourceSpan
  | InvisibleKind.NonExistent
  | InvisibleKind.Broken;

export function loadSourceSpan(source: Source, serialized: SerializedSourceSpan): SourceSpan {
  if (typeof serialized === 'number') {
    return collapsed(source, serialized);
  } else if (Array.isArray(serialized)) {
    if (typeof serialized[0] === 'string') {
      return InvisibleSpan.synthetic(serialized[0]);
    } else {
      return charSpan(source, serialized[0], serialized[0]);
    }
  } else if (serialized === InvisibleKind.NonExistent) {
    return NON_EXISTENT;
  } else if (serialized === InvisibleKind.Broken) {
    return BROKEN();
  } else {
    throw unreachable();
  }
}

export type HasSourceSpan = { loc: SourceSpan } | SourceSpan | [HasSourceSpan, ...HasSourceSpan[]];

export function loc(span: HasSourceSpan): SourceSpan {
  if (Array.isArray(span)) {
    let first = span[0];
    let last = span[span.length - 1];

    return loc(first).extend(loc(last));
  } else if (isSourceSpan(span)) {
    return span;
  } else {
    return span.loc;
  }
}

export type MaybeHasSourceSpan = { loc: SourceSpan } | SourceSpan | MaybeHasSourceSpan[];

export function hasSpan(span: MaybeHasSourceSpan): span is HasSourceSpan {
  if (Array.isArray(span) && span.length === 0) {
    return false;
  }

  return true;
}

export function maybeLoc(location: MaybeHasSourceSpan, fallback: SourceSpan): SourceSpan {
  if (hasSpan(location)) {
    return loc(location);
  } else {
    return fallback;
  }
}
