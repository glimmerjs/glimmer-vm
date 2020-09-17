import { BlockSymbolTable, ProgramSymbolTable } from '../../symbol-table';
import { ElementModifier } from '../nodes-v2';
import { ElementArg, HtmlAttr } from './attr-block';
import { BaseNode, BaseNodeOptions, BaseGlimmerParent, GlimmerParentNodeOptions } from './base';

export class SourceSlice extends BaseNode {
  readonly type = 'SourceSlice';
  readonly chars: string;

  constructor(options: BaseNodeOptions & { chars: string }) {
    super(options);
    this.chars = options.chars;
  }

  getString(): string {
    return this.chars;
  }
}

export class Template extends BaseGlimmerParent {
  readonly type = 'Template';
  readonly table: ProgramSymbolTable;

  constructor(options: GlimmerParentNodeOptions & { table: ProgramSymbolTable }) {
    super(options);
    this.table = options.table;
  }
}

export class Block extends BaseGlimmerParent {
  readonly type = 'Block';
  readonly table: BlockSymbolTable;

  constructor(options: GlimmerParentNodeOptions & { table: BlockSymbolTable }) {
    super(options);
    this.table = options.table;
  }
}

export class NamedBlocks extends BaseNode {
  readonly type = 'NamedBlocks';
  readonly blocks: readonly NamedBlock[];

  constructor(options: BaseNodeOptions & { blocks: readonly NamedBlock[] }) {
    super(options);
    this.blocks = options.blocks;
  }

  get(name: 'default'): NamedBlock;
  get(name: string): NamedBlock | null;
  get(name: string): NamedBlock | null {
    return this.blocks.find((block) => block.name.chars === name) || null;
  }
}

export interface NamedBlockOptions extends BaseNodeOptions {
  name: SourceSlice;
  block: Block;
  attrs: HtmlAttr[];
  args: ElementArg[];
  modifiers: ElementModifier[];
}

export class NamedBlock extends BaseNode {
  readonly type = 'NamedBlock';
  readonly name: SourceSlice;
  readonly block: Block;

  // these are not currently supported, but are here for future expansion
  readonly attrs: readonly HtmlAttr[];
  readonly args: readonly ElementArg[];
  readonly modifiers: readonly ElementModifier[];

  constructor(options: NamedBlockOptions) {
    super(options);
    this.name = options.name;
    this.block = options.block;
    this.attrs = options.attrs;
    this.args = options.args;
    this.modifiers = options.modifiers;
  }
}
