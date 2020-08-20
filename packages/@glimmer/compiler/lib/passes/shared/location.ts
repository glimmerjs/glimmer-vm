import { Option } from '@glimmer/interfaces';
import { SourceLocation, SourcePosition } from '@glimmer/syntax';

export interface SourceOffsets {
  start: number;
  end: number;
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
    return { start, end };
  }
}

export function offsetsToLocation(source: string, offsets: SourceOffsets): Option<SourceLocation> {
  let start = offsetToPosition(source, offsets.start);
  let end = offsetToPosition(source, offsets.end);

  if (start === null || end === null) {
    return null;
  }

  return {
    start,
    end,
  };
}
