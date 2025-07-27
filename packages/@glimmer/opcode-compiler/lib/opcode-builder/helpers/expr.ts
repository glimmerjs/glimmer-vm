import type { Optional, WireFormat } from '@glimmer/interfaces';
import {
  encodeImmediate,
  VM_COMPILE_BLOCK_OP,
  VM_CONCAT_OP,
  VM_CONSTANT_REFERENCE_OP,
  VM_CURRY_OP,
  VM_DYNAMIC_HELPER_OP,
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
  VM_PRIMITIVE_OP,
  VM_PRIMITIVE_REFERENCE_OP,
  VM_PUSH_ARGS_OP,
  VM_PUSH_EMPTY_ARGS_OP,
  VM_PUSH_FRAME_OP,
  VM_PUSH_FRAME_WITH_RESERVED_OP,
  VM_SPREAD_BLOCK_OP,
} from '@glimmer/constants';
import { exhausted } from '@glimmer/debug-util';
import { EMPTY_STRING_ARRAY } from '@glimmer/util';
import {
  EMPTY_ARGS_OPCODE,
  NAMED_ARGS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_OPCODE,
  POSITIONAL_ARGS_OPCODE,
  SexpOpcodes as Op,
} from '@glimmer/wire-format';

import type { EncodeOp } from '../encoder';

import { CompilePositional } from './shared';
import { Call, PushPrimitive } from './vm';

export function expr(encode: EncodeOp, expression: WireFormat.Expression): void {
  if (Array.isArray(expression) && expression[0] === Op.StackExpression) {
    compileStackExpression(encode, expression);
  } else {
    compileOperation(encode, expression);
  }
}

function compileOperation(
  encode: EncodeOp,
  operation: WireFormat.Expressions.StackOperation
): void {
  if (typeof operation === 'number') {
    switch (operation) {
      case Op.Not:
        encode.op(VM_NOT_OP);
        return;
      case Op.HasBlock:
        encode.op(VM_HAS_BLOCK_OP);
        return;
      case Op.HasBlockParams:
        encode.op(VM_SPREAD_BLOCK_OP);
        encode.op(VM_COMPILE_BLOCK_OP);
        encode.op(VM_HAS_BLOCK_PARAMS_OP);
        return;
      case Op.GetDynamicVar:
        encode.op(VM_GET_DYNAMIC_VAR_OP);
        return;
      case Op.IfInline:
        encode.op(VM_IF_INLINE_OP);
        return;
      case Op.Undefined:
        PushPrimitive(encode, undefined);
        encode.op(VM_PRIMITIVE_REFERENCE_OP);
        return;
    }
  }

  if (Array.isArray(operation)) {
    const [op] = operation;

    switch (op) {
      case Op.Concat: {
        const [, arity] = operation;
        encode.op(VM_CONCAT_OP, arity);
        return;
      }

      case Op.GetLocalSymbol: {
        const [, symbol] = operation;
        getLocal(encode, symbol);
        return;
      }

      case Op.GetLexicalSymbol: {
        const [, symbol] = operation;
        getLexical(encode, symbol);
        return;
      }

      case Op.GetKeyword: {
        const [, symbol] = operation;
        Call(encode, encode.keywordHelper(symbol));
        return;
      }

      case Op.Curry: {
        const [, type] = operation;
        encode.op(VM_CURRY_OP, type, encode.isDynamicStringAllowed());
        encode.op(VM_POP_FRAME_OP);
        return;
      }

      case Op.GetProperty: {
        const [, prop] = operation;
        encode.op(VM_GET_PROPERTY_OP, encode.constant(prop));
        return;
      }

      case Op.PushImmediate: {
        const [, value] = operation;
        encode.op(VM_PRIMITIVE_OP, encodeImmediate(value));
        encode.op(VM_PRIMITIVE_REFERENCE_OP);
        return;
      }

      case Op.PushConstant: {
        const [, value] = operation;
        encode.op(VM_PRIMITIVE_OP, encode.constant(value));
        encode.op(VM_PRIMITIVE_REFERENCE_OP);
        return;
      }

      case Op.PushArgs: {
        const [, positional, named, flags] = operation;
        encode.op(VM_PUSH_ARGS_OP, encode.array(positional), encode.array(named), flags);
        return;
      }

      case Op.BeginCall: {
        encode.op(VM_PUSH_FRAME_WITH_RESERVED_OP);
        return;
      }

      case Op.BeginCallDynamic: {
        encode.op(VM_PUSH_FRAME_OP);
        return;
      }

      case Op.CallHelper: {
        const [, symbol] = operation;
        const handle = encode.resolveHelper(symbol);
        encode.op(VM_HELPER_OP, handle);
        encode.op(VM_POP_FRAME_OP);
        return;
      }

      case Op.CallDynamicHelper: {
        encode.op(VM_DYNAMIC_HELPER_OP);
        encode.op(VM_POP_FRAME_OP);
        return;
      }

      case Op.Log: {
        const [, arity] = operation;
        encode.op(VM_LOG_OP, arity);
        return;
      }

      default:
        // TODO: This cast should be removed as part of the current refactor
        exhausted(operation as never);
    }
  } else {
    throw new Error(
      `Unexpected operation type: ${typeof operation} for operation ${operation} in expr`
    );
  }
}

export function compileStackExpression(
  encode: EncodeOp,
  [, ...ops]: WireFormat.Expressions.StackExpression
): void {
  for (const op of ops) {
    compileOperation(encode, op);
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
