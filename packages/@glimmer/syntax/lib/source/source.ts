// eslint-disable-next-line node/no-extraneous-import, import/no-extraneous-dependencies
import { DEBUG } from '@glimmer/env';
import { Optional } from '@glimmer/interfaces';
import { assert } from '@glimmer/util';
import {
  HasSourceLocation,
  isLocatedWithPositions,
  isLocatedWithPositionsArray,
  MaybeHasSourceLocation,
  SourceLocation,
  SourcePosition,
  SYNTHETIC,
} from './location';
import { SourceOffset, SourceOffsetKind, SourceOffsetList, SourceOffsets } from './offsets';

export class Source {
  constructor(readonly source: string, readonly module?: string) {}

  readonly NOT_IN_SOURCE: SourceOffsets = new SourceOffsets(
    this,
    { start: 0, end: 0 },
    SourceOffsetKind.Synthetic
  );
  readonly NON_EXISTENT: SourceOffsets = new SourceOffsets(
    this,
    { start: 0, end: 0 },
    SourceOffsetKind.None
  );

  slice(start: number, end: number): string {
    return this.source.slice(start, end);
  }

  offsetList(list: SourceOffsets[] = []): SourceOffsetList {
    return new SourceOffsetList(this, list);
  }

  range(first: SourcePosition, last: SourcePosition): SourceOffsets {
    let start = this.offsetFor({ line: first.line, column: first.column });
    let end = this.offsetFor({ line: last.line, column: last.column });

    if (start === null || end === null) {
      return this.NON_EXISTENT;
    } else {
      return new SourceOffsets(this, { start, end });
    }
  }

  maybeOffsetsFor(location: MaybeHasSourceLocation, fallback?: HasSourceLocation): SourceOffsets {
    if (location === null) {
      return fallback ? this.offsetsFor(fallback) : this.NON_EXISTENT;
    } else if (Array.isArray(location)) {
      if (isLocatedWithPositionsArray(location)) {
        return this.offsetsFor(location);
      } else {
        return this.NON_EXISTENT;
      }
    } else if (isLocatedWithPositions(location)) {
      return this.offsetsFor(location);
    } else {
      return this.NON_EXISTENT;
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
      if (seenChars >= this.source.length) return null;

      let nextLine = this.source.indexOf('\n', seenChars);
      if (nextLine === -1) nextLine = this.source.length;

      if (seenLines === line - 1) {
        if (seenChars + column > nextLine) return null;

        if (DEBUG) {
          let roundTrip = this.positionFor(seenChars + column);
          assert(roundTrip !== null, `the returned offset failed to round-trip`);
          assert(roundTrip.line === line, `the round-tripped line didn't match the original line`);
          assert(
            roundTrip.column === column,
            `the round-tripped column didn't match the original column`
          );
        }

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
          line: seenLines + 1,
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
      return this.NOT_IN_SOURCE;
    } else if (start === null || end === null) {
      return this.NON_EXISTENT;
    } else {
      return new SourceOffsets(this, { start, end });
    }
  }
}
