import type { Optional } from '@glimmer/interfaces';

import type * as src from './source/api';
import * as Validation from './validation-context/validation-context';
import type { HighlightedCode, ReportableContext } from './validation-context/validation-context';

export interface GlimmerSyntaxError extends Error {
  location: src.SourceSpan | null;
  code: string | null;
}

export function quote(
  highlights: HighlightedCode,
  options: { error: string; notes?: string[] }
): GlimmerSyntaxError {
  const loc = highlights.full;
  const module = loc.module;
  let { line, column } = loc.startPosition;

  const quotedCode = _quoteReportable(highlights);
  const where = `(error occurred in '${module}' @ line ${line} : column ${column})`;

  let message: string;

  const allNotes = [...(options.notes ?? [])];

  if (quotedCode || allNotes.length > 0) {
    const notesString =
      allNotes.length > 0 ? `${allNotes.map((n) => `NOTE: ${n}`).join('\n\n')}\n\n` : '';
    message = `${options.error}${quotedCode}${notesString}${where}`;
  } else {
    message = `${options.error} ${where}`;
  }

  const code = loc.asString();

  let error = new Error(message) as GlimmerSyntaxError;

  error.name = 'SyntaxError';
  error.location = loc;
  error.code = code;

  return error;
}

export function quoteReportable(context: ReportableContext): GlimmerSyntaxError {
  return quote(context.highlights(), { error: context.error, notes: context.notes });
}

export function generateSyntaxError(
  message: string,
  location: Validation.IntoHighlight,
  options?: { full?: Optional<src.SourceSpan> }
): GlimmerSyntaxError {
  return quote(Validation.HighlightedCode.from(options?.full, location), { error: message });
}

function _quoteReportable(highlighted: HighlightedCode): string {
  const { primary, expanded } = highlighted.highlight;
  const highlight = expanded?.loc ?? primary.loc;

  const fullContext = highlighted.full;

  const fullLines = fullContext.fullLines();
  const codeString = fullContext.asString();

  const fullRange = LineRange.for(
    fullContext.getSource(),
    fullLines.startPosition.line,
    fullLines.endPosition.line
  );

  const lines = new LineBuffers([...fullRange]);
  const code = lines
    .forLine(highlight.startPosition.line, fullContext.startPosition.column)
    .add(codeString.split('\n')[0]);

  const underline = drawUnderline(lines, highlighted);
  return `\n\n${code}\n${underline}\n\n`;
}

function drawUnderline(buffers: LineBuffers, { full, highlight }: HighlightedCode) {
  const { primary, expanded, prefix, suffix } = highlight;

  const lines = [];

  const line1 = buffers.blank(full.startPosition.column);

  if (prefix && suffix) {
    line1.until(prefix).repeat(prefix.size, '─');
  } else if (prefix && expanded?.label) {
    line1.until(prefix).add(prefix.size === 1 ? '┬' : `─┬${'─'.repeat(prefix.size - 2)}`);
  } else {
    line1.until(primary.loc);
  }

  if (primary.label) {
    line1.add(primary.size === 1 ? '┳' : `━┳${'━'.repeat(primary.size - 2)}`);
  } else {
    line1.untilEnd(primary.loc, '━');
  }

  if (suffix) {
    if (expanded?.label) line1.add(suffix.size > 1 ? '─┬' : '┬');
    line1.untilEnd(suffix, '─');
  }

  lines.push(line1);

  if (suffix && expanded) {
    if (expanded.label) {
      const line2 = buffers.blank(full.startPosition.column);

      line2.until(primary.loc);

      if (primary.label) {
        line2.add(primary.size === 1 ? '┃' : ' ┃');
      }

      line2
        .untilEnd(primary.loc)
        .until(suffix)
        .add(suffix.size === 1 ? '└' : ' └')
        .untilEnd(suffix, '─')
        .space()
        .add(expanded.label);

      lines.push(line2);
    }

    const line3 = buffers.blank(full.startPosition.column).until(primary.loc);

    if (primary.label) {
      line3
        .add(primary.size === 1 ? '┗' : ' ┗')
        .untilEnd(suffix, '━')
        .space()
        .add(primary.label);
    }

    lines.push(line3);
  } else if (prefix) {
    const line2 = buffers.blank(full.startPosition.column);

    line2.until(prefix).add(prefix.size === 1 ? '│' : ` │`);

    if (primary.label) {
      line2
        .until(primary.loc)
        .add(primary.size === 1 ? '┗' : ' ┗')
        .untilEnd(primary.loc, '━')
        .space()
        .add(primary.label);
    }

    lines.push(line2);

    if (expanded?.label) {
      const line3 = buffers
        .blank(full.startPosition.column)
        .until(prefix)
        .add(prefix.size === 1 ? '└' : ' └')
        .untilEnd(primary.loc, '─')
        .space()
        .add(expanded.label);

      lines.push(line3);
    }
  } else if (primary.label) {
    lines.push(
      buffers
        .blank(full.startPosition.column)
        .until(primary.loc)
        .add(primary.size === 1 ? '┗' : ' ┗')
        .untilEnd(primary.loc, '━')
        .space()
        .add(primary.label)
    );
  }

  return lines.map((l) => `${l}\n`).join('');
}

