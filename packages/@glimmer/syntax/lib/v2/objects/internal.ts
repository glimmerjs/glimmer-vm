import { SourceOffsetList } from '../../source/offsets';
import { SourceSlice } from '../../source/slice';
import { BlockSymbolTable, ProgramSymbolTable } from '../../symbol-table';
import { Args, Named } from './args';
import { ComponentArg, ElementModifier, HtmlOrSplatAttr } from './attr-block';
import { BaseNodeFields, GlimmerParentNodeOptions, node } from './base';

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
        loc: SourceOffsetList.range(entries, this.name.loc.collapseEnd()),
        entries,
      })
    );
  }
}
