import type { Nullable, Optional } from '@glimmer/interfaces';
import { localAssert, setLocalDebugType } from '@glimmer/debug-util';

import type { PrecompileOptions } from '../parser/tokenizer-event-handlers';
import type { SourceLocation, SourcePosition } from './location';

import { HighlightedSpan } from '../validation-context/validation-context';
import { CharPosition } from './loc/offset';
import { SourceOffset, SourceSpan } from './span';

export class Source {
  static from(source: string, options: PrecompileOptions = {}): Source {
    return new Source(source, options.meta?.moduleName);
  }

  #linesCache: Optional<string[]> = undefined;

  constructor(
    readonly source: string,
    readonly module = 'an unknown module'
  ) {
    setLocalDebugType('syntax:source', this);
  }

  get start(): SourceOffset {
    return new CharPosition(this, 0).wrap();
  }

  /**
   * Validate that the character offset represents a position in the source string.
   */
  validate(offset: number): boolean {
    return offset >= 0 && offset <= this.source.length;
  }

  slice(start: number, end: number): string {
    return this.source.slice(start, end);
  }

  offsetFor(line: number, column: number): SourceOffset {
    return SourceOffset.forHbsPos(this, { line, column });
  }

  hasLine(line: number): boolean {
    return line >= 0 && line <= this.#getLines().length;
  }

  #getLines(): string[] {
    let lines = this.#linesCache;
    if (lines === undefined) {
      lines = this.#linesCache = this.source.split('\n');
    }

    return lines;
  }

  getLine(lineno: number): Optional<string> {
    return this.#getLines()[lineno - 1];
  }

  /**
   * Returns a span for the given line number.
   */
  lineSpan(lineno: number): SourceSpan {
    const line = this.getLine(lineno);

    localAssert(line !== undefined, `invalid line number: ${lineno}`);

    return SourceSpan.forHbsLoc(this, {
      start: { line: lineno, column: 0 },
      end: { line: lineno, column: line.length },
    });
  }

  highlightFor(
    { loc: { start, end } }: { loc: Readonly<SourceLocation> },
    label?: string
  ): HighlightedSpan {
    const loc = this.spanFor({ start, end });

    return HighlightedSpan.from({ loc, label });
  }

  fullSpan(): SourceSpan {
    return new CharPosition(this, 0)
      .wrap()
      .until(new CharPosition(this, this.source.length).wrap());
  }

  offsetSpan({ start, end }: { start: number; end: number }): SourceSpan {
    return new CharPosition(this, start).wrap().until(new CharPosition(this, end).wrap());
  }

  spanFor({ start, end }: Readonly<SourceLocation>): SourceSpan {
    return SourceSpan.forHbsLoc(this, {
      start: { line: start.line, column: start.column },
      end: { line: end.line, column: end.column },
    });
  }

  hbsPosFor(offset: number): Nullable<SourcePosition> {
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

  charPosFor(position: SourcePosition): number | null {
    let { line, column } = position;
    let sourceString = this.source;
    let sourceLength = sourceString.length;
    let seenLines = 0;
    let seenChars = 0;

    while (seenChars < sourceLength) {
      let nextLine = this.source.indexOf('\n', seenChars);
      if (nextLine === -1) nextLine = this.source.length;

      if (seenLines === line - 1) {
        if (seenChars + column > nextLine) return nextLine;

        if (import.meta.env.DEV) {
          let roundTrip = this.hbsPosFor(seenChars + column);
          localAssert(roundTrip !== null, `the returned offset failed to round-trip`);
          localAssert(
            roundTrip.line === line,
            `the round-tripped line didn't match the original line`
          );
          localAssert(
            roundTrip.column === column,
            `the round-tripped column didn't match the original column`
          );
        }

        return seenChars + column;
      } else if (nextLine === -1) {
        return 0;
      } else {
        seenLines += 1;
        seenChars = nextLine + 1;
      }
    }

    return sourceLength;
  }
}
