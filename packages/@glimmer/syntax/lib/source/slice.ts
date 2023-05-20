import * as source_ from './api';

export type SerializedSourceSlice<Chars extends string = string> = [
  chars: Chars,
  span: source_.SerializedSourceSpan
];

export class SourceSlice<Chars extends string = string> {
  static synthetic<S extends string>(chars: S): SourceSlice<S> {
    let offsets = source_.SourceSpan.synthetic(chars);
    return new SourceSlice({ loc: offsets, chars: chars });
  }

  static load(source: source_.Source, slice: SerializedSourceSlice): SourceSlice {
    return new SourceSlice({
      loc: source_.SourceSpan.load(source, slice[1]),
      chars: slice[0],
    });
  }

  readonly chars: Chars;
  readonly loc: source_.SourceSpan;

  constructor(options: { loc: source_.SourceSpan; chars: Chars }) {
    this.loc = options.loc;
    this.chars = options.chars;
  }

  getString(): string {
    return this.chars;
  }

  serialize(): SerializedSourceSlice<Chars> {
    return [this.chars, this.loc.serialize()];
  }
}
