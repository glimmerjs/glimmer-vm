import type {
  BlockMetadata,
  LayoutWithContext,
  NamedBlocks,
  Optional,
  WireFormat,
} from '@glimmer/interfaces';
import { VM_PUSH_ARGS_OP } from '@glimmer/constants';
import { EMPTY_ARRAY, EMPTY_STRING_ARRAY } from '@glimmer/util';

import type { EncodeOp } from '../encoder';

import { CallArgs, CallArgsWithAtNames, EmptyArgs } from '../../syntax/api';
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
export function CompileArgs(
  encode: EncodeOp,
  positional: Optional<WireFormat.Core.Params>,
  named: Optional<WireFormat.Core.Hash>,
  blocks: NamedBlocks
): void {
  let blockNames: string[] = blocks.names;
  for (const name of blockNames) {
    PushYieldableBlock(encode, blocks.get(name));
  }

  let count = CompilePositional(encode, positional);

  let flags = count << 4;

  flags |= 0b1000;

  if (blocks.hasAny) {
    flags |= 0b111;
  }

  let names = EMPTY_ARRAY as readonly string[];

  if (named) {
    names = named[0];
    let val = named[1];
    for (let i = 0; i < val.length; i++) {
      expr(encode, val[i]);
    }
  }

  encode.op(VM_PUSH_ARGS_OP, encode.array(names as string[]), encode.array(blockNames), flags);
}

export function SimpleArgs(
  encode: EncodeOp,
  args: Optional<WireFormat.Core.Args>,
  atNames: boolean
): void {
  if (!args) {
    return EmptyArgs(encode);
  }

  const count = CompilePositional(encode, args.params);

  if (args.hash) {
    const [names, vals] = args.hash;

    for (const val of vals) {
      expr(encode, val);
    }

    return atNames ? CallArgsWithAtNames(encode, count, names) : CallArgs(encode, count, names);
  } else {
    return CallArgs(encode, count, EMPTY_STRING_ARRAY);
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

  for (let i = 0; i < positional.length; i++) {
    expr(encode, positional[i]);
  }

  return positional.length;
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
