import { PresentArray } from '@glimmer/interfaces';
import { assert, isPresent } from '@glimmer/util';
import { BlockSymbolTable, GlimmerSyntaxError } from '@glimmer/syntax';
import * as pass1 from '../../../pass1/hir';
import { SourceOffsets } from '../../../../source/offsets';

import { Err, Ok, Result } from '../../../../shared/result';
import { Source } from '../../../../source/source';

interface Args {
  name: pass1.SourceSlice;
  table: BlockSymbolTable;
  body: (pass1.Statement | pass1.NamedBlock)[];
}

// A TemporaryNamedBlock may have named blocks inside of it. This is normally
// disallowed, but it is used to determine whether a component has named blocks
// or a single default block.
export class TemporaryNamedBlock {
  readonly name: pass1.SourceSlice;
  readonly table: BlockSymbolTable;
  readonly body: (pass1.Statement | pass1.NamedBlock)[];

  constructor({ name, table, body }: Args, readonly offsets: SourceOffsets) {
    this.name = name;
    this.table = table;
    this.body = body;
  }

  hasValidNamedBlocks(): this is { body: pass1.NonSemanticChild[] } {
    return (
      this.body.every(
        (node) =>
          node instanceof TemporaryNamedBlock ||
          node.name === 'AppendWhitespace' ||
          node.name === 'AppendComment'
      ) && this.body.some((node) => node instanceof TemporaryNamedBlock)
    );
  }

  asNamedBlocks(
    this: this & { body: pass1.NonSemanticChild[] },
    source: Source
  ): ExtractedMaybeNamedBlocks {
    return extractMaybeNamedBlocks(this.body, source);
  }

  tryNamedBlock(source: Source): Result<pass1.NamedBlock> {
    if (this.isValidNamedBlock()) {
      return Ok(this.asNamedBlock());
    } else {
      return Err(
        new GlimmerSyntaxError(`Cannot nest named blocks`, this.offsets.toLocation(source))
      );
    }
  }

  isValidNamedBlock(): this is { body: pass1.Statement[] } {
    return onlyHasSemanticChildren(this);
  }

  asNamedBlock(this: this & pass1.NamedBlock['args']): pass1.NamedBlock {
    let { name, table, body } = this;
    return new pass1.NamedBlock(this.offsets, { name, table, body });
  }
}

function onlyHasSemanticChildren(
  block: TemporaryNamedBlock | pass1.NamedBlock['args']
): block is pass1.NamedBlock['args'] {
  return !block.body.some((s) => s instanceof TemporaryNamedBlock);
}

type ExtractedMaybeNamedBlocks = Result<PresentArray<pass1.NamedBlock>>;

function extractMaybeNamedBlocks(
  body: pass1.NonSemanticChild[],
  source: Source
): Result<PresentArray<pass1.NamedBlock>> {
  let blocks: pass1.NamedBlock[] = [];
  let nodes: pass1.NonSemantic[] = [];

  for (let statement of body) {
    if (statement instanceof TemporaryNamedBlock) {
      if (statement.isValidNamedBlock()) {
        blocks.push(statement.asNamedBlock());
      } else {
        return Err(
          new GlimmerSyntaxError(`invalid nested named block`, statement.offsets.toLocation(source))
        );
      }
    }

    switch (statement.name) {
      case 'AppendComment':
      case 'AppendWhitespace':
        nodes.push(statement);
        break;
      case 'NamedBlock':
        blocks.push(statement);
        break;
    }
  }

  assert(
    isPresent(blocks),
    `the block did not have named blocks (make sure to call hasValidNamedBlocks before asNamedBlocks)`
  );

  return Ok(blocks);
}
