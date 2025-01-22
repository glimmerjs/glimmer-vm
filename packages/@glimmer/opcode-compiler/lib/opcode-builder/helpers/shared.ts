import type {
  BlockMetadata,
  LayoutWithContext,
  NamedBlocks,
  Nullable,
  WireFormat,
} from '@glimmer/interfaces';
import { VM_PUSH_ARGS_OP, VM_PUSH_EMPTY_ARGS_OP } from '@glimmer/constants';
import { EMPTY_ARRAY, EMPTY_STRING_ARRAY } from '@glimmer/util';

import type { BuildExpression, BuildStatement } from '../../syntax/compilers';

import { PushYieldableBlock } from './blocks';
import { expr } from './expr';
import type { EncodeOp } from '../encoder';

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
  positional: WireFormat.Core.Params,
  named: WireFormat.Core.Hash,
  blocks: NamedBlocks,
  atNames: boolean
): void {
  let blockNames: string[] = blocks.names;
  for (const name of blockNames) {
    PushYieldableBlock(encode, blocks.get(name));
  }

  let count = CompilePositional(encode, positional);

  let flags = count << 4;

  if (atNames) flags |= 0b1000;

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

  encode.op(VM_PUSH_ARGS_OP, names as string[], blockNames, flags);
}

/**
 * A call with no arguments.
 */
export const EmptyArgs = (encode: EncodeOp): void => encode.op(VM_PUSH_EMPTY_ARGS_OP);

/**
 * A call with at least one positional or named argument. This function is called after positional
 * and named arguments have been compiled. Positional arguments should be compiled first, left to
 * right, followed by named arguments, in the order that `named` is provided, left to right.
 */
export const CallArgs = (encode: EncodeOp, positional: number, named?: string[]): void =>
  encode.op(VM_PUSH_ARGS_OP, named ?? EMPTY_STRING_ARRAY, EMPTY_STRING_ARRAY, positional << 4);

/**
 * A call with at least one positional or named argument. Names are passed as an array *including*
 * the `@` prefix.
 *
 * This function is called after positional and named arguments have been compiled, in the same
 * way as `CallArgs`.
 *
 * @todo there's only one remaining use of this, and it can probably be removed by removing the
 * `@` prefix at the source.
 */
export const CallArgsWithAtNames = (encode: EncodeOp, positional: number, named?: string[]): void =>
  encode.op(
    VM_PUSH_ARGS_OP,
    named ?? EMPTY_STRING_ARRAY,
    EMPTY_STRING_ARRAY,
    (positional << 4) | 0b1000
  );

export function SimpleArgs(
  encode: EncodeOp,
  positional: Nullable<WireFormat.Core.Params>,
  named: Nullable<WireFormat.Core.Hash>,
  atNames: boolean
): void {
  if (positional === null && named === null) {
    return EmptyArgs(encode);
  }

  const count = CompilePositional(encode, positional);

  if (named) {
    const [names, vals] = named;

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
  positional: Nullable<WireFormat.Core.Params>
): number {
  if (positional === null) return 0;

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
