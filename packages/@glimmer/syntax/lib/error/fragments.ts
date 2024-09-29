import { WriteOutput } from './buffer';
import type { Theme } from './theme';
import type { IThemeCharacters, SymbolicChars } from './types';

export interface Fragment {
  write: (buffer: WriteOutput, theme: Theme) => void;
}

export class Char {
  static of(char: keyof SymbolicChars) {
    return new Char(char);
  }

  #char: keyof SymbolicChars;
  private constructor(char: keyof SymbolicChars) {
    this.#char = char;
  }

  write(buffer: WriteOutput, theme: Theme) {
    buffer.raw(theme.char(this.#char));
  }
}

export class Text {
  static of(text: string) {
    return new Text(text);
  }

  #text: string;
  constructor(text: string) {
    this.#text = text;
  }

  write(buffer: WriteOutput, theme: Theme) {
    buffer.raw(this.#text);
  }
}
