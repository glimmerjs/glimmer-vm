// eslint-disable-next-line import/no-extraneous-dependencies
import { DEBUG } from '@glimmer/env';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { assert } from '@glimmer/util';

import type { SerializedSourceSpan, Source, SourceLocation, SourcePosition } from '../-internal';
import {
  _BROKEN,
  AbstractVisibleSourceOffset,
  AbstractVisibleSourceSpan,
  BROKEN,
  CharOffset,
  charSpan,
  SourceSpan,
} from './-internal';

export class LocationSpan extends AbstractVisibleSourceSpan {
  #location: SourceLocation;

  readonly isVisible = true;

  constructor(source: Source, location: SourceLocation) {
    super(source);

    // make sure to copy the values out in case they come from
    // a mutable object (like the tokenizer)
    this.#location = {
      start: {
        line: location.start.line,
        column: location.start.column,
      },
      end: {
        line: location.end.line,
        column: location.end.column,
      },
    };
  }

  #concrete: SourceSpan | null = null;

  protected locDidUpdate({ start, end }: { start?: SourcePosition; end?: SourcePosition }): void {
    if (start) {
      this.#location.start = start;
    }

    if (end) {
      this.#location.end = end;
    }
  }

  get concrete(): SourceSpan {
    if (!this.#concrete) {
      this.#concrete = charSpan(
        this.src,
        this.src.offsetFor(this.#location.start).concrete(),
        this.src.offsetFor(this.#location.end).concrete()
      );
    }

    return this.#concrete;
  }

  get startOffset(): LocationOffset {
    return new LocationOffset(this.src, this.#location.start);
  }

  get endOffset(): LocationOffset {
    return new LocationOffset(this.src, this.#location.end);
  }

  protected toLoc(): SourceLocation {
    return this.#location;
  }

  extend(other: SourceSpan): SourceSpan {
    if (!other.isVisible) {
      if (LOCAL_DEBUG) {
        return BROKEN(`extending a location offset with a ${other.kind} offset is not advisable`);
      } else {
        return _BROKEN;
      }
    }

    if (this.startOffset.hasCharOffset() && other.endOffset.hasCharOffset()) {
      return charSpan(
        this.src,
        this.startOffset.currentCharOffset,
        other.endOffset.currentCharOffset
      );
    } else {
      return new LocationSpan(this.src, {
        start: this.startPosition,
        end: other.endPosition,
      });
    }
  }

  collapse(where: 'start' | 'end'): SourceSpan {
    switch (where) {
      case 'start':
        return new LocationSpan(this.src, {
          start: this.#location.start,
          end: this.#location.start,
        });
      case 'end':
        return new LocationSpan(this.src, {
          start: this.#location.end,
          end: this.#location.end,
        });
    }
  }

  asString(): string {
    return this.concrete.asString();
  }

  slice(options: { skipStart?: number; skipEnd?: number }): SourceSpan {
    return this.concrete.slice(options);
  }

  sliceStartChars(options: { skipStart?: number; chars: number }): SourceSpan {
    return this.concrete.sliceStartChars(options);
  }

  sliceEndChars(options: { skipEnd?: number; chars: number }): SourceSpan {
    return this.concrete.sliceEndChars(options);
  }

  serialize(): SerializedSourceSpan {
    return this.concrete.serialize();
  }
}

export class LocationOffset extends AbstractVisibleSourceOffset {
  #sourcePosition: SourcePosition;
  #charOffset: number | null = null;

  readonly isVisible = true;

  constructor(src: Source, pos: SourcePosition) {
    super(src);

    // make sure to copy the values out in case they come from
    // a mutable object (like the tokenizer)
    this.#sourcePosition = {
      line: pos.line,
      column: pos.column,
    };
  }

  hasCharOffset(): this is { src: Source; currentCharOffset: number } {
    return this.#charOffset !== null;
  }

  get currentCharOffset(): number | null {
    return this.#charOffset;
  }

  get charOffset(): number {
    if (this.#charOffset !== null) {
      return this.#charOffset;
    }

    this.#charOffset = this.computeByteOffset();
    return this.#charOffset;
  }

  protected toPos(): SourcePosition {
    return this.#sourcePosition;
  }

  private computeByteOffset(): number {
    let { line, column } = this.pos;
    let sourceString = this.src.source;
    let sourceLength = sourceString.length;
    let seenLines = 0;
    let seenChars = 0;

    while (true) {
      if (seenChars >= sourceLength) return sourceLength;

      let nextLine = this.src.source.indexOf('\n', seenChars);
      if (nextLine === -1) nextLine = this.src.source.length;

      if (seenLines === line - 1) {
        if (seenChars + column > nextLine) return nextLine;

        if (DEBUG) {
          let roundTrip = this.src.positionFor(seenChars + column);
          assert(roundTrip !== null, `the returned offset failed to round-trip`);
          assert(roundTrip.line === line, `the round-tripped line didn't match the original line`);
          assert(
            roundTrip.column === column,
            `the round-tripped column didn't match the original column`
          );
        }

        return seenChars + column;
      } else if (nextLine === -1) {
        return 0;
      } else {
        seenLines += 1;
        seenChars = nextLine + 1;
      }
    }
  }

  concrete(): CharOffset {
    return new CharOffset(this.src, this.charOffset, this.pos);
  }

  toJSON(): SourcePosition {
    return this.pos;
  }
}
