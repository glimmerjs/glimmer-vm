import type { NamedBlocks, Nullable, SerializedInlineBlock, WireFormat } from '@glimmer/interfaces';
import { dict, enumerate, unwrap } from '@glimmer/util';

interface NamedBlocksDict {
  [key: string]: Nullable<WireFormat.SerializedInlineBlock>;
}

export class NamedBlocksImpl implements NamedBlocks {
  public names: string[];
  readonly #blocks: Nullable<NamedBlocksDict>;

  constructor(blocks: Nullable<NamedBlocksDict>) {
    this.#blocks = blocks;
    this.names = blocks ? Object.keys(blocks) : [];
  }

  get(name: string): Nullable<SerializedInlineBlock> {
    if (!this.#blocks) return null;

    return this.#blocks[name] || null;
  }

  has(name: string): boolean {
    return this.#blocks !== null && name in this.#blocks;
  }

  with(name: string, block: Nullable<SerializedInlineBlock>): NamedBlocks {
    return this.#blocks
      ? new NamedBlocksImpl({ ...this.#blocks, [name]: block})
      : new NamedBlocksImpl({ [name]: block });
  }

  get hasAny(): boolean {
    return this.#blocks !== null;
  }
}

export const EMPTY_BLOCKS = new NamedBlocksImpl(null);

export function namedBlocks(blocks: WireFormat.Core.Blocks): NamedBlocks {
  if (blocks === null) {
    return EMPTY_BLOCKS;
  }

  let out: NamedBlocksDict = dict();

  let [keys, values] = blocks;

  for (let [index, key] of enumerate(keys)) {
    out[key] = unwrap(values[index]);
  }

  return new NamedBlocksImpl(out);
}
