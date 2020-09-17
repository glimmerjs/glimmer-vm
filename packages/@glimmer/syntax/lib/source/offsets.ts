import { PresentArray } from '@glimmer/interfaces';
import {
  LocatedWithOffsets,
  LocatedWithOptionalOffsets,
  SourceLocation,
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

export class SourceOffsets {
  static range(source: Source, list: { offsets: SourceOffsets }[]): SourceOffsets {
    if (list.length === 0) {
      return source.NONE;
    } else {
      let first = list[0];
      let last = list[list.length - 1];

      if (first.offsets === null || last.offsets === null) {
        return source.NONE;
      } else {
        return new SourceOffsets(source, first.offsets.start, last.offsets.end);
      }
    }
  }

  static from(source: Source, offsets: MaybeHasOffsets): SourceOffsets {
    if (offsets === null) {
      return source.NONE;
    } else if ('start' in offsets) {
      return offsets;
    } else if ('offsets' in offsets) {
      return SourceOffsets.from(source, offsets.offsets);
    } else {
      let start = offsets[0];
      let end = offsets[offsets.length - 1];

      if (start.offsets === null || end.offsets === null) {
        return source.NONE;
      } else {
        let startOffset = start.offsets.start;
        let endOffset = end.offsets.end;

        return new SourceOffsets(source, startOffset, endOffset);
      }
    }
  }

  readonly kind: SourceOffsetKind;

  constructor(
    readonly source: Source,
    readonly start: number,
    readonly end: number,
    kind = SourceOffsetKind.Normal
  ) {
    if (kind === SourceOffsetKind.Normal && start === end) {
      this.kind = SourceOffsetKind.Collapsed;
    } else {
      this.kind = kind;
    }
  }

  toLocation(source: Source): SourceLocation {
    if (this.kind === SourceOffsetKind.Synthetic) {
      return SYNTHETIC;
    }

    let start = source.positionFor(this.start);
    let end = source.positionFor(this.end);

    if (start === null || end === null) {
      return SYNTHETIC;
    }

    return {
      start,
      end,
    };
  }
}

export type SourceOffset = number;
