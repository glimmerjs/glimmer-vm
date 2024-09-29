import { OutputBuffer } from './buffer';
import { startLine } from './utils';
import { SingleLinePartition } from './types';
import type { IThemeCharacters } from './types';
import type * as src from '../source/api';

class RenderState {
  #buffer: OutputBuffer;
  #theme: IThemeCharacters;
  #column = 0;

  constructor({ buffer, theme }: { buffer: OutputBuffer; theme: IThemeCharacters }) {
    this.#buffer = buffer;
    this.#theme = theme;
  }

  write(...outputs: Output[]) {
    for (const output of outputs) {
      if (Array.isArray(output)) {
        this.write(...output);
      } else if (typeof output === 'string') {
        this.#buffer.#write(output);
      } else {
        this.#buffer.#write(output.char);
      }
    }
  }

  writeln(...outputs: Output[]) {
    this.write(...outputs);
    this.#buffer.#write('\n');
  }

  char(char: keyof IThemeCharacters) {
    this.#buffer.#write(this.#theme[char]);
  }

  get theme() {
    return this.#theme;
  }
}

class Char {
  static of(char: keyof IThemeCharacters) {
    return new Char(char);
  }

  #char: keyof IThemeCharacters;

  constructor(char: keyof IThemeCharacters) {
    this.#char = char;
  }

  repeat(n: number): Output[] {
    return new Array(n).fill(this);
  }

  get char() {
    return this.#char;
  }
}

export const chars = {
  hbar: Char.of('hbar'),
  vbar: Char.of('vbar'),
  xbar: Char.of('xbar'),
  vbar_break: Char.of('vbar_break'),
  uarrow: Char.of('uarrow'),
  rarrow: Char.of('rarrow'),
  ltop: Char.of('ltop'),
  mtop: Char.of('mtop'),
  rtop: Char.of('rtop'),
  lbot: Char.of('lbot'),
  mbot: Char.of('mbot'),
  rbot: Char.of('rbot'),
  lbox: Char.of('lbox'),
  rbox: Char.of('rbox'),
  lcross: Char.of('lcross'),
  rcross: Char.of('rcross'),
  underbar: Char.of('underbar'),
  underline: Char.of('underline'),
  fyi: Char.of('fyi'),
  x: Char.of('x'),
  warning: Char.of('warning'),
  point_right: Char.of('point_right'),
  line_break: Char.of('line_break'),
  space: Char.of('space'),
};

export function outputs(strings: TemplateStringsArray, ...values: (Output | Output[])[]) {
  let result: Output[] = [];

  strings.forEach((str, i) => {
    result.push(str);
    const output = values[i];

    if (Array.isArray(output)) {
      result.push(...output);
    } else if (typeof output === 'string') {
      result.push(output);
    }
  });

  return result;
}

type Output = string | Char;

class RenderSingleLine {
  #theme: IThemeCharacters;
  #buffer: OutputBuffer;
  #line: SingleLinePartition;

  constructor({
    theme,
    buffer,
    line,
  }: {
    theme: IThemeCharacters;
    buffer: OutputBuffer;
    line: SingleLinePartition;
  }) {
    this.#theme = theme;
    this.#buffer = buffer;
    this.#line = line;
  }

  underline(line: SingleLinePartition) {
    const span = line.at;
    const start = span.startPosition.column;
    const end = span.endPosition.column;
    this.#buffer.#write(`${this.#theme.vbar_break} ${' '.repeat(start)}`);

    const size = span.endPosition.column - span.startPosition.column;

    if (end - start === 1) {
      this.#buffer.writeln(this.#theme.underbar);
    } else {
      this.#buffer.writeln(
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
}
