// eslint-disable-next-line node/no-extraneous-import, import/no-extraneous-dependencies
import type { Optional } from '@glimmer/interfaces';
import type { SourceLocation, SourcePosition } from './location';
import type { SourceOffsets } from './offsets/abstract';
import { LazySourceOffsets, LazySourceOffset } from './offsets/lazy';

export class Source {
  constructor(readonly source: string, readonly module?: string) {}

  slice(start: number, end: number): string {
    return this.source.slice(start, end);
  }

  offsetFor(pos: { line: number; column: number }): LazySourceOffset {
    return new LazySourceOffset(this, pos);
  }

  offsetsFor(location: SourceLocation): SourceOffsets {
    return new LazySourceOffsets(this, location);
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
}
