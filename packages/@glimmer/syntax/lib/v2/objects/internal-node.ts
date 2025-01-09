import type { SourceSlice } from '../../source/slice';
import type { BlockSymbolTable, ProgramSymbolTable } from '../../symbol-table';
import type { ComponentArg, ElementModifier, HtmlOrSplatAttr } from './attr-block';
import type { GlimmerParentNodeOptions } from './base';
import type { BaseNodeFields, NodeConstructor } from './node';

import { SpanList } from '../../source/span-list';
import { Args, NamedArguments } from './args';
import { AstNode } from './node';

/**
 * Corresponds to an entire template.
 */
export const TemplateFields: NodeConstructor<
  'Template',
  { table: ProgramSymbolTable } & GlimmerParentNodeOptions
> = AstNode('Template');
export class Template extends TemplateFields {}

/**
 * Represents a block. In principle this could be merged with `NamedBlock`, because all cases
 * involving blocks have at least a notional name.
 */
export const BlockFields: NodeConstructor<
  'Block',
  { scope: BlockSymbolTable } & GlimmerParentNodeOptions
> = AstNode('Block');
export class Block extends BlockFields {}

/**
 * Corresponds to a collection of named blocks.
 */
export const NamedBlocksFields: NodeConstructor<'NamedBlocks', { blocks: readonly NamedBlock[] }> =
  AstNode('NamedBlocks');
export class NamedBlocks extends NamedBlocksFields {
  /**
   * Get the `NamedBlock` for a given name.
   */
  get(name: 'default'): NamedBlock;
  get(name: string): NamedBlock | null;
  get(name: string): NamedBlock | null {
    return this.blocks.filter((block) => block.name.chars === name)[0] || null;
  }
}

export interface NamedBlockFields extends BaseNodeFields {
  name: SourceSlice;
  block: Block;

  // these are not currently supported, but are here for future expansion
  attrs: readonly HtmlOrSplatAttr[];
  componentArgs: readonly ComponentArg[];
  modifiers: readonly ElementModifier[];
}

/**
 * Corresponds to a single named block. This is used for anonymous named blocks (`default` and
 * `else`).
 */
export const NamedBlockFields: NodeConstructor<'NamedBlock', NamedBlockFields> =
  AstNode('NamedBlock');

export class NamedBlock extends NamedBlockFields {
  get args(): Args {
    let entries = this.componentArgs.map((a) => a.toNamedArgument());

    return Args.named(
      new NamedArguments({
        loc: SpanList.range(entries, this.name.loc.collapse('end')),
        entries,
      })
    );
  }
}
