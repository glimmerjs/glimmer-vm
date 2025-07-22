import type { Nullable, Optional } from '@glimmer/interfaces';

import type * as src from './source/api';
import type * as ASTv1 from './v1/nodes-v1';
import type { ReportableContext } from './validation-context/validation-context';

import * as Validation from './validation-context/validation-context';

export class GlimmerSyntaxError extends SyntaxError {
  static highlight(error: Optional<string>, highlights: Validation.IntoHighlight, extra?: number) {
    return new GlimmerSyntaxError(
      error ?? `Syntax Error`,
      Validation.Highlight.from(highlights),
      extra
    );
  }

  static forErrorNode(node: ASTv1.ErrorNode, extra?: number) {
    return new GlimmerSyntaxError(node.message, node.highlight, extra);
  }

  readonly location: Nullable<src.SourceSpan>;
  readonly code: Nullable<string>;

  constructor(message: string, highlight: Validation.Highlight, extra?: number) {
    super(buildMessage(highlight, { error: message, extra }));
    const loc = highlight.primary.loc;
    this.location = loc;
    this.code = loc.asString();
  }
}

export function quoteReportable(context: ReportableContext): GlimmerSyntaxError {
  return GlimmerSyntaxError.highlight(context.message, context.highlights());
}

export function generateSyntaxError(
  message: string,
  location: Validation.IntoHighlightedSpan
): GlimmerSyntaxError {
  return GlimmerSyntaxError.highlight(message, Validation.Highlight.fromSpan(location));
}

function buildMessage(
  highlight: Validation.Highlight,
  options: { error: string; extra?: Optional<number> }
) {
  const loc = highlight.full;
  const module = loc.module;
  let { line, column } = highlight.primary.loc.startPosition;

  const quotedCode = highlightCode(highlight);
  const where = `(error occurred in '${module}' @ line ${line} : column ${column})`;

  const allNotes = [...highlight.notes];

  const message = options.extra ? `${options.error} (${options.extra} more errors)` : options.error;
  if (quotedCode || allNotes.length > 0) {
    return `${message}${quotedCode}${buildNotes(allNotes)}${where}`;
  } else {
    return `${message} ${where}`;
  }
}

/**
 * @deprecated Use `GlimmerSyntaxError.highlight` instead.
 */
export function syntaxError(message: string, highlight: Validation.Highlight): GlimmerSyntaxError {
  return GlimmerSyntaxError.highlight(message, highlight);
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
  const code = lines.forLine(highlight.startPosition.line).add(codeString.split('\n')[0]);

  const underline = new Underline(lines, highlighted).draw();
  return `\n\n${code}\n${underline}\n\n`;
}

interface Boxes {
  T: { bend: string; before: string; after: string };
  L: { bend: string; before: string; after: string };
  '|': string;
  '-': string;
}

const THIN: Boxes = {
  T: { bend: '┬', before: '─', after: '─' },
  L: { bend: '└', before: ' ', after: '─' },
  '|': '│',
  '-': '─',
};

const THICK: Boxes = {
  T: { bend: '┳', before: '━', after: '━' },
  L: { bend: '┗', before: ' ', after: '━' },
  '|': '┃',
  '-': '━',
};

type Label =
  | {
      type: Boxes;
      shape: keyof Boxes;
      span: src.SourceSpan;
    }
  | { type: 'blank'; span: src.SourceSpan }
  | {
      type: 'label';
      label: string;
    };

function thick(shape: keyof Boxes, span: Optional<src.SourceSpan>): Optional<Label> {
  return span ? { type: THICK, shape, span } : undefined;
}

function blank(span: Optional<src.SourceSpan>): Optional<Label> {
  return span ? { type: 'blank', span } : undefined;
}

function light(shape: keyof Boxes, span: Optional<src.SourceSpan>): Optional<Label> {
  return span ? { type: THIN, shape, span } : undefined;
}

function label(label: string): Label {
  return { type: 'label', label };
}

function labels(...labels: Optional<Label>[]): Label[] {
  return labels.filter((l) => !!l);
}

class Underline {
  #buffers: LineBuffers;
  #highlighted: Validation.Highlight;

  constructor(buffers: LineBuffers, highlighted: Validation.Highlight) {
    this.#buffers = buffers;
    this.#highlighted = highlighted;
  }

  #start() {
    const { primary, expanded } = this.#highlighted;

