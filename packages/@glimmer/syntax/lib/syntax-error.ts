import type { Optional } from '@glimmer/interfaces';

import type * as src from './source/api';
import type * as ASTv1 from './v1/nodes-v1';
import type { ReportableContext } from './validation-context/validation-context';

import * as Validation from './validation-context/validation-context';

export interface GlimmerSyntaxError extends Error {
  location: src.SourceSpan | null;
  code: string | null;
}

export function quoteReportable(context: ReportableContext): GlimmerSyntaxError {
  return highlightedError(context.highlights(), { error: context.error, notes: context.notes });
}

export function generateSyntaxError(
  message: string,
  location: Validation.IntoHighlightedSpan,
  options?: { full?: Optional<src.SourceSpan> }
): GlimmerSyntaxError {
  return highlightedError(Validation.Highlight.fromSpan(location, { full: options?.full }), {
    error: message,
  });
}

export function highlightAstError(error: ASTv1.ErrorNode) {
  return highlightedError(error.highlight, { error: error.message, notes: error.notes });
}

export function highlightedError(
  highlights: Validation.IntoHighlight,
  options: { error: string; notes?: Optional<string[]> }
): GlimmerSyntaxError {
  const highlight = Validation.Highlight.from(highlights);
  return syntaxError(highlight, options);
}

export function syntaxError(
  highlight: Validation.Highlight,
  options: { error: string; notes?: Optional<string[]> }
): GlimmerSyntaxError {
  const loc = highlight.full;
  const module = loc.module;
  let { line, column } = highlight.primary.loc.startPosition;

  const quotedCode = highlightCode(highlight);
  const where = `(error occurred in '${module}' @ line ${line} : column ${column})`;

  let message: string;

  const allNotes = [...(options.notes ?? [])];

  if (quotedCode || allNotes.length > 0) {
    message = `${options.error}${quotedCode}${buildNotes(allNotes)}${where}`;
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

function buildNotes(notes: string[]): string {
  if (notes.length === 0) {
    return '';
  }

  return notes.map((n) => buildNote(n)).join('\n\n') + '\n\n';
}

function buildNote(note: string): string {
  const [first, ...rest] = note.split('\n');
  const pad = ' '.repeat('NOTE: '.length);

  return `NOTE: ${first}\n${rest.map((n) => `${pad}${n}\n`).join('')}`;
}

export function highlightCode(highlighted: Validation.Highlight): string {
  const { primary, expanded } = highlighted;
  const highlight = expanded?.loc ?? primary.loc;

  const fullContext = highlighted.full;

  const fullLines = fullContext.fullLines();
  const codeString = fullLines.asString();

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

function drawUnderline(buffers: LineBuffers, highlighted: Validation.Highlight) {
  const { primary, expanded, prefix, suffix } = highlighted;

  const full = highlighted.full.fullLines();

  const lines = [];

  const end = (expanded ?? primary).loc;

  const line1 = buffers.blank(full.startPosition.column);
  lines.push(line1);

  const primaryLabel = primary.label;
  const expandedLabel = expanded?.label;

  if (prefix) {
    line1.until(prefix);
    if (expandedLabel) line1.add(expanded.size === 1 ? '┬' : `─┬`);
    line1.until(primary.loc, '─');
  }

  line1.until(primary.loc);

  if (primaryLabel) {
    line1.add(primary.size === 1 ? '┳' : `━┳`);
  }

  line1.untilEnd(primary.loc, '━');

  if (suffix) {
    if (!prefix && expandedLabel) line1.add(suffix.size <= 2 ? '┬' : `─┬`);
    line1.untilEnd(suffix, '─');
  }

  const line2 = buffers.blank(full.startPosition.column);
  lines.push(line2);

  if (prefix && expandedLabel) {
    line2.until(prefix);
    if (primaryLabel) {
      // If there's a primary label, then the label is on the next line
      line2.add(prefix.size === 1 ? '│' : ' │');
    } else {
      // Otherwise, it's on this line
      line2.add(prefix.size === 1 ? '└' : ' └');
      line2.untilEnd(end, '─').space().add(expandedLabel);
    }
  }

  if (primaryLabel) {
    line2.until(primary.loc);
    if (!prefix && expandedLabel) {
      // In this case, the expanded label is on this line, next to the suffix, so the primary is on
      // the next line.
      line2.add(primary.size === 1 ? '┃' : ' ┃');
    } else {
      // In this case, the primary label is on this line
      line2
        .add(primary.size === 1 ? '┗' : ' ┗')
        .untilEnd(end, '━')
        .space()
        .add(primaryLabel);
    }
  }

  if (!prefix && suffix && expandedLabel) {
    line2.until(suffix);
    line2.add(suffix.size <= 2 ? '└' : ' └');
    line2.untilEnd(end, '─').space().add(expandedLabel);
  }

  if (!(primaryLabel && expandedLabel)) {
    return lines.map((l) => `${l}\n`).join('');
  }

  const line3 = buffers.blank(full.startPosition.column);
  lines.push(line3);

  if (prefix && expandedLabel) {
    line3.until(prefix);
    line3.add(prefix.size === 1 ? '└' : ' └');
    line3.untilEnd(end, '─').space().add(expandedLabel);
  } else if (primaryLabel) {
    line3.until(primary.loc);
    if (!prefix && expandedLabel) {
      // In this case, the expanded label is on this line, next to the suffix, so the primary is on
      // the next line.
      line3
        .add(primary.size === 1 ? '┗' : ' ┗')
        .untilEnd(end, '━')
        .space()
        .add(primaryLabel);
    }
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

  add(string: Optional<string>): this {
    if (string === undefined) return this;
    this.#content += string;
    this.#offset += string.length;
    return this;
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
