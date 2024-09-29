import type { CollapsedPartition, IThemeCharacters, SingleLinePartition } from './error/types';
import type * as src from './source/api';
import { ThemeStyle } from './error/theme';
import { partitionLines, startLine } from './error/utils';
import { OutputBuffer } from './syntax-error';

export class SnippetRenderer {
  readonly #source: src.Source;
  readonly #span: src.SourceSpan;
  readonly #message: string;
  readonly #theme: IThemeCharacters;
  #buffer: OutputBuffer;

  #cache: { linenoWidth: number };

  constructor({
    source,
    span,
    buffer,
    message,
    theme,
  }: {
    source: src.Source;
    span: src.SourceSpan;
    message: string;
    buffer: OutputBuffer;
    theme: IThemeCharacters;
  }) {
    this.#source = source;
    this.#span = span;
    this.#message = message;
    this.#buffer = buffer;
    this.#theme = theme;

    this.#cache = {
      linenoWidth: String(span.endPosition.line).length,
    };
  }

  render() {
    this.header();

    const { start, end } = this.#span.loc;
    this.line(start.line, this.#source.getLine(start.line)!);
    this.lineGutter();

    const lines = partitionLines(this.#span, this.#source);

    switch (lines.type) {
      case 'single': {
        this.underline(lines);
        break;
      }

      case 'multi': {
        this.multiline(lines);
        break;
      }
    }

    // if (isMultiline(this.#span)) {
    //   this.multilineUnderline(this.#span);
    // } else {
    //   this.underline(this.#span);
    //   this.lineGutter();
    //   this.annotate(this.#span, 'here');
    // }
    this.footer();
  }

  header() {
    const theme = this.#theme;
    const { start, end } = this.#span.loc;

    this.lineGutter('');
    this.#writeln(
      `${theme.ltop}${theme.hbar.repeat(this.#cache.linenoWidth + 3)}${theme.lbox}${
        this.#span.module
      }:${start.line}:${start.column}${theme.rbox}`
    );
  }

  footer() {
    this.lineGutter('');
    this.#writeln(this.#theme.lbot + this.#theme.hbar.repeat(this.#cache.linenoWidth + 3));
    this.#writeln('');
    this.#write(ThemeStyle.error(this.#message));
  }

  #write(str: string) {
    this.#buffer.write(str);
  }

  #writeln(str: string) {
    this.#write(`${str}\n`);
  }

  lineGutter(lineno: number | 'break' | '') {
    this.#write(
      `${this.#lineAnnotation(lineno).padEnd(this.#cache.linenoWidth, ' ')} ${this.#theme.vbar} `
    );
  }

  #lineAnnotation(gutter: number | 'break' | '') {
    if (gutter === 'break') {
      return this.#theme.vbar_break;
    } else if (gutter === undefined) {
      return '';
    } else {
      return String(gutter);
    }
  }

  line(lineno: number, line: string) {
    this.#write(`${lineno} ${this.#theme.vbar} ${line}\n`);
  }

  lines(lineno: number, lines: string[]) {
    lines.forEach((line) => this.line(lineno++, line));
  }

  multilineUnderline(span: src.SourceSpan) {
    const start = span.startPosition.column;
    const end = span.endPosition.column;
    this.#writeln(
      `${this.#theme.vbar_break} ${' '.repeat(start)}${this.#theme.hbar.repeat(end - start)}`
    );
    this.lineGutter('');
  }

  collapsed(line: CollapsedPartition) {
    const span = line.at;
    const start = span.startPosition.column;
    this.#write(`${this.#theme.vbar_break} ${' '.repeat(start)}`);

    this.#writeln(this.#theme.uarrow);

    this.lineGutter(line.at.startPosition.line);
    this.annotate(span, 'here');
  }

  // assumes single line
  underline(line: SingleLinePartition) {
    const span = line.at;
    const start = span.startPosition.column;
    const end = span.endPosition.column;
    this.#write(`${this.#theme.vbar_break} ${' '.repeat(start)}`);

    const size = span.endPosition.column - span.startPosition.column;

    if (end - start === 1) {
      this.#writeln(this.#theme.underbar);
    } else {
      this.#writeln(
        `${this.#theme.hbar}${this.#theme.underbar}${this.#theme.hbar.repeat(size - 2)}`
      );
    }

    this.lineGutter(startLine(span));
    this.annotate(span, 'here');

    // this.#writeln(
    //   `${this.#theme.vbar_break} ${' '.repeat(start)}${this.#theme.hbar}${this.#theme.underbar}`
    // );
    // if (end - start >= 2) {
    // }
  }

  annotate(span: src.SourceSpan, message: string) {
    const start = span.startPosition.column;
    const end = span.endPosition.column;
    const size = end - start;

    this.#write(this.#theme.vbar_break);
    this.#write(' '.repeat(start));

    if (size > 1) {
      this.#write(' ');
    }

    this.#writeln(`${this.#theme.lbot}${this.#theme.hbar.repeat(2)} ${message}`);
  }
}
