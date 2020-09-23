import { loadSourceOffsets, SerializedSourceOffsets } from './offsets';
import { SourceOffsets } from './offsets/abstract';
import { InvisibleSourceOffsets } from './offsets/invisible';
import { Source } from './source';

export type SerializedSourceSlice<Chars extends string = string> = [
  chars: Chars,
  offsets: SerializedSourceOffsets
];

export class SourceSlice<Chars extends string = string> {
  static synthetic<S extends string>(chars: S): SourceSlice<S> {
    let offsets = InvisibleSourceOffsets.synthetic(chars);
    return new SourceSlice({ loc: offsets, chars: chars });
  }

  static load(source: Source, slice: SerializedSourceSlice): SourceSlice {
    return new SourceSlice({
      loc: loadSourceOffsets(source, slice[1]),
      chars: slice[0],
    });
  }

  readonly chars: Chars;
  readonly loc: SourceOffsets;

  constructor(options: { loc: SourceOffsets; chars: Chars }) {
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
