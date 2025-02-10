import type { WireFormat } from '@glimmer/interfaces';
import {
  VM_COMPILE_BLOCK_OP,
  VM_CONCAT_OP,
  VM_CONSTANT_REFERENCE_OP,
  VM_GET_DYNAMIC_VAR_OP,
  VM_GET_PROPERTY_OP,
  VM_GET_VARIABLE_OP,
  VM_HAS_BLOCK_OP,
  VM_HAS_BLOCK_PARAMS_OP,
  VM_IF_INLINE_OP,
  VM_NOT_OP,
  VM_PRIMITIVE_OP,
  VM_PRIMITIVE_REFERENCE_OP,
  VM_SPREAD_BLOCK_OP,
} from '@glimmer/constants';
import { SexpOpcodes as Op } from '@glimmer/wire-format';

import type { EncodeOp } from '../encoder';

import { EXPRESSIONS } from '../../syntax/expressions';
import { Call, CallDynamicExpr, Curry, PushPrimitive } from './vm';

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
        Call(encode, handle, args);
        return;
      }

      case Op.CallDynamicValue: {
        const [, callee, args] = expression;

        expr(encode, callee);
        CallDynamicExpr(encode, args);
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

      default:
        EXPRESSIONS.compile(encode, expression);
    }
  } else {
    PushPrimitive(encode, expression);
    encode.op(VM_PRIMITIVE_REFERENCE_OP);
  }
}

const getLocal = (encode: EncodeOp, symbol: number) => void encode.op(VM_GET_VARIABLE_OP, symbol);
const getLexical = (encode: EncodeOp, symbol: number) =>
  void encode.op(VM_CONSTANT_REFERENCE_OP, encode.lexical(symbol));
