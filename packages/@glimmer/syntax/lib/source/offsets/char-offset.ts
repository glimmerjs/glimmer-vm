import type { Option } from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { assert } from '@glimmer/util';

import type { SourceLocation, SourcePosition } from '../location';
import { UNKNOWN_POSITION } from '../location';
import { SourceSlice } from '../slice';
import type { Source } from '../source';
import type { SerializedSourceSpan } from '../spans';
import {
  _BROKEN,
  AbstractVisibleSourceOffset,
  AbstractVisibleSourceSpan,
  BROKEN,
  EagerSpan,
  InvisibleOffset,
  SourceSpan,
} from './-internal';

/**
 * A `ByteOffsetSpan` contains starting and ending byte offsets, and can convert them into
 * `SourcePosition`s (with lines and columns) on demand.
 */
export class CharOffsetSpan extends AbstractVisibleSourceSpan implements SourceLocation {
  readonly isVisible = true;

  constructor(src: Source, readonly offsets: { start: CharOffset; end: CharOffset }) {
    super(src);
  }

  protected locDidUpdate({ start, end }: { start?: SourcePosition; end?: SourcePosition }): void {
    if (start) {
      this.offsets.start = this.src.offsetFor(start).concrete();
    }

    if (end) {
      this.offsets.end = this.src.offsetFor(end).concrete();
    }
  }

  serialize(): SerializedSourceSpan {
    if (this.startOffset.eql(this.endOffset)) {
      return this.startOffset.charOffset;
    } else {
      return [this.startOffset.charOffset, this.endOffset.charOffset - this.startOffset.charOffset];
    }
  }

  get source(): Option<string> {
    return this.src.module || null;
  }

  get startOffset(): CharOffset {
    return this.offsets.start;
  }

  get endOffset(): CharOffset {
    return this.offsets.end;
  }

  collapse(where: 'start' | 'end'): SourceSpan {
    switch (where) {
      case 'start':
        return collapsed(this.src, this.startOffset);
      case 'end':
        return collapsed(this.src, this.endOffset);
    }
  }

  asString(): string {
    return this.src.slice(this.startOffset.charOffset, this.endOffset.charOffset);
  }

  toSlice(expected?: string): SourceSlice {
    let chars = this.asString();

    if (LOCAL_DEBUG) {
      if (expected !== undefined && chars !== expected) {
        throw new Error(
          `unexpectedly found ${JSON.stringify(
            chars
          )} when slicing source, but expected ${JSON.stringify(expected)}`
        );
      }
    }

    return new SourceSlice({
      loc: this,
      chars: this.src.slice(this.startOffset.charOffset, this.endOffset.charOffset),
    });
  }

  extend(other: CharOffsetSpan): CharOffsetSpan;
  extend(other: SourceSpan): SourceSpan;
  extend(other: SourceSpan): SourceSpan {
    if (!other.isVisible) {
      if (LOCAL_DEBUG) {
        return BROKEN(`extending a concrete offset with a ${other.kind} offset is not advisable`);
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
    }

    assert(
      other.startOffset >= this.endOffset,
      `Can't extend SourceOffsets with a SourceOffsets that starts before this one ends`
    );

    return charSpan(this.src, this.startOffset, other.endOffset.charOffset);
  }

  slice({ skipStart = 0, skipEnd = 0 }: { skipStart?: number; skipEnd?: number }): SourceSpan {
    return extend(this.src, this.startOffset.move(skipStart), this.endOffset.move(-skipEnd));
  }

  sliceStartChars({ skipStart = 0, chars }: { skipStart?: number; chars: number }): SourceSpan {
    return extend(
      this.src,
      this.startOffset.move(skipStart),
      this.startOffset.move(skipStart + chars)
    );
  }

  sliceEndChars({ skipEnd = 0, chars }: { skipEnd?: number; chars: number }): SourceSpan {
    return extend(this.src, this.endOffset.move(skipEnd - chars), this.endOffset.move(-skipEnd));
  }

  protected toLoc(): SourceLocation {
    let start = this.startOffset.pos;
    let end = this.endOffset.pos;

    assert(
      start !== null && end !== null,
      `It should be impossible for positionFor to return null for an offset that made it into a SourceOffsets`
    );

    return {
      start: start,
      end: end,
    };
  }
}

export class CharOffset extends AbstractVisibleSourceOffset {
  #pos: SourcePosition | null = null;
  #offset: number;

  readonly isVisible = true;

  constructor(src: Source, offset: number, pos: SourcePosition | null = null) {
    super(src);
    this.#pos = pos;
    this.#offset = offset;
  }

  hasCharOffset(): this is { src: Source; currentCharOffset: number } {
    return true;
  }

  get currentCharOffset(): number {
    return this.#offset;
  }

  get charOffset(): number {
    return this.#offset;
  }

  toJSON(): SourcePosition {
    return this.pos;
  }

  protected toPos(): SourcePosition {
    return this.#pos === null ? this.src.positionFor(this.#offset) || UNKNOWN_POSITION : this.#pos;
  }
}

export function charSpan(
  source: Source,
  start: number | CharOffset,
  end: number | CharOffset
): CharOffsetSpan {
  let startOffset = typeof start === 'number' ? new CharOffset(source, start) : start;
  let endOffset = typeof end === 'number' ? new CharOffset(source, end) : end;

  if (startOffset.charOffset === endOffset.charOffset) {
    return collapsed(source, start);
  } else {
    return new CharOffsetSpan(source, {
      start: startOffset,
      end: endOffset,
    });
  }
}

export function collapsed(source: Source, start: number | CharOffset): CharOffsetSpan {
  let startOffset = typeof start === 'number' ? new CharOffset(source, start) : start;

  return new CharOffsetSpan(source, {
    start: startOffset,
    end: startOffset,
  });
}

function extend(
  src: Source,
  start: InvisibleOffset | CharOffset,
  end: InvisibleOffset | CharOffset
): EagerSpan {
  if (start.isVisible && end.isVisible) {
    return charSpan(src, start, end);
  } else if (!start.isVisible) {
    return start.collapsed();
  } else {
    return end.collapsed() as EagerSpan;
  }
}
