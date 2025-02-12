import type { Optional, WireFormat } from '@glimmer/interfaces';
import {
  VM_COMPILE_BLOCK_OP,
  VM_CONCAT_OP,
  VM_CONSTANT_REFERENCE_OP,
  VM_DUP_OP,
  VM_DYNAMIC_HELPER_OP,
  VM_FETCH_OP,
  VM_GET_DYNAMIC_VAR_OP,
  VM_GET_PROPERTY_OP,
  VM_GET_VARIABLE_OP,
  VM_HAS_BLOCK_OP,
  VM_HAS_BLOCK_PARAMS_OP,
  VM_HELPER_OP,
  VM_IF_INLINE_OP,
  VM_LOG_OP,
  VM_NOT_OP,
  VM_POP_FRAME_OP,
  VM_POP_OP,
  VM_PRIMITIVE_OP,
  VM_PRIMITIVE_REFERENCE_OP,
  VM_PUSH_ARGS_OP,
  VM_PUSH_EMPTY_ARGS_OP,
  VM_PUSH_FRAME_OP,
  VM_SPREAD_BLOCK_OP,
} from '@glimmer/constants';
import { exhausted } from '@glimmer/debug-util';
import { EMPTY_STRING_ARRAY } from '@glimmer/util';
import { $fp, $v0 } from '@glimmer/vm';
import {
  EMPTY_ARGS_OPCODE,
  NAMED_ARGS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_OPCODE,
  POSITIONAL_ARGS_OPCODE,
  SexpOpcodes as Op,
} from '@glimmer/wire-format';

import type { EncodeOp } from '../encoder';

import { CompilePositional } from './shared';
import { Call, Curry, PushPrimitive } from './vm';

export function expr(encode: EncodeOp, expression: WireFormat.Expression): void {
  if (Array.isArray(expression)) {
    const [op] = expression;

    switch (op) {
      case Op.Concat: {
        const [, parts] = expression;

        for (let part of parts) {
          expr(encode, part);
        }

        encode.op(VM_CONCAT_OP, parts.length);
        return;
      }

      case Op.CallResolved: {
        const [, callee, args] = expression;

        const handle = encode.resolveHelper(callee);
        encode.op(VM_PUSH_FRAME_OP);
        callArgs(encode, args);
        encode.op(VM_HELPER_OP, handle);
        encode.op(VM_POP_FRAME_OP);
        encode.op(VM_FETCH_OP, $v0);
        return;
      }

      case Op.CallDynamicValue: {
        const [, callee, args] = expression;

        expr(encode, callee);
        encode.op(VM_PUSH_FRAME_OP);
        callArgs(encode, args);
        encode.op(VM_DUP_OP, $fp, 1);
        encode.op(VM_DYNAMIC_HELPER_OP);
        encode.op(VM_POP_FRAME_OP);
        encode.op(VM_POP_OP, 1);
        encode.op(VM_FETCH_OP, $v0);
        return;
      }

      case Op.GetPath: {
        const [, kind, sym, path] = expression;

        if (kind === Op.GetLocalSymbol) getLocal(encode, sym);
        else getLexical(encode, sym);

        for (const part of path) {
          encode.op(VM_GET_PROPERTY_OP, encode.constant(part));
        }
        return;
      }

      case Op.GetLocalSymbol: {
        const [, symbol] = expression;
        getLocal(encode, symbol);
        return;
      }

      case Op.GetLexicalSymbol: {
        const [, symbol] = expression;
        getLexical(encode, symbol);
        return;
      }

      case Op.GetStrictKeyword: {
        const [, symbol] = expression;
        Call(encode, encode.keywordHelper(symbol));
        return;
      }

      case Op.Curry: {
        const [, expr, type, args] = expression;
        return Curry(encode, type, expr, args);
      }

      case Op.Undefined: {
        encode.op(VM_PRIMITIVE_OP, encode.constant(undefined));
        encode.op(VM_PRIMITIVE_REFERENCE_OP);
        return;
      }

      case Op.HasBlock: {
        const [, block] = expression;
        expr(encode, block);
        encode.op(VM_HAS_BLOCK_OP);
        return;
      }

      case Op.HasBlockParams: {
        const [, block] = expression;
        expr(encode, block);
        encode.op(VM_SPREAD_BLOCK_OP);
        encode.op(VM_COMPILE_BLOCK_OP);
        encode.op(VM_HAS_BLOCK_PARAMS_OP);
        return;
      }

      case Op.IfInline: {
        const [, condition, truthy, falsy] = expression;
        expr(encode, falsy ?? [Op.Undefined]);
        expr(encode, truthy);
        expr(encode, condition);
        encode.op(VM_IF_INLINE_OP);
        return;
      }

      case Op.Not: {
        const [, value] = expression;
        expr(encode, value);
        encode.op(VM_NOT_OP);
        return;
      }

      case Op.GetDynamicVar: {
        const [, varName] = expression;
        expr(encode, varName);
        encode.op(VM_GET_DYNAMIC_VAR_OP);
        return;
      }

      case Op.Log: {
        const [, positional] = expression;
        encode.op(VM_PUSH_FRAME_OP);
        compilePositional(encode, positional);
        encode.op(VM_LOG_OP);
        encode.op(VM_POP_FRAME_OP);
        encode.op(VM_FETCH_OP, $v0);
        return;
      }

      default:
        exhausted(expression);
    }
  } else {
    PushPrimitive(encode, expression);
    encode.op(VM_PRIMITIVE_REFERENCE_OP);
  }
}

export const compilePositional = (encode: EncodeOp, args: Optional<WireFormat.Core.Params>) => {
  if (!args) {
    encode.op(VM_PUSH_EMPTY_ARGS_OP);
    return;
  }

  const count = CompilePositional(encode, args);
  encode.op(
    VM_PUSH_ARGS_OP,
    encode.array(EMPTY_STRING_ARRAY),
    encode.array(EMPTY_STRING_ARRAY),
    count << 4
  );
};

export function callArgs(
  encode: EncodeOp,
  args: WireFormat.Core.CallArgs,
  namedFlags: 0b0000 | 0b1000 = 0b0000
) {
  switch (args[0]) {
    case EMPTY_ARGS_OPCODE:
      encode.op(VM_PUSH_EMPTY_ARGS_OP);
      break;
    case POSITIONAL_ARGS_OPCODE: {
      compilePositional(encode, args[1]);
      break;
    }
    case NAMED_ARGS_OPCODE: {
      const [names, vals] = args[1];

      for (const val of vals) {
        expr(encode, val);
      }

      encode.op(
        VM_PUSH_ARGS_OP,
        encode.array(names),
        encode.array(EMPTY_STRING_ARRAY),
        (0 << 4) | namedFlags
      );
      break;
    }
    case POSITIONAL_AND_NAMED_ARGS_OPCODE: {
      const count = CompilePositional(encode, args[1]);
      const [names, vals] = args[2];

      for (const val of vals) {
        expr(encode, val);
      }

      encode.op(
        VM_PUSH_ARGS_OP,
        encode.array(names),
        encode.array(EMPTY_STRING_ARRAY),
        (count << 4) | namedFlags
      );
      break;
    }

    default:
      exhausted(args);
  }
}

const getLocal = (encode: EncodeOp, symbol: number) => void encode.op(VM_GET_VARIABLE_OP, symbol);
const getLexical = (encode: EncodeOp, symbol: number) =>
  void encode.op(VM_CONSTANT_REFERENCE_OP, encode.lexical(symbol));
