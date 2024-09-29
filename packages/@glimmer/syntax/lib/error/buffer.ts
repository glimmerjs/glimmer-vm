import type { Nullable } from '@glimmer/interfaces';
import type * as src from '../source/api';
import { assert, expect, unwrap } from '@glimmer/util';
import type { Theme } from './theme';

interface OutputBufferOptions {
  theme: Theme;
  write: (str: string) => void;
  format?: FormatOptions;
}

interface FormatOptions {
  header?: (span: src.SourceSpan) => string;
}

interface OutputBufferWrite {
  /**
   * Write a header line based on the buffer's source span. Optionally, you can pass
   * a formatting function that takes the source span and returns a string. By default,
   * the formatting string is `${moduleName}:${line}:${column}`.
   */
  header: (format?: (span: src.SourceSpan) => string) => void;

  footer: (message: string) => void;

  raw: {
    (...strings: string[]): void;
    line: (...strings: string[]) => void;
  };

  gutter: {
    lineno: (str: string) => void;
    annotation: () => void;
    empty: () => void;
  };
}

type OutputCursor =
  | { type: 'header' }
  | { type: 'gutter' }
  | { type: 'source'; column: number }
  | { type: 'annotation'; column: number };

type OutputCursorArgs = {
  [T in OutputCursor['type']]: T extends { column: number } ? [type: T, column: number] : [type: T];
};

class BufferState {
  #sourceCursor: Nullable<{ line: number; column: number }> = null;
  #outputCursor: OutputCursor = { type: 'header' };

  assert(type: OutputCursor['type']) {
    assert(this.#outputCursor.type === type, `Expected the cursor to be in the ${type} state`);
  }

  toHeader(): void {
    this.#outputCursor = { type: 'header' };
  }

  toGutter(): void {
    this.#outputCursor = { type: 'gutter' };
  }

  toSource(column: number): void {
    this.#outputCursor = { type: 'source', column };
  }

  toAnnotation(column: number): void {
    this.#outputCursor = { type: 'annotation', column };
  }
}

export class WriteOutput implements OutputBufferWrite {
  #theme: Theme;
  #writeToUserBuffer: (str: string) => void;
  #state: BufferState = new BufferState();
  #span: src.SourceSpan;
  #format: NormalizedFormatOptions;
  #cache: {
    lineWidth: number;
  };

  readonly raw: { (...strings: string[]): void; line: (...strings: string[]) => void };

  constructor({
    write: userWrite,
    span,
    theme,
    format,
  }: OutputBufferOptions & { span: src.SourceSpan }) {
    this.#writeToUserBuffer = userWrite;
    this.#span = span;
    this.#theme = theme;
    this.#format = formatOptions(format);

    this.#cache = { lineWidth: String(span.endPosition.line).length + 1 };

    const raw = (...strings: string[]) => {
      this.#writeRaw(...strings);
    };

    raw.line = (...strings: string[]) => {
      this.#writeRaw(...strings, '\n');
    };

    this.raw = raw;
  }

  header(): void {
    this.#state.assert('header');
    this.#emptyGutter();
    this.#writeRaw(
      this.#theme.char('╭'),
      this.#theme.char('─.line').repeat(3),
      this.#theme.char('['),
      this.#format.header(this.#span),
      this.#theme.char(']') + '\n'
    );
    this.#state.toGutter();
  }

  footer(message: string): void {
    this.#emptyGutter();
    this.#writeRaw(this.#theme.char('╰'), this.#theme.char('─.line').repeat(3), '\n');
    this.#writeRaw(this.#theme.style.error('Error:'), ' ', message);
  }

  source(line: string): void {
    this.#state.assert('source');
    this.#writeRaw(this.#padGutter(line), '\n');
    this.#state.toGutter();
  }

  gutter = {
    lineno: (str: string) => {
      this.#state.assert('gutter');
      this.#writeRaw(this.#padGutter(str), this.#theme.char('│'), this.#theme.char('space'));
      this.#state.toSource(0);
    },

    annotation: () => {
      this.#state.assert('gutter');
      this.#writeRaw(
        this.#padGutter(this.#theme.char('·')),
        this.#theme.char('│'),
        this.#theme.char('space')
      );
      this.#state.toSource(0);
    },

    empty: () => {
      this.#state.assert('gutter');
      this.#writeRaw(this.#padGutter());
    },
  };

  #emptyGutter(): void {
    this.#writeToUserBuffer(this.#theme.char('space').repeat(this.#cache.lineWidth));
  }

  #writeRaw(...strings: string[]) {
    for (const str of strings) {
      this.#writeToUserBuffer(str);
    }
  }

  #padGutter(str = '') {
    return `${str.padEnd(this.#cache.lineWidth, this.#theme.char('space'))}`;
  }
}

interface NormalizedFormatOptions {
  header: (span: src.SourceSpan) => string;
}

function formatOptions(options: FormatOptions = {}): NormalizedFormatOptions {
  return {
    header:
      options.header ??
      ((span) => `${span.module}:${span.startPosition.line}:${span.startPosition.column}`),
  };
}