class LineBuffers {
  #lines: number[];

  constructor(lines: number[]) {
    this.#lines = lines;
  }

  get #width() {
    return Math.max(...this.#lines.map((l) => String(l).length));
  }

  forLine(line: number, startColumn: number) {
    return new LineBuffer(`${String(line).padStart(this.#width)} | `, startColumn);
  }

  blank(startColumn: number) {
    return new LineBuffer(`${' '.repeat(this.#width)} | `, startColumn);
  }
}

class LineBuffer {
  #offset: number = 0;
  #content: string;
  #startColumn: number;

  constructor(gutter: string, startColumn: number) {
    this.#content = gutter;
    this.#startColumn = startColumn;
  }

  repeat(size: Optional<number>, repeat: string) {
    if (size === undefined) return this;
    return this.add(repeat.repeat(size));
  }

  add(string: Optional<string>): this;
  add(strings: Optional<string>[] | Optional<string>, separator?: string): this;
  add(strings: Optional<string>[] | Optional<string>, separator: string = ' ') {
    if (Array.isArray(strings)) {
      const presentStrings = strings.filter(
        Boolean as unknown as (value: Optional<string>) => value is string
      );
      return this.add(presentStrings.join(separator));
    } else if (strings === undefined) {
      return this;
    } else {
      this.#content += strings;
      this.#offset += strings.length;
      return this;
    }
  }

  space() {
    return this.add(' ');
  }

  untilEnd(span: Optional<src.SourceSpan>, padding: string = ' ') {
    return this.until(span?.collapse('end'), padding);
  }

  until(span: Optional<src.SourceSpan>, padding: string = ' ') {
    if (!span) return this;
    const offset = span.startPosition.column;
    this.#content += padding.repeat(offset - this.#offset - this.#startColumn);
    this.#offset = offset - this.#startColumn;
    return this;
  }

  toString(): string {
    return this.#content;
  }

  get line(): string {
    return `${this.#content}\n`;
  }
}

class LineRange implements Iterable<number> {
  static for(source: src.Source, start: number, end: number): LineRange {
    return new LineRange(source, start, end);
  }

  #source: src.Source;
  #start: number;
  #end: number;

  constructor(source: src.Source, start: number, end: number) {
    this.#source = source;
    this.#start = start;
    this.#end = end;
  }

  *[Symbol.iterator]() {
    for (let i = this.#start; i <= this.#end; i++) {
      yield i;
    }
  }

  get first(): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.#source.getLine(this.#start)!;
  }

  get last(): Optional<string> {
    return this.#source.getLine(this.#end);
  }

  get(lineno: number): Optional<string> {
    return this.#source.getLine(lineno);
  }

  get size() {
    return this.#end - this.#start + 1;
  }

  contains(pos: number): boolean {
    return pos >= this.#start && pos <= this.#end;
  }
}
