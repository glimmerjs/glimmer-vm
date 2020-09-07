import { Option, PresentArray } from '@glimmer/interfaces';
import { SourceLocation, SourcePosition, SYNTHETIC } from '@glimmer/syntax';
import { Source } from './op';
import { LocatedWithOffsets, LocatedWithOptionalOffsets } from './ops';

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

  toLocation(source: string): SourceLocation {
    if (this.kind === SourceOffsetKind.Synthetic) {
      return SYNTHETIC;
    }

    let start = offsetToPosition(source, this.start);
    let end = offsetToPosition(source, this.end);

    if (start === null || end === null) {
      return SYNTHETIC;
    }

    return {
      start,
      end,
    };
  }
}

type SourceOffset = number;

export function positionToOffset(
  source: string,
  { line, column }: { line: number; column: number }
): Option<SourceOffset> {
  let seenLines = 0;
  let seenChars = 0;

  while (true) {
    if (seenChars === source.length) return null;

    let nextLine = source.indexOf('\n', seenChars);
    if (nextLine === -1) nextLine = source.length;

    if (seenLines === line) {
      if (seenChars + column > nextLine) return null;
      return seenChars + column;
    } else if (nextLine === -1) {
      return null;
    } else {
      seenLines += 1;
      seenChars = nextLine + 1;
    }
  }
}

export function offsetToPosition(source: string, offset: number): Option<SourcePosition> {
  let seenLines = 0;
  let seenChars = 0;

  if (offset > source.length) {
    return null;
  }

  while (true) {
    let nextLine = source.indexOf('\n', seenChars);

    if (offset <= nextLine || nextLine === -1) {
      return {
        line: seenLines,
        column: offset - seenChars,
      };
    } else {
      seenLines += 1;
      seenChars = nextLine + 1;
    }
  }
}

export function locationToOffsets(source: string, location: SourceLocation): Option<SourceOffsets> {
  let start = positionToOffset(source, location.start);
  let end = positionToOffset(source, location.end);

  if (start === null || end === null) {
    return null;
  } else {
    return new SourceOffsets(start, end);
  }
}
