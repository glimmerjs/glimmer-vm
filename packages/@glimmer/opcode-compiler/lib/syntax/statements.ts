import type {
  ContentSexpOpcode,
  Optional,
  WellKnownAttrName,
  WellKnownTagName,
  WireFormat,
} from '@glimmer/interfaces';
import type { RequireAtLeastOne, Simplify } from 'type-fest';
import {
  VM_DUP_FP_OP,
  VM_DUP_SP_OP,
  VM_ENTER_LIST_OP,
  VM_EXIT_LIST_OP,
  VM_ITERATE_OP,
  VM_JUMP_OP,
  VM_POP_FRAME_OP,
  VM_POP_OP,
  VM_POP_REMOTE_ELEMENT_OP,
  VM_PUSH_FRAME_OP,
  VM_PUSH_REMOTE_ELEMENT_OP,
  VM_RETURN_TO_OP,
  VM_TO_BOOLEAN_OP,
} from '@glimmer/constants';
import { exhausted } from '@glimmer/debug-util';
import {
  NAMED_ARGS_AND_BLOCKS_OPCODE,
  NAMED_ARGS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_OPCODE,
  SexpOpcodes as Op,
} from '@glimmer/wire-format';

import { InvokeStaticBlock, InvokeStaticBlockWithStack } from '../opcode-builder/helpers/blocks';
import { InvokeReplayableComponentExpression } from '../opcode-builder/helpers/components';
import { Replayable, ReplayableIf } from '../opcode-builder/helpers/conditional';
import { expr } from '../opcode-builder/helpers/expr';
import { hasNamed } from '../opcode-builder/helpers/shared';
import { PushPrimitiveReference } from '../opcode-builder/helpers/vm';
import { Compilers } from './compilers';

export const STATEMENTS = new Compilers<ContentSexpOpcode>();

const INFLATE_ATTR_TABLE: {
  [I in WellKnownAttrName]: string;
} = ['class', 'id', 'value', 'name', 'type', 'style', 'href'];
const INFLATE_TAG_TABLE: {
  [I in WellKnownTagName]: string;
} = ['div', 'span', 'p', 'a'];

export function inflateTagName(tagName: string | WellKnownTagName): string {
  return typeof tagName === 'string' ? tagName : INFLATE_TAG_TABLE[tagName];
}

export function inflateAttrName(attrName: string | WellKnownAttrName): string {
  return typeof attrName === 'string' ? attrName : INFLATE_ATTR_TABLE[attrName];
}

export function isLexicalCall(expr: WireFormat.Expression) {
  return Array.isArray(expr) && expr[0] === Op.GetLexicalSymbol;
}

export function prefixAtNames<T extends WireFormat.Core.SomeArgs>(args: T): T;
export function prefixAtNames(args: WireFormat.Core.SomeArgs): WireFormat.Core.SomeArgs {
  if (!hasNamed(args)) {
    return args;
  }

  switch (args[0]) {
    case NAMED_ARGS_OPCODE:
      return [NAMED_ARGS_OPCODE, hashToArgs(args[1])];
    case NAMED_ARGS_AND_BLOCKS_OPCODE:
      return [NAMED_ARGS_AND_BLOCKS_OPCODE, hashToArgs(args[1]), args[2]];
    case POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE:
      return [POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE, args[1], hashToArgs(args[2]), args[3]];
    case POSITIONAL_AND_NAMED_ARGS_OPCODE:
      return [POSITIONAL_AND_NAMED_ARGS_OPCODE, args[1], hashToArgs(args[2])];
    default:
      exhausted(args);
  }
}

STATEMENTS.add(Op.InElement, (encode, [, block, guid, destination, insertBefore]) => {
  ReplayableIf(
    encode,

    () => {
      PushPrimitiveReference(encode, guid);

      if (insertBefore === undefined) {
        PushPrimitiveReference(encode, undefined);
      } else {
        expr(encode, insertBefore);
      }

      expr(encode, destination);
      encode.op(VM_DUP_SP_OP, 0);

      return 4;
    },

    () => {
      encode.op(VM_PUSH_REMOTE_ELEMENT_OP);
      InvokeStaticBlock(encode, block);
      encode.op(VM_POP_REMOTE_ELEMENT_OP);
    }
  );
});

