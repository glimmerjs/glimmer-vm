// eslint-disable-next-line node/no-extraneous-import, import/no-extraneous-dependencies
import type { Option } from '@glimmer/interfaces';

import type { SourceLocation, SourcePosition, SourceSpan } from './-internal';
import { LocationOffset, LocationSpan } from './-internal';

export class Source {
  constructor(readonly source: string, readonly module?: string) {}

  slice(start: number, end: number): string {
    return this.source.slice(start, end);
  }

  offsetFor(pos: { line: number; column: number }): LocationOffset {
    return new LocationOffset(this, pos);
  }

  spanFor(location: SourceLocation): SourceSpan {
    return new LocationSpan(this, location);
  }

  positionFor(offset: number): Option<SourcePosition> {
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
