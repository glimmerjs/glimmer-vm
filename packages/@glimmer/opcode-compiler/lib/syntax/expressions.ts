import type { ExpressionSexpOpcode } from '@glimmer/interfaces';
import {
  VM_COMPILE_BLOCK_OP,
  VM_CONCAT_OP,
  VM_CONSTANT_REFERENCE_OP,
  VM_FETCH_OP,
  VM_GET_DYNAMIC_VAR_OP,
  VM_GET_PROPERTY_OP,
  VM_GET_VARIABLE_OP,
  VM_HAS_BLOCK_OP,
  VM_HAS_BLOCK_PARAMS_OP,
  VM_IF_INLINE_OP,
  VM_LOG_OP,
  VM_NOT_OP,
  VM_POP_FRAME_OP,
  VM_PUSH_FRAME_OP,
  VM_SPREAD_BLOCK_OP,
} from '@glimmer/constants';
import { $v0 } from '@glimmer/vm';
import { SexpOpcodes } from '@glimmer/wire-format';

import type { EncodeOp } from '../opcode-builder/encoder';

import { expr } from '../opcode-builder/helpers/expr';
import { SimpleArgs } from '../opcode-builder/helpers/shared';
import { Call, CallDynamic, Curry, PushPrimitiveReference } from '../opcode-builder/helpers/vm';
import { Compilers } from './compilers';

export const EXPRESSIONS = new Compilers<ExpressionSexpOpcode>();

/**
 * Called after compiling the expressions that make up the `Concat`.
 */
export const Concat = (encode: EncodeOp, count: number): void => {
  encode.op(VM_CONCAT_OP, count);
};

EXPRESSIONS.add(SexpOpcodes.Concat, (op, [, parts]) => {
  for (let part of parts) {
    expr(op, part);
  }

  Concat(op, parts.length);
});

// export const CallDynamic = (op: BuildExpression, )

EXPRESSIONS.add(SexpOpcodes.CallResolved, (encode, [, expression, positional, named]) => {
  encode.helper(expression, (handle: number) => {
    Call(encode, handle, positional, named);
  });
});

EXPRESSIONS.add(SexpOpcodes.CallLexical, (encode, [, expression, positional, named]) => {
  expr(encode, expression);
  CallDynamic(encode, positional, named);
});

EXPRESSIONS.add(SexpOpcodes.Curry, (op, [, expr, type, positional, named]) => {
  Curry(op, type, expr, positional, named);
});

export const GetSymbol = (encode: EncodeOp, sym: number): void => {
  encode.op(VM_GET_VARIABLE_OP, sym);
};

export const GetPath = (encode: EncodeOp, path: string[]): void => withPath(encode, path);

EXPRESSIONS.add(SexpOpcodes.GetSymbol, (encode, [, sym, path]) => {
  GetSymbol(encode, sym);
  if (path) GetPath(encode, path);
});

EXPRESSIONS.add(SexpOpcodes.GetLexicalSymbol, (encode, [, sym, path]) => {
  encode.lexical(sym, (handle) => {
    encode.op(VM_CONSTANT_REFERENCE_OP, handle);
    withPath(encode, path);
  });
});

EXPRESSIONS.add(SexpOpcodes.GetStrictKeyword, (encode, expr) => {
  encode.local(expr[1], (_name: string) => {
    encode.helper(expr, (handle: number) => {
      Call(encode, handle, null, null);
    });
  });
});

EXPRESSIONS.add(SexpOpcodes.GetFreeAsHelperHead, (encode, expr) => {
  encode.local(expr[1], (_name: string) => {
    encode.helper(expr, (handle: number) => {
      Call(encode, handle, null, null);
    });
  });
});

function withPath(encode: EncodeOp, path?: string[]) {
  if (path === undefined || path.length === 0) return;

  for (const part of path) {
    encode.op(VM_GET_PROPERTY_OP, encode.constant(part));
  }
}

export const Undefined = (encode: EncodeOp): void => PushPrimitiveReference(encode, undefined);

/**
 * @expect previously compiled block name as expression
 */
export const HasBlock = (encode: EncodeOp): void => encode.op(VM_HAS_BLOCK_OP);

EXPRESSIONS.add(SexpOpcodes.Undefined, (encode) => PushPrimitiveReference(encode, undefined));
EXPRESSIONS.add(SexpOpcodes.HasBlock, (encode, [, block]) => {
  expr(encode, block);
  HasBlock(encode);
});

/**
 * @expect previously compiled block name as expression
 */
export const HasBlockParams = (encode: EncodeOp): void => {
  encode.op(VM_SPREAD_BLOCK_OP);
  encode.op(VM_COMPILE_BLOCK_OP);
  encode.op(VM_HAS_BLOCK_PARAMS_OP);
};

EXPRESSIONS.add(SexpOpcodes.HasBlockParams, (encode, [, block]) => {
  expr(encode, block);
  HasBlockParams(encode);
});

/**
 * @expect (expression) condition
 * @expect (expression) truthy
 * @expect (expression) falsy
 */
export const IfInline = (encode: EncodeOp): void => {
  encode.op(VM_IF_INLINE_OP);
};

EXPRESSIONS.add(SexpOpcodes.IfInline, (encode, [, condition, truthy, falsy]) => {
  // Push in reverse order
  expr(encode, falsy);
  expr(encode, truthy);
  expr(encode, condition);
  encode.op(VM_IF_INLINE_OP);
});

/**
 * @expect (expression) value to invert
 */
export const Not = (encode: EncodeOp): void => encode.op(VM_NOT_OP);

EXPRESSIONS.add(SexpOpcodes.Not, (encode, [, value]) => {
  expr(encode, value);
  encode.op(VM_NOT_OP);
});

export const GetDynamicVar = (encode: EncodeOp): void => encode.op(VM_GET_DYNAMIC_VAR_OP);

EXPRESSIONS.add(SexpOpcodes.GetDynamicVar, (encode, [, expression]) => {
  expr(encode, expression);
  encode.op(VM_GET_DYNAMIC_VAR_OP);
});

export const Log = (encode: EncodeOp, expr: () => void) => {
  encode.op(VM_PUSH_FRAME_OP);
  expr();
  encode.op(VM_LOG_OP);
  encode.op(VM_POP_FRAME_OP);
  encode.op(VM_FETCH_OP, $v0);
};

EXPRESSIONS.add(SexpOpcodes.Log, (encode, [, positional]) => {
  Log(encode, () => SimpleArgs(encode, positional, null, false));
});