    return expanded?.loc ?? primary.loc;
  }

  #getLabels(): { line1: Label[]; line2?: Label[]; line3?: Label[] } | undefined {
    const { prefix, suffix, primary, expanded } = this.#highlighted;

    const hasPrimaryLabel = !!primary.label;
    const hasExpandedLabel = !!expanded?.label;

    if (hasPrimaryLabel && hasExpandedLabel) {
      if (prefix) {
        // If there's a prefix, then the error looks like:
        //
        // | prefixprimarysuffix
        // | ─┬────━┳━━━━━──────
        // |  │     ┗━━━━━━━━━━━ primary label
        // |  └───────────────── expanded label
        return {
          line1: labels(light('T', prefix), thick('T', primary.loc), light('-', suffix)),
          line2: labels(
            light('|', prefix),
            thick('L', primary.loc),
            thick('-', suffix),
            label(primary.label)
          ),
          line3: labels(
            light('L', prefix),
            light('-', primary.loc),
            light('-', suffix),
            label(expanded.label)
          ),
        };
      } else if (suffix) {
        // Otherwise, the error looks like:
        //
        // | primarysuffix
        // | ━┳━━━━━─┬────
        // |  ┃      └──── expanded label
        // |  ┗━━━━━━━━━━━ primary label
        return {
          line1: labels(thick('T', primary.loc), light('T', suffix)),
          line2: labels(thick('|', primary.loc), light('L', suffix), label(expanded.label)),
          line3: labels(thick('L', primary.loc), thick('-', suffix), label(primary.label)),
        };
      }
    }

    if (hasPrimaryLabel) {
      // If there's a primary label, then the label is on the next line
      //
      // | prefixprimarysuffix
      // | ──────━┳━━━━━──────
      // |        ┗━━━━━━━━━━━ primary label
      //
      // | primarysuffix
      // | ━┳━━━━━──────
      // |  ┗━━━━━━━━━━━ primary label
      //
      // | prefixprimary
      // | ──────━┳━━━━━
      // |        ┗━━━━━ primary label
      //
      // | primary
      // | ━┳━━━━━
      // |  ┗━━━━━ primary label
      return {
        line1: labels(light('-', prefix), thick('T', primary.loc), light('-', suffix)),
        line2: labels(
          blank(prefix),
          thick('L', primary.loc),
          thick('-', suffix),
          label(primary.label)
        ),
      };
    }

    return {
      line1: labels(light('-', prefix), thick('-', primary.loc), light('-', suffix)),
    };
  }

  draw() {
    const labels = this.#getLabels();

    if (!labels) {
      return '';
    }

    const { line1, line2, line3 } = labels;

    this.#line(line1);
    this.#line(line2);
    this.#line(line3);

    return this.#buffers.done();
  }

  #line(labels: Optional<Label[]>) {
    if (!labels) {
      return;
    }

    const line = this.#buffers.blank();

    const first = this.#start();

    line.until(first);

    for (const label of labels) {
      this.#label(line, label);
    }
  }

  #label(buffer: LineBuffer, label: Label) {
    if (label.type === 'blank') {
      buffer.untilEnd(label.span);
    } else if (label.type === 'label') {
      buffer.space().add(label.label);
    } else {
      if (label.shape === '-') {
        buffer.untilEnd(label.span, label.type['-']);
      } else {
        buffer.under(label.span, label.type, label.shape);
      }
    }
  }

  draw1() {
    const highlighted = this.#highlighted;
    const buffers = this.#buffers;
    const { primary, expanded, prefix, suffix } = highlighted;

    const end = (expanded ?? primary).loc;

    const line1 = buffers.blank();

    const primaryLabel = primary.label;
    const expandedLabel = expanded?.label;

    line1.underline(prefix, { label: !!expandedLabel, boxes: THIN });
    line1.until(primary.loc);
    line1.underline(primary.loc, { label: !!primaryLabel, boxes: THICK });
    line1.underline(suffix, { label: !!expandedLabel, boxes: THIN });

    const line2 = buffers.blank();

    line2.until(prefix);

    if (prefix && expandedLabel) {
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
      return buffers.done();
    }

    const line3 = buffers.blank();

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

    return buffers.done();
  }
}

class LineBuffers {
  #lines: number[];
  #buffers: LineBuffer[] = [];

  constructor(lines: number[]) {
    this.#lines = lines;
  }

  get #width() {
    return Math.max(...this.#lines.map((l) => String(l).length));
  }

  forLine(line: number) {
    return new LineBuffer(`${String(line).padStart(this.#width)} | `);
  }

  blank() {
    const buffer = new LineBuffer(`${' '.repeat(this.#width)} | `);
    this.#buffers.push(buffer);
    return buffer;
  }

  done() {
    return this.#buffers.map((l) => `${l}\n`).join('');
  }
}

class LineBuffer {
  #offset: number = 0;
  #content: string;

  constructor(gutter: string) {
    this.#content = gutter;
  }

  repeat(size: Optional<number>, repeat: string) {
    if (size === undefined) return this;
    return this.add(repeat.repeat(size));
  }

  under(span: src.SourceSpan, boxes: Boxes, shape: 'T' | 'L' | '|') {
    this.until(span);

    if (span.size === 0) {
      this.add(boxes['|']);
      // don't try to add anything else
      return this;
    }

    if (shape === '|') {
      if (span.size > 1) {
        this.space();
      }
      this.add(boxes['|']);
      this.untilEnd(span);
      return this;
    }

    if (span.size > 1) {
      this.add(boxes[shape].before);
    }

    this.add(boxes[shape].bend).untilEnd(span, boxes[shape].after);
    return this;
  }

  underline(span: Optional<src.SourceSpan>, { label, boxes }: { label: boolean; boxes: Boxes }) {
    if (!span) {
      return this;
    }

    this.until(span);
    if (label) {
      switch (span.size) {
        case 0:
          this.add(boxes['|']);
          // don't try to add anything else
          return this;
        case 1:
          this.add(boxes['T'].bend);
          break;
        default:
          this.add(boxes['-']).add(boxes['T'].bend);
      }
    }

    return this.untilEnd(span, '─');
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
    this.#content += padding.repeat(offset - this.#offset);
    this.#offset = offset;
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
