// eslint-disable-next-line import/no-extraneous-dependencies
import { DEBUG } from '@glimmer/env';
import { Optional, PresentArray } from '@glimmer/interfaces';
import { assert } from '@glimmer/util';
import { SourceSlice } from '../v2/objects';
import {
  LocatedWithOffsets,
  LocatedWithOptionalOffsets,
  SourceLocation,
  SourcePosition,
  SYNTHETIC,
} from './location';
import { Source } from './source';

export type HasOffsets = SourceOffsets | LocatedWithOffsets | PresentArray<LocatedWithOffsets>;
export type MaybeHasOffsets =
  | SourceOffsets
  | LocatedWithOptionalOffsets
  | LocatedWithOptionalOffsets[]
  | null;

export enum SourceOffsetKind {
  Normal = 'NORMAL',
  Synthetic = 'SYNTHETIC',
  Collapsed = 'COLLAPSED',
  None = 'NONE',
}

export type SerializedSourceOffsets =
  | /** collapsed */ number
  | /** normal */ [start: number, size: number]
  | SourceOffsetKind;

export class SourceOffsets implements SourceLocation {
  static load(source: Source, serialized: SerializedSourceOffsets): SourceOffsets {
    if (typeof serialized === 'number') {
      return new SourceOffsets(
        source,
        {
          start: serialized,
          end: serialized,
        },
        SourceOffsetKind.Collapsed
      );
    } else if (Array.isArray(serialized)) {
      return new SourceOffsets(
        source,
        {
          start: serialized[0],
          end: serialized[1],
        },
        SourceOffsetKind.Normal
      );
    } else {
      return new SourceOffsets(source, { start: 0, end: 0 }, serialized);
    }
  }

  static range(source: Source, list: { offsets: SourceOffsets }[]): SourceOffsets {
    if (list.length === 0) {
      return source.NON_EXISTENT;
    } else {
      let first = list[0];
      let last = list[list.length - 1];

      if (first.offsets === null || last.offsets === null) {
        return source.NON_EXISTENT;
      } else {
        return new SourceOffsets(source, {
          start: first.offsets.startOffset,
          end: last.offsets.endOffset,
        });
      }
    }
  }

  static from(source: Source, offsets: MaybeHasOffsets): SourceOffsets {
    if (offsets === null) {
      return source.NON_EXISTENT;
    } else if ('start' in offsets) {
      return offsets;
    } else if ('offsets' in offsets) {
      return SourceOffsets.from(source, offsets.offsets);
    } else {
      let start = offsets[0];
      let end = offsets[offsets.length - 1];

      if (start.offsets === null || end.offsets === null) {
        return source.NON_EXISTENT;
      } else {
        let startOffset = start.offsets.startOffset;
        let endOffset = end.offsets.endOffset;

        return new SourceOffsets(source, { start: startOffset, end: endOffset });
      }
    }
  }

  readonly kind: SourceOffsetKind;

  constructor(
    readonly src: Source,
    readonly offsets: { start: number; end: number },
    kind = SourceOffsetKind.Normal
  ) {
    if (kind === SourceOffsetKind.Normal && offsets.start === offsets.end) {
      this.kind = SourceOffsetKind.Collapsed;
    } else {
      this.kind = kind;
    }
  }

  serialize(): SerializedSourceOffsets {
    switch (this.kind) {
      case SourceOffsetKind.Normal: {
        return [this.startOffset, this.endOffset - this.startOffset];
      }

      case SourceOffsetKind.Collapsed:
        return this.startOffset;

      default:
        return this.kind;
    }
  }

  get source(): Optional<string> {
    return this.src.module || null;
  }

  get startOffset(): number {
    return this.offsets.start;
  }

  get endOffset(): number {
    return this.offsets.end;
  }

  get start(): SourcePosition {
    return this.toLocation().start;
  }

  get end(): SourcePosition {
    return this.toLocation().end;
  }

  collapseStart(): SourceOffsets {
    return new SourceOffsets(
      this.src,
      { start: this.startOffset, end: this.startOffset },
      SourceOffsetKind.Collapsed
    );
  }

  collapseEnd(): SourceOffsets {
    return new SourceOffsets(
      this.src,
      { start: this.endOffset, end: this.endOffset },
      SourceOffsetKind.Collapsed
    );
  }

  extend(other: SourceOffsets) {
    assert(
      other.start >= this.end,
      `Can't extend SourceOffsets with a SourceOffsets that starts before this one ends`
    );

    return new SourceOffsets(this.src, { start: this.startOffset, end: other.endOffset });
  }

  asString(): string {
    return this.src.slice(this.startOffset, this.endOffset);
  }

  toSlice(expected?: string): SourceSlice {
    let chars = this.asString();

    if (DEBUG) {
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
      chars: this.src.slice(this.startOffset, this.endOffset),
    });
  }

  slice({ chars, from = 0 }: { chars: number; from?: number }): SourceOffsets {
    return new SourceOffsets(this.src, {
      start: this.startOffset + from,
      end: this.startOffset + from + chars,
    });
  }

  sliceRange({
    skipStart = 0,
    skipEnd = 0,
  }: {
    skipStart?: number;
    skipEnd?: number;
  }): SourceOffsets {
    return new SourceOffsets(this.src, {
      start: this.startOffset + skipStart,
      end: this.endOffset - skipEnd,
    });
  }

  sliceFrom({ offset = 0 }: { offset?: number }): SourceOffsets {
    return new SourceOffsets(this.src, {
      start: this.startOffset + offset,
      end: this.endOffset,
    });
  }

  sliceTo({ skipEnd = 0, chars = 0 }: { skipEnd?: number; chars?: number }): SourceOffsets {
    return new SourceOffsets(this.src, {
      start: this.endOffset - skipEnd - chars,
      end: this.endOffset - skipEnd,
    });
  }

  toLocation(): SourceLocation {
    if (this.kind === SourceOffsetKind.Synthetic) {
      return SYNTHETIC;
    }

    let start = this.src.positionFor(this.startOffset);
    let end = this.src.positionFor(this.endOffset);

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

export class SourceOffsetList {
  constructor(private source: Source, private offsets: SourceOffsets[] = []) {}

  add(offset: SourceOffsets): void {
    this.offsets.push(offset);
  }

  getRangeOffset(): SourceOffsets {
    if (this.offsets.length === 0) {
      return this.source.NON_EXISTENT;
    } else {
      if (this.offsets.some((o) => o.kind === SourceOffsetKind.None)) {
        return this.source.NON_EXISTENT;
      }

      let first = this.offsets[0];
      let last = this.offsets[this.offsets.length - 1];

      return new SourceOffsets(this.source, { start: first.startOffset, end: last.endOffset });
    }
  }
}

export type SourceOffset = number;
