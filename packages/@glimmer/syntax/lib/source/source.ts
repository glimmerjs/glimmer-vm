import { Optional } from '@glimmer/interfaces';
import {
  HasSourceLocation,
  isLocatedWithPositions,
  isLocatedWithPositionsArray,
  MaybeHasSourceLocation,
  SourceLocation,
  SourcePosition,
  SYNTHETIC,
} from './location';
import { SourceOffset, SourceOffsetKind, SourceOffsets } from './offsets';

export class Source {
  constructor(readonly source: string) {}

  readonly SYNTHETIC: SourceOffsets = new SourceOffsets(this, 0, 0, SourceOffsetKind.Synthetic);
  readonly NONE: SourceOffsets = new SourceOffsets(this, 0, 0, SourceOffsetKind.None);

  range(first: SourcePosition, last: SourcePosition): SourceOffsets {
    let start = this.offsetFor({ line: first.line, column: first.column });
    let end = this.offsetFor({ line: last.line, column: last.column });

    if (start === null || end === null) {
      return this.NONE;
    } else {
      return new SourceOffsets(this, start, end);
    }
  }

  maybeOffsetsFor(location: MaybeHasSourceLocation, fallback?: HasSourceLocation): SourceOffsets {
    if (location === null) {
      return fallback ? this.offsetsFor(fallback) : this.NONE;
    } else if (Array.isArray(location)) {
      if (isLocatedWithPositionsArray(location)) {
        return this.offsetsFor(location);
      } else {
        return this.NONE;
      }
    } else if (isLocatedWithPositions(location)) {
      return this.offsetsFor(location);
    } else {
      return this.NONE;
    }
  }

  offsetsFor(location: HasSourceLocation): SourceOffsets {
    if (Array.isArray(location)) {
      let first = location[0];
      let last = location[location.length - 1];

      return this.range(first.loc.start, last.loc.end);
    } else if ('loc' in location) {
      let { loc } = location;
      return this.range(loc.start, loc.end);
    } else {
      return this.locationToOffsets(location);
    }
  }

  offsetFor({ line, column }: { line: number; column: number }): Optional<SourceOffset> {
    let seenLines = 0;
    let seenChars = 0;

    while (true) {
      if (seenChars === this.source.length) return null;

      let nextLine = this.source.indexOf('\n', seenChars);
      if (nextLine === -1) nextLine = this.source.length;

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

  positionFor(offset: number): Optional<SourcePosition> {
    let seenLines = 0;
    let seenChars = 0;

    if (offset > this.source.length) {
      return null;
    }

    while (true) {
      let nextLine = this.source.indexOf('\n', seenChars);

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

  locationToOffsets(location: SourceLocation): SourceOffsets {
    let start = this.offsetFor(location.start);
    let end = this.offsetFor(location.end);

    if (location === SYNTHETIC) {
      return this.SYNTHETIC;
    } else if (start === null || end === null) {
      return this.NONE;
    } else {
      return new SourceOffsets(this, start, end);
    }
  }
}
