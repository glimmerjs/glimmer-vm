import type {
  AbstractNamedBlocks,
  EmptyNamedBlocks,
  NamedBlocks,
  Nullable,
  Optional,
  PresentNamedBlocks,
  SerializedInlineBlock,
  WireFormat,
} from '@glimmer/interfaces';
import { unwrap } from '@glimmer/debug-util';
import { assign, dict, enumerate } from '@glimmer/util';

interface NamedBlocksDict {
  [key: string]: Optional<WireFormat.SerializedInlineBlock>;
}

export class NamedBlocksImpl implements AbstractNamedBlocks {
  static empty(): EmptyNamedBlocks {
    return new NamedBlocksImpl(undefined) as unknown as EmptyNamedBlocks;
  }

  static of(blocks: NamedBlocksDict): PresentNamedBlocks {
    return new NamedBlocksImpl(blocks) as unknown as PresentNamedBlocks;
  }

  readonly names: string[];
  readonly #blocks: Optional<NamedBlocksDict>;

  private constructor(blocks: Optional<NamedBlocksDict>) {
    this.#blocks = blocks;
    this.names = blocks ? Object.keys(blocks) : [];
  }

  get(name: string): Nullable<SerializedInlineBlock> {
    if (!this.#blocks) return null;

    return this.#blocks[name] || null;
  }

  has(name: string): boolean {
    let blocks = this.#blocks;
    return blocks !== undefined && name in blocks;
  }

  with(name: string, block: Optional<SerializedInlineBlock>): PresentNamedBlocks {
    let blocks = this.#blocks;

    if (blocks) {
      return NamedBlocksImpl.of(assign({}, blocks, { [name]: block }));
    } else {
      return NamedBlocksImpl.of({ [name]: block });
    }
  }

  remove(name: string): [Optional<SerializedInlineBlock>, NamedBlocks] {
    let blocks = this.#blocks;

    if (blocks && name in blocks) {
      const block = blocks[name];

      return [
        block,
        NamedBlocksImpl.of(
          Object.fromEntries(Object.entries(blocks).filter(([key]) => key !== name))
        ),
      ];
    } else {
      return [undefined, this as unknown as NamedBlocks];
    }
  }

  get hasAny(): boolean {
    return this.#blocks !== undefined;
  }
}

export const EMPTY_BLOCKS = NamedBlocksImpl.empty();

export function getNamedBlocks(blocks: WireFormat.Core.Blocks): PresentNamedBlocks;
export function getNamedBlocks(blocks: Optional<WireFormat.Core.Blocks>): NamedBlocks;
export function getNamedBlocks(blocks: Optional<WireFormat.Core.Blocks>): NamedBlocks {
  if (!blocks) {
    return EMPTY_BLOCKS;
  }

  let out: NamedBlocksDict = dict();

  let [keys, values] = blocks;

  for (const [i, key] of enumerate(keys)) {
    out[key] = unwrap(values[i]);
  }

  return NamedBlocksImpl.of(out);
}
