import type {
  BlockMetadata,
  HasBlocksFlag,
  HasNamedArgsFlag,
  HasPositionalArgsFlag,
  LayoutWithContext,
  NamedBlocks,
  Optional,
  PresentArray,
  WireFormat,
} from '@glimmer/interfaces';
import { VM_PUSH_ARGS_OP, VM_PUSH_EMPTY_ARGS_OP } from '@glimmer/constants';
import { exhausted } from '@glimmer/debug-util';
import { EMPTY_ARRAY, EMPTY_STRING_ARRAY } from '@glimmer/util';
import {
  BLOCKS_OPCODE,
  EMPTY_ARGS_OPCODE,
  NAMED_ARGS_AND_BLOCKS_OPCODE,
  NAMED_ARGS_OPCODE,
  POSITIONAL_AND_BLOCKS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_OPCODE,
} from '@glimmer/wire-format';

import type { EncodeOp } from '../encoder';

import { EMPTY_BLOCKS, getNamedBlocks } from '../../utils';
import { PushYieldableBlock } from './blocks';
import { expr } from './expr';

/**
 * Compile arguments, pushing an Arguments object onto the stack.
 *
 * @param args.params
 * @param args.hash
 * @param args.blocks
 * @param args.atNames
 */
export function CompileArgs(encode: EncodeOp, args: WireFormat.Core.SomeArgs): void {
  const blocks = hasBlocks(args) ? getNamedBlocks(getBlocks(args)) : EMPTY_BLOCKS;

  let blockNames: string[] = blocks.names;
  for (const name of blockNames) {
    PushYieldableBlock(encode, blocks.get(name));
  }

  let count = hasPositional(args) ? CompilePositional(encode, getPositional(args)) : 0;

  let flags = count << 4;

  flags |= 0b1000;

  if (blocks.hasAny) {
    flags |= 0b111;
  }

  let names = EMPTY_ARRAY as readonly string[];

  if (hasNamed(args)) {
    const named = getNamed(args);
    names = named[0];
    let val = named[1];

    for (const arg of val) {
      expr(encode, arg);
    }
  }

  encode.op(VM_PUSH_ARGS_OP, encode.array(names as string[]), encode.array(blockNames), flags);
}

export const hasPositional = <T extends WireFormat.Core.SomeArgs>(
  args: T
): args is T & WireFormat.Core.HasPositionalArgs =>
  !!(args[0] & (0b100 satisfies HasPositionalArgsFlag));

export const getPositional = (args: WireFormat.Core.HasPositionalArgs): WireFormat.Core.Params =>
  args[1];

export const hasNamed = <T extends WireFormat.Core.SomeArgs>(
  args: T
): args is T & WireFormat.Core.HasNamedArgs => !!(args[0] & (0b010 satisfies HasNamedArgsFlag));

export const getNamed = (args: WireFormat.Core.HasNamedArgs): WireFormat.Core.Hash => {
  switch (args[0]) {
    case NAMED_ARGS_OPCODE:
    case NAMED_ARGS_AND_BLOCKS_OPCODE:
      return args[1];
    case POSITIONAL_AND_NAMED_ARGS_OPCODE:
    case POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE:
      return args[2];
    default:
      exhausted(args);
  }
};

export const hasBlocks = <T extends WireFormat.Core.BlockArgs>(
  args: T
): args is T & WireFormat.Core.HasBlocks => !!(args[0] & (0b001 satisfies HasBlocksFlag));

export const getBlocks = (args: WireFormat.Core.HasBlocks): WireFormat.Core.Blocks => {
  switch (args[0]) {
    case BLOCKS_OPCODE:
      return args[1];
    case POSITIONAL_AND_BLOCKS_OPCODE:
    case NAMED_ARGS_AND_BLOCKS_OPCODE:
      return args[2];
    case POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE:
      return args[3];
    default:
      exhausted(args);
  }
};

export function SimpleArgs(encode: EncodeOp, args: WireFormat.Core.CallArgs): void {
  if (args[0] === EMPTY_ARGS_OPCODE) {
    encode.op(VM_PUSH_EMPTY_ARGS_OP);
    return;
  }

  const positionalCount = hasPositional(args) ? CompilePositional(encode, getPositional(args)) : 0;
  const names = hasNamed(args) ? CompileNamed(encode, getNamed(args)) : EMPTY_STRING_ARRAY;

  encode.op(
    VM_PUSH_ARGS_OP,
    encode.array(names),
    encode.array(EMPTY_STRING_ARRAY),
    positionalCount << 4
  );
}

export function blockArgs(encode: EncodeOp, args: WireFormat.Core.BlockArgs): void {
  if (args[0] === EMPTY_ARGS_OPCODE) {
    encode.op(VM_PUSH_EMPTY_ARGS_OP);
  }

  const positionalCount = hasPositional(args) ? CompilePositional(encode, getPositional(args)) : 0;
  const names = hasNamed(args) ? CompileNamed(encode, getNamed(args)) : EMPTY_STRING_ARRAY;
  const blocks = hasBlocks(args) ? getNamedBlocks(getBlocks(args)) : EMPTY_BLOCKS;

  const [blockFlags, ...blockNames] = CompileBlocks(encode, blocks);

  const flags = (positionalCount << 4) | blockFlags;

  encode.op(VM_PUSH_ARGS_OP, encode.array(names), encode.array(blockNames), flags);
}

export function CompileBlocks(
  encode: EncodeOp,
  blocks: NamedBlocks
): [blockFlags: 0b000 | 0b111, ...blockNames: string[]] {
  if (blocks.hasAny) {
    const blockNames = blocks.names;

    for (const blockName of blockNames) {
      PushYieldableBlock(encode, blocks.get(blockName));
    }

    return [0b111, ...blockNames];
  } else {
    return [0b000];
  }
}

/**
 * Compile an optional list of positional arguments, which pushes each argument
 * onto the stack and returns the number of parameters compiled
 *
 * @param positional an optional list of positional arguments
 */
export function CompilePositional(
  encode: EncodeOp,
  positional: Optional<WireFormat.Core.Params>
): number {
  if (!positional) return 0;

  for (const param of positional) {
    expr(encode, param);
  }

  return positional.length;
}

export function CompilePresentPositional(
  encode: EncodeOp,
  positional: WireFormat.Core.Params
): void {
  for (const param of positional) expr(encode, param);
}

export function CompileNamed(encode: EncodeOp, named: WireFormat.Core.Hash): PresentArray<string> {
  const [names, vals] = named;

  for (const val of vals) {
    expr(encode, val);
  }

  return names;
}

export function meta(layout: LayoutWithContext): BlockMetadata {
  let [, locals, upvars, lexicalSymbols] = layout.block;

  return {
    symbols: {
      locals,
      upvars,
      lexical: lexicalSymbols,
    },
    scopeValues: layout.scope?.() ?? null,
    isStrictMode: layout.isStrictMode,
    moduleName: layout.moduleName,
    owner: layout.owner,
    size: locals.length,
  };
}
