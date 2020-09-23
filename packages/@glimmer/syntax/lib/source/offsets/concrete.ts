import type { Optional } from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { assert, unreachable } from '@glimmer/util';
import type { SourceLocation, SourcePosition } from '../location';
import { UNKNOWN_POSITION } from '../location';
import type { SerializedSourceOffsets } from '../offsets';
import { SourceSlice } from '../slice';
import type { Source } from '../source';
import { AbstractSourceOffset, SourceOffset, SourceOffsetKind, SourceOffsets } from './abstract';
import type { ConcreteSourceOffsetKind } from './invisible';
import { BROKEN, InvisibleSourceOffset, isInvisible, _BROKEN } from './invisible';
import { LazySourceOffset, offsets } from './lazy';
import { VisibleSourceOffsets } from './visible';

export class ConcreteSourceOffsets<K extends ConcreteSourceOffsetKind = ConcreteSourceOffsetKind>
  extends VisibleSourceOffsets<K>
  implements SourceLocation {
  readonly isConcrete = true;

  constructor(
    src: Source,
    readonly offsets: { start: ConcreteSourceOffset; end: ConcreteSourceOffset },
    kind: K
  ) {
    super(kind, src);
  }

  serialize(): SerializedSourceOffsets {
    if (this.kind === SourceOffsetKind.Normal) {
      return [this.startOffset.offset, this.endOffset.offset - this.startOffset.offset];
    } else {
      return this.startOffset.offset;
    }
  }

  get source(): Optional<string> {
    return this.src.module || null;
  }

  get startOffset(): ConcreteSourceOffset {
    return this.offsets.start;
  }

  get endOffset(): ConcreteSourceOffset {
    return this.offsets.end;
  }

  collapse(where: 'start' | 'end'): SourceOffsets {
    switch (where) {
      case 'start':
        return collapsed(this.src, this.startOffset);
      case 'end':
        return collapsed(this.src, this.endOffset);
    }
  }

  extend(other: ConcreteSourceOffsets): ConcreteSourceOffsets;
  extend(other: SourceOffsets): SourceOffsets;
  extend(other: SourceOffsets): SourceOffsets {
    if (isInvisible(other)) {
      if (LOCAL_DEBUG) {
        return BROKEN(`extending a concrete offset with a ${other.kind} offset is not advisable`);
      } else {
        return _BROKEN;
      }
    }

    assert(
      other.start >= this.end,
      `Can't extend SourceOffsets with a SourceOffsets that starts before this one ends`
    );

    return offsets(this.src, this.startOffset, other.endOffset);
  }

  asString(): string {
    return this.src.slice(this.startOffset.offset, this.endOffset.offset);
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
      chars: this.src.slice(this.startOffset.offset, this.endOffset.offset),
    });
  }

  sliceRange(options: { skipStart: number; skipEnd?: number }): SourceOffsets;
  sliceRange(options: { skipStart: number; chars: number }): SourceOffsets;
  sliceRange(options: { skipEnd: number; chars: number }): SourceOffsets;
  sliceRange(
    options:
      | { skipStart: number; skipEnd?: number }
      | { skipStart: number; chars: number }
      | { skipEnd: number; chars: number }
  ): SourceOffsets;
  sliceRange({
    skipStart,
    skipEnd,
    chars,
  }: {
    skipStart?: number;
    skipEnd?: number;
    chars?: number;
  }): SourceOffsets {
    if (skipStart !== undefined && chars === undefined) {
      // sliceRange(options: { skipStart: number; skipEnd?: number }): ConcreteSourceOffsets;

      return offsets(
        this.src,
        this.startOffset.move(skipStart),
        this.endOffset.move(-(skipEnd || 0))
      );
    } else if (skipStart !== undefined && chars !== undefined) {
      // sliceRange(options: { skipStart: number; chars: number }): ConcreteSourceOffsets;

      return offsets(
        this.src,
        this.startOffset.move(skipStart),
        this.startOffset.move(skipStart + chars)
      );
    } else if (skipEnd !== undefined && chars !== undefined) {
      // sliceRange(options: { skipEnd: number; chars: number }): ConcreteSourceOffsets;

      return offsets(this.src, this.endOffset.move(skipEnd - chars), this.endOffset.move(-skipEnd));
    } else {
      throw unreachable(`all overloads were reached`);
    }
  }

  toLoc(): SourceLocation {
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

export class ConcreteSourceOffset extends AbstractSourceOffset {
  #pos: SourcePosition | null = null;

  constructor(readonly src: Source, readonly offset: number, pos: SourcePosition | null = null) {
    super();
    this.#pos = pos;
  }

  eql(other: SourceOffset): boolean {
    if (other instanceof ConcreteSourceOffset) {
      return this.offset === other.offset;
    } else if (other instanceof LazySourceOffset) {
      return other.eql(this);
    }

    return false;
  }

  collapsed(): SourceOffsets {
    return collapsed(this.src, this.offset);
  }

  move(by: number): SourceOffset {
    let target = this.offset + by;

    if (target < 0) {
      return InvisibleSourceOffset.broken(1, target);
    } else if (target > this.src.source.length) {
      return InvisibleSourceOffset.broken(1, target);
    }

    return new ConcreteSourceOffset(this.src, target);
  }

  withEnd(end: SourceOffset): SourceOffsets {
    return offsets(this.src, this, end);
  }

  toJSON(): SourcePosition {
    return this.pos;
  }

  toPos(): SourcePosition {
    return this.#pos === null ? this.src.positionFor(this.offset) || UNKNOWN_POSITION : this.#pos;
  }
}

export function concrete(
  source: Source,
  start: number | ConcreteSourceOffset,
  end: number | ConcreteSourceOffset
): ConcreteSourceOffsets {
  let startOffset = typeof start === 'number' ? new ConcreteSourceOffset(source, start) : start;
  let endOffset = typeof end === 'number' ? new ConcreteSourceOffset(source, end) : end;

  if (startOffset.offset === endOffset.offset) {
    return collapsed(source, start);
  } else {
    return new ConcreteSourceOffsets(
      source,
      {
        start: startOffset,
        end: endOffset,
      },
      SourceOffsetKind.Normal
    );
  }
}

export function collapsed(
  source: Source,
  start: number | ConcreteSourceOffset
): ConcreteSourceOffsets {
  let startOffset = typeof start === 'number' ? new ConcreteSourceOffset(source, start) : start;

  return new ConcreteSourceOffsets(
    source,
    {
      start: startOffset,
      end: startOffset,
    },
    SourceOffsetKind.Collapsed
  );
}
