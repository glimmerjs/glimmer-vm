import type { ProgramSymbolTable , BlockSymbolTable } from '@glimmer/syntax';
import type { SourceSlice } from '../../source/slice';
import { SpanList } from '../../source/span-list';
import { Args, NamedArguments } from './args';
import type {
  ComponentArg as ComponentArgument,
  ElementModifier,
  HtmlOrSplatAttr as HtmlOrSplatAttribute,
} from './attr-block';
import type { ParentNodeFields } from './base';
import type { ContentNode } from './content';
import { type BaseNodeFields, AstNode } from './node';

/**
 * Corresponds to an entire template.
 */
export class Template extends AstNode implements ParentNodeFields {
  readonly type = 'Template';
  declare table: ProgramSymbolTable;
  declare body: readonly ContentNode[];
}

/**
 * Represents a block. In principle this could be merged with `NamedBlock`, because all cases
 * involving blocks have at least a notional name.
 */
export class Block extends AstNode implements ParentNodeFields {
  readonly type = 'Block';
  declare scope: BlockSymbolTable;
  declare body: readonly ContentNode[];
}

/**
 * Corresponds to a collection of named blocks.
 */
export class NamedBlocks extends AstNode {
  readonly type = 'NamedBlocks';

  declare blocks: readonly NamedBlock[];

  /**
   * Get the `NamedBlock` for a given name.
   */
  get(name: 'default'): NamedBlock;
  get(name: string): NamedBlock | null;
  get(name: string): NamedBlock | null {
    return this.blocks.find((block) => block.name.chars === name) || null;
  }
}

export interface NamedBlockFields extends BaseNodeFields {
  name: SourceSlice;
  block: Block;

  // these are not currently supported, but are here for future expansion
  attrs: readonly HtmlOrSplatAttribute[];
  componentArgs: readonly ComponentArgument[];
  modifiers: readonly ElementModifier[];
}

/**
 * Corresponds to a single named block. This is used for anonymous named blocks (`default` and
 * `else`).
 */
export class NamedBlock extends AstNode implements NamedBlockFields {
  readonly type = 'NamedBlock';
  declare name: SourceSlice<string>;
  declare block: Block;
  declare attrs: readonly HtmlOrSplatAttribute[];
  declare componentArgs: readonly ComponentArgument[];
  declare modifiers: readonly ElementModifier[];

  get args(): Args {
    let entries = this.componentArgs.map((a) => a.toNamedArgument());

    return Args.named(
      NamedArguments.of({
        loc: SpanList.range(entries, this.name.loc.collapse('end')),
        entries,
      })
    );
  }
}
