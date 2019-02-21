import { Span } from '../types/handlebars-ast';

export interface Position {
  line: number;
  column: number;
}

export interface Location {
  start: Position;
  end: Position;
}

export function listSpan(items: Array<{ span: Span }>, defaultPos?: number): Span {
  if (items.length === 0) {
    if (defaultPos !== undefined) {
      return { start: defaultPos, end: defaultPos };
    } else {
      throw new Error(`Can't create a span from an empty list`);
    }
  }

  return { start: items[0].span.start, end: items[items.length - 1].span.end };
}

export function locForSpan(source: string, span: Span | null): Location {
  if (span === null) {
    return {
      start: { line: 1, column: 0 },
      end: { line: 1, column: 0 },
    };
  }

  let lines = source.split('\n');
  let seen = 0;
  let lineNo = 1;

  let start = { line: -1, column: -1 };
  let end = { line: -1, column: -1 };

  for (let line of lines) {
    // the current line contains the start span
    if (seen + line.length >= span.start) {
      start.line = lineNo;
      start.column = span.start - seen;
    } else {
      seen += line.length + 1;
      lineNo++;
      continue;
    }

    if (seen + line.length > span.end) {
      end.line = lineNo;
      end.column = span.end - seen;

      return { start, end };
    } else {
      seen += line.length + 1;
      lineNo++;
      break;
    }
  }

  let rest = lines.slice(lineNo - 1);

  for (let line of rest) {
    if (seen + line.length >= span.end) {
      end.line = lineNo;
      end.column = span.end - seen;
      break;
    } else {
      seen += line.length + 1;
      lineNo++;
      continue;
    }
  }

  return { start, end };
}
