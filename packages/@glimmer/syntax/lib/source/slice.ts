import * as src from './api';

export type SerializedSourceSlice<Chars extends string = string> = [
  chars: Chars,
  span: src.SerializedSourceSpan,
];

export class SourceSlice<Chars extends string = string> {
  static synthetic<S extends string>(chars: S): SourceSlice<S> {
    let offsets = src.SourceSpan.synthetic(chars);
    return new SourceSlice({ loc: offsets, chars: chars });
  }

  static load(source: src.Source, slice: SerializedSourceSlice): SourceSlice {
    return new SourceSlice({
      loc: src.SourceSpan.load(source, slice[1]),
      chars: slice[0],
    });
  }

  static keyword(name: string, loc: src.SourceSpan): SourceSlice {
    return new SourceSlice({ loc, chars: name });
  }

  readonly chars: Chars;
  readonly loc: src.SourceSpan;

  constructor(options: { loc: src.SourceSpan; chars: Chars }) {
    this.loc = options.loc;
    this.chars = options.chars;
  }

  getString(): string {
    return this.chars;
  }

  /**
   * A source slice is "rewritten" if its location does not match its string representation. This
   * means that an AST transformation may have changed the string representation of the slice.
   *
   * When printing error messages, we want to highlight the original slice in the user's source
   * code, but we also want to communicate the _semantic_ string to the user because that's what
   * caused the error.
   *
   * For example, if the user typed `{{#portal}}` and an AST transformation rewrote that to
   * `{{#in-element}}`, and there's an error with the `#in-element` syntax, we need to report the
   * error to the user by highlighting the `portal` in their source, but we also want to tell the
   * user that the syntax error was a problem with the expanded `#in-element` syntax.
   */
  get isRewrite(): boolean {
    return this.loc.asString() !== this.chars;
  }

  serialize(): SerializedSourceSlice<Chars> {
    return [this.chars, this.loc.serialize()];
  }
}
