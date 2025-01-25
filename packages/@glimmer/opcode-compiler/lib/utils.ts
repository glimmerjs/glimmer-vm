import type {
  NamedBlocks,
  Nullable,
  Optional,
  SerializedInlineBlock,
  WireFormat,
} from '@glimmer/interfaces';
import { unwrap } from '@glimmer/debug-util';
import { assign, dict, enumerate } from '@glimmer/util';

interface NamedBlocksDict {
  [key: string]: Optional<WireFormat.SerializedInlineBlock>;
}

export class NamedBlocksImpl implements NamedBlocks {
  public names: string[];

  constructor(private blocks: Optional<NamedBlocksDict>) {
    this.names = blocks ? Object.keys(blocks) : [];
  }

  get(name: string): Nullable<SerializedInlineBlock> {
    if (!this.blocks) return null;

    return this.blocks[name] || null;
  }

  has(name: string): boolean {
    let { blocks } = this;
    return blocks !== undefined && name in blocks;
  }

  with(name: string, block: Optional<SerializedInlineBlock>): NamedBlocks {
    let { blocks } = this;

    if (blocks) {
      return new NamedBlocksImpl(assign({}, blocks, { [name]: block }));
    } else {
      return new NamedBlocksImpl({ [name]: block });
    }
  }

  get hasAny(): boolean {
    return this.blocks !== undefined;
  }
}

export const EMPTY_BLOCKS = new NamedBlocksImpl(undefined);

export function namedBlocks(blocks: Optional<WireFormat.Core.Blocks>): NamedBlocks {
  if (!blocks) {
    return EMPTY_BLOCKS;
  }

  let out: NamedBlocksDict = dict();

  let [keys, values] = blocks;

  for (const [i, key] of enumerate(keys)) {
    out[key] = unwrap(values[i]);
  }

  return new NamedBlocksImpl(out);
}
