import type { Optional } from '@glimmer/interfaces';

import type { SourceSlice } from '../../source/slice';
import type { BlockSymbolTable, ProgramSymbolTable } from '../../symbol-table';
import type * as ASTv1 from '../../v1/api';
import type { ComponentArgs } from './args';
import type {
  ComponentArg,
  ElementModifier,
  HtmlOrSplatAttr,
  ResolvedElementModifier,
} from './attr-block';
import type { GlimmerParentNodeOptions } from './base';
import type { SimpleElementNode } from './content';
import type { BaseNodeFields } from './node';

import { SpanList } from '../../source/span-list';
import { ComponentNamedArguments, EmptyComponentArgs } from './args';
import { node } from './node';

/**
 * Corresponds to an entire template.
 */
export class Template extends node().fields<
  {
    table: ProgramSymbolTable;

    /**
     * Optionally, if the template ended abnormally, this field contains an "unexpected EOF" error.
     */
    error?: Optional<{
      eof?: Optional<ASTv1.ErrorNode>;
    }>;
  } & GlimmerParentNodeOptions
>() {}

/**
 * Represents a block. In principle this could be merged with `NamedBlock`, because all cases
 * involving blocks have at least a notional name.
 */
export class Block extends node().fields<
  { scope: BlockSymbolTable } & GlimmerParentNodeOptions
>() {}

export type ParentNode = Block | Template | SimpleElementNode;

/**
 * Corresponds to a collection of named blocks.
 */
export class NamedBlocks extends node().fields<{
  blocks: readonly (NamedBlock | ASTv1.ErrorNode)[];
}>() {
  /**
   * Get the `NamedBlock` for a given name.
   */
  get(name: 'default'): NamedBlock;
  get(name: string): NamedBlock | null;
  get(name: string): NamedBlock | null {
    return (
      this.blocks.filter(
        (block): block is NamedBlock => block.type === 'NamedBlock' && block.name.chars === name
      )[0] || null
    );
  }
}

export interface NamedBlockFields extends BaseNodeFields {
  name: SourceSlice;
  block: Block;

  // these are not currently supported, but are here for future expansion
  attrs: readonly HtmlOrSplatAttr[];
  componentArgs: readonly ComponentArg[];
  modifiers: readonly (ElementModifier | ResolvedElementModifier)[];
}

/**
 * Corresponds to a single named block. This is used for anonymous named blocks (`default` and
 * `else`).
 */
export class NamedBlock extends node('NamedBlock').fields<NamedBlockFields>() {
  get args(): ComponentArgs {
    let entries = this.componentArgs as ComponentArg[]; // cast to non-readonly

    return EmptyComponentArgs(
      ComponentNamedArguments(SpanList.range(entries, this.name.loc.collapse('end')), entries)
    );
  }

  get nameLoc() {
    return this.name.loc.withStart(this.name.loc.getStart().move(-1));
  }
}
