import { SerializedSourceOffsets, SourceOffsets } from '../../source/offsets';
import { Source } from '../../source/source';
import { BlockSymbolTable, ProgramSymbolTable } from '../../symbol-table';
import { Args, Named } from './args';
import { ComponentArg, ElementModifier, HtmlOrSplatAttr } from './attr-block';
import { BaseNodeFields, GlimmerParentNodeOptions, node } from './base';

export type SerializedSourceSlice<Chars extends string = string> = [
  chars: Chars,
  offsets: SerializedSourceOffsets
];

export class SourceSlice<Chars extends string = string> {
  static load(source: Source, slice: SerializedSourceSlice): SourceSlice {
    return new SourceSlice({
      loc: SourceOffsets.load(source, slice[1]),
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

export class Template extends node().fields<
  {
    table: ProgramSymbolTable;
  } & GlimmerParentNodeOptions
>() {}

export class Block extends node().fields<
  { table: BlockSymbolTable } & GlimmerParentNodeOptions
>() {}

export class NamedBlocks extends node().fields<{ blocks: readonly NamedBlock[] }>() {
  get(name: 'default'): NamedBlock;
  get(name: string): NamedBlock | null;
  get(name: string): NamedBlock | null {
    return this.blocks.find((block) => block.name.chars === name) || null;
  }
}

export interface NamedBlockOptions extends BaseNodeFields {
  name: SourceSlice;
  block: Block;

  // these are not currently supported, but are here for future expansion
  attrs: readonly HtmlOrSplatAttr[];
  componentArgs: readonly ComponentArg[];
  modifiers: readonly ElementModifier[];
}

export class NamedBlock extends node().fields<NamedBlockOptions>() {
  get args(): Args {
    let entries = this.componentArgs.map((a) => a.toNamedEntry());

    return Args.named(
      new Named({
        loc: this.loc.src.offsetList(entries.map((e) => e.loc)).getRangeOffset(),
        entries,
      })
    );
  }
}