STATEMENTS.add(Op.If, (encode, [, condition, block, inverse]) =>
  ReplayableIf(
    encode,
    () => {
      expr(encode, condition);
      encode.op(VM_TO_BOOLEAN_OP);

      return 1;
    },

    () => InvokeStaticBlock(encode, block),
    inverse && (() => InvokeStaticBlock(encode, inverse))
  )
);

STATEMENTS.add(Op.Each, (encode, [, value, key, block, inverse]) => {
  const keyFn = key
    ? () => void expr(encode, key)
    : () => void PushPrimitiveReference(encode, null);

  return Replayable(
    encode,

    () => {
      keyFn();
      expr(encode, value);

      return 2;
    },

    () => {
      encode.op(VM_ENTER_LIST_OP, encode.to('BODY'), encode.to('ELSE'));
      encode.op(VM_PUSH_FRAME_OP);
      encode.op(VM_DUP_FP_OP, 1);
      encode.op(VM_RETURN_TO_OP, encode.to('ITER'));
      encode.mark('ITER');
      encode.op(VM_ITERATE_OP, encode.to('BREAK'));
      encode.mark('BODY');
      InvokeStaticBlockWithStack(encode, block, 2);
      encode.op(VM_POP_OP, 2);
      encode.op(VM_JUMP_OP, encode.to('FINALLY'));
      encode.mark('BREAK');
      encode.op(VM_POP_FRAME_OP);
      encode.op(VM_EXIT_LIST_OP);
      encode.op(VM_JUMP_OP, encode.to('FINALLY'));
      encode.mark('ELSE');

      if (inverse) {
        InvokeStaticBlock(encode, inverse);
      }
    }
  );
});

STATEMENTS.add(Op.InvokeDynamicComponent, (encode, [, expr, args]) => {
  // otherwise, the component name was an expression, so resolve the expression
  // and invoke it as a dynamic component

  InvokeReplayableComponentExpression(encode, expr, args, { curried: true });
});

STATEMENTS.add(Op.InvokeComponentKeyword, (encode, [, expr, args]) => {
  InvokeReplayableComponentExpression(encode, expr, args);
});

/**
 * This function inserts `@` before each named argument. It has to be done at this late stage
 * because, in some cases, the `{{}}` is ambiguous: it might be a helper or a component, and we only
 * discover which once we resolve the value. If the value is a helper, we want to pass the named
 * arguments as-is, and if it's a component, we want to pass them with the `@` prefix.
 */
export function hashToArgs(hash: WireFormat.Core.Hash): WireFormat.Core.Hash;
export function hashToArgs(hash: Optional<WireFormat.Core.Hash>): Optional<WireFormat.Core.Hash>;
export function hashToArgs(hash: Optional<WireFormat.Core.Hash>): Optional<WireFormat.Core.Hash> {
  if (!hash) return;
  let names = hash[0].map((key) => `@${key}`);
  return [names as [string, ...string[]], hash[1]];
}

type CompactObject<T> = Simplify<
  RequireAtLeastOne<
    {
      [K in keyof T as undefined extends T[K] ? never : K]: T[K];
    } & {
      [K in keyof T as undefined extends T[K] ? K : never]?: NonNullable<T[K]>;
    }
  >
>;

/**
 * Remove all `undefined` values from an object.
 *
 * The return type:
 *
 * - removes all properties whose value is literally `undefined`.
 * - replaces properties whose value is `T | undefined` with an optional property with the value
 *   `T`.
 *
 * Example:
 *
 * ```ts
 * interface Foo {
 *   foo?: number;
 *   bar: number | undefined;
 *   baz: number;
 *   bat?: number | undefined;
 * }
 *
 * const obj: Foo = {
 *   bar: 123,
 *   baz: 456,
 *   bat: undefined
 * };
 *
 * const compacted = compact(obj);
 *
 * // compacted is now:
 * interface Foo {
 *   foo?: number;
 *   bar?: number;
 *   baz: number;
 *   bat?: number;
 * }
 * ```
 */
export function compact<T extends object>(
  object: T | undefined
): Optional<Simplify<CompactObject<T>>> {
  if (!object) return;

  const entries = Object.entries(object).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries) as Simplify<CompactObject<T>> | undefined;
}
