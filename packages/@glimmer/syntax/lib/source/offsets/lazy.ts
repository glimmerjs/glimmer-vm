// eslint-disable-next-line import/no-extraneous-dependencies
import { DEBUG } from '@glimmer/env';
import { assert } from '@glimmer/util';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { SourceLocation, SourcePosition } from '../location';
import { SerializedSourceOffsets } from '../offsets';
import type { Source } from '../source';
import {
  AbstractSourceOffset,
  AbstractSourceOffsets,
  SourceOffset,
  SourceOffsetKind,
  SourceOffsets,
} from './abstract';
import { concrete, ConcreteSourceOffset } from './concrete';
import { BROKEN, InvisibleSourceOffset, NON_EXISTENT, _BROKEN } from './invisible';
import { VisibleSourceOffsets } from './visible';

export class LazySourceOffsets extends VisibleSourceOffsets {
  private location: SourceLocation;

  constructor(source: Source, location: SourceLocation) {
    super(SourceOffsetKind.Lazy, source);

    // make sure to copy the values out in case they come from
    // a mutable object (like the tokenizer)
    this.location = {
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

  #concrete: SourceOffsets | null = null;

  concrete(): SourceOffsets {
    if (!this.#concrete) {
      this.#concrete = concrete(
        this.src,
        this.src.offsetFor(this.location.start).concrete(),
        this.src.offsetFor(this.location.end).concrete()
      );
    }

    return this.#concrete;
  }

  get startOffset(): LazySourceOffset {
    return new LazySourceOffset(this.src, this.location.start);
  }

  get endOffset(): LazySourceOffset {
    return new LazySourceOffset(this.src, this.location.end);
  }

  toLoc(): SourceLocation {
    return this.location;
  }

  extend(other: SourceOffsets): SourceOffsets {
    return new LazySourceOffsets(this.src, {
      start: this.location.start,
      end: other.loc.end,
    });
  }

  collapse(where: 'start' | 'end'): SourceOffsets {
    switch (where) {
      case 'start':
        return new LazySourceOffsets(this.src, {
          start: this.location.start,
          end: this.location.start,
        });
      case 'end':
        return new LazySourceOffsets(this.src, {
          start: this.location.end,
          end: this.location.end,
        });
    }
  }

  asString(): string {
    return this.concrete().asString();
  }

  sliceRange(options: { skipStart: number; skipEnd?: number | undefined }): SourceOffsets;
  sliceRange(options: { skipStart: number; chars: number }): SourceOffsets;
  sliceRange(options: { skipEnd: number; chars: number }): SourceOffsets;
  sliceRange(
    options:
      | { skipStart: number; skipEnd?: number }
      | { skipStart: number; chars: number }
      | { skipEnd: number; chars: number }
  ): SourceOffsets;
  sliceRange(
    options:
      | { skipStart: number; skipEnd?: number | undefined }
      | { skipStart: number; chars: number }
      | { skipEnd: number; chars: number }
  ) {
    return this.concrete().sliceRange(options);
  }

  serialize(): SerializedSourceOffsets {
    return this.concrete().serialize();
  }
}

export class LazySourceOffset extends AbstractSourceOffset {
  private sourcePosition: SourcePosition;
  constructor(readonly src: Source, pos: SourcePosition) {
    super();

    // make sure to copy the values out in case they come from
    // a mutable object (like the tokenizer)
    this.sourcePosition = {
      line: pos.line,
      column: pos.column,
    };
  }

  get offset(): number | null {
    return this.concrete().offset;
  }

  toPos(): SourcePosition {
    return this.sourcePosition;
  }

  eql(other: SourceOffset): boolean {
    if (other instanceof LazySourceOffset) {
      return this.pos.column === other.pos.column && this.pos.line === other.pos.line;
    } else if (other instanceof ConcreteSourceOffset) {
      let otherPos = other.pos;
      return this.pos.column === otherPos.column && this.pos.line === otherPos.line;
    }

    return false;
  }

  private byteOffset(): number {
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

  concrete(): ConcreteSourceOffset {
    return new ConcreteSourceOffset(this.src, this.byteOffset(), this.pos);
  }

  move(by: number): SourceOffset {
    return this.concrete().move(by);
  }

  collapsed(): LazySourceOffsets {
    return new LazySourceOffsets(this.src, {
      start: this.pos,
      end: this.pos,
    });
  }

  toPosition(): SourcePosition {
    return this.pos;
  }

  withEnd(end: SourceOffset): SourceOffsets {
    if (end instanceof LazySourceOffset) {
      return new LazySourceOffsets(this.src, {
        start: this.pos,
        end: end.pos,
      });
    } else {
      return offsets(this.src, this.src.offsetFor(this.pos), end);
    }
  }

  toJSON(): SourcePosition {
    return this.pos;
  }
}

export function offsets(
  source: Source,
  start: SourceOffset | SourcePosition,
  end: SourceOffset | SourcePosition
): SourceOffsets {
  let startOffset =
    start instanceof AbstractSourceOffset ? start : new LazySourceOffset(source, start);

  let endOffset = end instanceof AbstractSourceOffset ? end : new LazySourceOffset(source, end);

  if (startOffset instanceof LazySourceOffset && endOffset instanceof LazySourceOffset) {
    return new LazySourceOffsets(source, { start: startOffset.pos, end: endOffset.pos });
  }

  if (startOffset instanceof InvisibleSourceOffset || endOffset instanceof InvisibleSourceOffset) {
    let startKind = startOffset instanceof InvisibleSourceOffset ? startOffset.kind : null;
    let endKind = endOffset instanceof InvisibleSourceOffset ? endOffset.kind : null;

    if (startKind === SourceOffsetKind.Broken || endKind === SourceOffsetKind.Broken) {
      if (LOCAL_DEBUG) {
        return BROKEN(`Created a pair of offsets when one offset was broken`);
      }

      return _BROKEN;
    } else {
      return NON_EXISTENT;
    }
  }

  return new LazySourceOffsets(source, {
    start: startOffset.pos,
    end: endOffset.pos,
  });
}
