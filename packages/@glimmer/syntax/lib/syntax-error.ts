import type { Optional } from '@glimmer/interfaces';

import type * as src from './source/api';
import type * as Validation from './validation-context/validation-context';
import type { Highlights, ReportableContext } from './validation-context/validation-context';

export interface GlimmerSyntaxError extends Error {
  location: src.SourceSpan | null;
  code: string | null;
}

export function unresolvedBindingError({
  context,
  notes = [],
}: {
  context: ReportableContext;
  notes?: string[] | undefined;
}): GlimmerSyntaxError {
  const loc = context.loc;
  const module = loc.module;
  let { line, column } = loc.startPosition;

  const quotedCode = quoteReportable(context);
  const where = `(error occurred in '${module}' @ line ${line} : column ${column})`;

  let message: string;

  const allNotes = [...context.notes, ...notes];

  if (quotedCode || allNotes.length > 0) {
    const notesString =
      allNotes.length > 0 ? `${allNotes.map((n) => `NOTE: ${n}`).join('\n\n')}\n\n` : '';
    message = `${context.error}${quotedCode}${notesString}${where}`;
  } else {
    message = `${context.error} ${where}`;
  }

  const code = loc.asString();

  let error = new Error(message) as GlimmerSyntaxError;

  error.name = 'SyntaxError';
  error.location = loc;
  error.code = code;

  return error;
}

export function invalidExprError(context: Validation.CustomErrorContext): GlimmerSyntaxError {
  const { loc, notes } = context;
  const module = loc.module;
  let { line, column } = loc.startPosition;

  const quotedCode = quoteReportable(context);
  const where = `(error occurred in '${module}' @ line ${line} : column ${column})`;

  let message: string;

  if (quotedCode || notes.length > 0) {
    const notesString =
      notes.length > 0 ? `${notes.map((n) => `NOTE: ${n}`).join('\n\n')}\n\n` : '';
    message = `${context.error}:${quotedCode}${notesString}${where}`;
  } else {
    message = `${context.error}: ${where}`;
  }

  const code = loc.asString();

  let error = new Error(message) as GlimmerSyntaxError;

  error.name = 'SyntaxError';
  error.location = loc;
  error.code = code;

  return error;
}

export function generateSyntaxError(message: string, location: src.SourceSpan): GlimmerSyntaxError {
  let { module, loc } = location;
  let { line, column } = loc.start;

  let code = location.asString();

  let quotedCode = simpleQuote(location);

  let error = new Error(
    `${message}: ${quotedCode}(error occurred in '${module}' @ line ${line} : column ${column})`
  ) as GlimmerSyntaxError;

  error.name = 'SyntaxError';
  error.location = location;
  error.code = code;

  return error;
}

function quoteReportable(validation: ReportableContext): string {
  const highlights = validation.highlights();
  const { primary, expanded } = highlights;
  const highlight = expanded?.loc ?? primary.loc;

  const fullContext = validation.context;

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
    .add(codeString);

  const underline = drawUnderline(lines, highlights);
  return `\n\n${code}\n${underline}\n\n`;
}

function simpleQuote(location: src.SourceSpan) {
  const code = location.asString();
  return code ? `\n\n|\n|  ${code.split('\n').join('\n|  ')}\n|\n\n` : '';
}

interface HighlightPosition {
  highlight: {
    label: string;
    start: number;
    end: number;
  };
  chars: string;
}

interface PrimaryHighlightPosition extends HighlightPosition {
  under: [string, string];
}

interface ExpandedHighlightPosition extends HighlightPosition {
  under: string;
}

interface HighlightPositions {
  primary: PrimaryHighlightPosition;
  expanded?: ExpandedHighlightPosition;
}

function positions({ primary, expanded }: Highlights): HighlightPositions {
  const primaryPosition: PrimaryHighlightPosition = {
    highlight: primary,
    chars: primary.size === 1 ? '┳' : `━┳${'━'.repeat(primary.size - 2)}`,
    under: primary.size === 1 ? ['┃', '┗'] : [' ┃', ' ┗'],
  };

  if (!expanded) return { primary: primaryPosition };

  const under = `${' '.repeat(Math.min(1, expanded.size - 1))}└`;
  const chars = `${'─'.repeat(Math.min(1, expanded.size - 1))}┬${'─'.repeat(Math.max(0, expanded.size - 2))}`;

  const expandedPosition: ExpandedHighlightPosition = {
    highlight: expanded,
    chars,
    under,
  };

  return { primary: primaryPosition, expanded: expandedPosition };
}

function drawUnderline(buffers: LineBuffers, highlight: Highlights) {
  const { primary, expanded } = positions(highlight);

  const full = highlight.full;

  const line1 = buffers
    .blank(full.startPosition.column)
    .until(primary.highlight.start, ' ')
    .add(primary.chars)
    .add(expanded?.chars);

  const line2 = buffers.blank(full.startPosition.column);

  if (expanded && highlight.expanded) {
    line2
      .until(primary.highlight.start, ' ')
      .add(primary.under[0])
      .until(expanded.highlight.start, ' ')
      .add(expanded.under)
      .until(Math.max(primary.highlight.end, expanded.highlight.end), '─')
      .space()
      .add(expanded.highlight.label);
    const line3 = buffers
      .blank(full.startPosition.column)
      .until(primary.highlight.start, ' ')
      .add(primary.under[1])
      .until(Math.max(primary.highlight.end, expanded.highlight.end), '━')
      .space()
      .add(primary.highlight.label);
    return `${line1}\n${line2}\n${line3}\n`;
  } else {
    line2
      .until(primary.highlight.start, ' ')
      .add(primary.under[1])
      .until(Math.max(primary.highlight.end), '━')
      .space()
      .add(highlight.primary.label);
  }

  return `${line1}\n${line2}\n`;
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

  until(offset: number, padding: string) {
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

  get(line: number): Optional<string> {
    return this.#source.getLine(line);
  }

  get size() {
    return this.#end - this.#start + 1;
  }

  contains(pos: number): boolean {
    return pos >= this.#start && pos <= this.#end;
  }
}
