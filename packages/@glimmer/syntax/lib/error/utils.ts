import type * as src from '../source/api';
import type { LinePartition } from './types';

export function startLine(span: src.SourceSpan): number {
  return span.startPosition.line;
}
export function partitionLines(span: src.SourceSpan, source: src.Source): LinePartition {
  const { start, end } = span.loc;

  if (span.getEnd().eql(span.getStart())) {
    return {
      type: 'collapsed',
      at: span,
      line: source.getLine(start.line)!,
    };
  } else if (start.line === end.line) {
    return {
      type: 'single',
      at: span,
      line: source.getLine(start.line)!,
    };
  } else {
    return {
      type: 'multi',
      first: {
        at: span,
        line: source.getLine(start.line)!,
      },
      mid: {
        lineno: start.line + 1,
        lines: source.getLines(start.line + 1, end.line - 1),
      },
      last: {
        at: span,
        line: source.getLine(end.line)!,
      },
    };
  }
}
