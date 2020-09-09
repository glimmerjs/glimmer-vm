import { PresentArray } from '@glimmer/interfaces';
import { SourceLocation, SYNTHETIC } from '@glimmer/syntax';
import { LocatedWithOffsets, LocatedWithOptionalOffsets } from '../shared/ops';
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
  static SYNTHETIC: SourceOffsets = new SourceOffsets(0, 0, SourceOffsetKind.Synthetic);
  static NONE: SourceOffsets = new SourceOffsets(0, 0, SourceOffsetKind.None);

  static range(list: { offsets: SourceOffsets }[]): SourceOffsets {
    if (list.length === 0) {
      return SourceOffsets.NONE;
    } else {
      let first = list[0];
      let last = list[list.length - 1];

      if (first.offsets === null || last.offsets === null) {
        return SourceOffsets.NONE;
      } else {
        return new SourceOffsets(first.offsets.start, last.offsets.end);
      }
    }
  }

  static from(offsets: MaybeHasOffsets): SourceOffsets {
    if (offsets === null) {
      return SourceOffsets.NONE;
    } else if ('start' in offsets) {
      return offsets;
    } else if ('offsets' in offsets) {
      return SourceOffsets.from(offsets.offsets);
    } else {
      let start = offsets[0];
      let end = offsets[offsets.length - 1];

      if (start.offsets === null || end.offsets === null) {
        return SourceOffsets.NONE;
      } else {
        let startOffset = start.offsets.start;
        let endOffset = end.offsets.end;

        return new SourceOffsets(startOffset, endOffset);
      }
    }
  }

  readonly kind: SourceOffsetKind;

  constructor(readonly start: number, readonly end: number, kind = SourceOffsetKind.Normal) {
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
