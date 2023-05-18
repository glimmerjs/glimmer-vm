import { assert, deprecate } from '@glimmer/global-context';
import type { ExpressionSexpOpcode } from '@glimmer/interfaces';
import {
  $v0,
  COMPILE_BLOCK_OP,
  CONCAT_OP,
  CONSTANT_REFERENCE_OP,
  FETCH_OP,
  GET_DYNAMIC_VAR_OP,
  GET_PROPERTY_OP,
  GET_VARIABLE_OP,
  HAS_BLOCK_OP,
  HAS_BLOCK_PARAMS_OP,
  IF_INLINE_OP,
  LOG_OP,
  NOT_OP,
  POP_FRAME_OP,
  PUSH_FRAME_OP,
  SPREAD_BLOCK_OP,
} from '@glimmer/vm-constants';

import { expr } from '../opcode-builder/helpers/expr';
import { isGetFreeHelper } from '../opcode-builder/helpers/resolution';
import { SimpleArgs } from '../opcode-builder/helpers/shared';
import { Call, CallDynamic, Curry, PushPrimitiveReference } from '../opcode-builder/helpers/vm';
import { HighLevelResolutionOpcodes } from '../opcode-builder/opcodes';
import { Compilers, type PushExpressionOp } from './compilers';
import {
  WIRE_CALL,
  WIRE_CONCAT,
  WIRE_CURRY,
  WIRE_GET_DYNAMIC_VAR,
  WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OR_THIS_FALLBACK,
  WIRE_GET_FREE_AS_DEPRECATED_HELPER_HEAD_OR_THIS_FALLBACK,
  WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK,
  WIRE_GET_LEXICAL_SYMBOL,
  WIRE_GET_STRICT_KEYWORD,
  WIRE_GET_SYMBOL,
  WIRE_HAS_BLOCK,
  WIRE_HAS_BLOCK_PARAMS,
  WIRE_IF_INLINE,
  WIRE_LOG,
  WIRE_NOT,
  WIRE_UNDEFINED,
} from '@glimmer/wire-format';

export const EXPRESSIONS = new Compilers<PushExpressionOp, ExpressionSexpOpcode>();

EXPRESSIONS.add(WIRE_CONCAT, (op, [, parts]) => {
  for (let part of parts) {
    expr(op, part);
  }

  op(CONCAT_OP, parts.length);
});

EXPRESSIONS.add(WIRE_CALL, (op, [, expression, positional, named]) => {
  if (isGetFreeHelper(expression)) {
    op(HighLevelResolutionOpcodes.Helper, expression, (handle: number) => {
      Call(op, handle, positional, named);
    });
  } else {
    expr(op, expression);
    CallDynamic(op, positional, named);
  }
});

EXPRESSIONS.add(WIRE_CURRY, (op, [, expr, type, positional, named]) => {
  Curry(op, type, expr, positional, named);
});

EXPRESSIONS.add(WIRE_GET_SYMBOL, (op, [, sym, path]) => {
  op(GET_VARIABLE_OP, sym);
  withPath(op, path);
});

EXPRESSIONS.add(WIRE_GET_LEXICAL_SYMBOL, (op, [, sym, path]) => {
  op(HighLevelResolutionOpcodes.TemplateLocal, sym, (handle: number) => {
    op(CONSTANT_REFERENCE_OP, handle);
    withPath(op, path);
  });
});

EXPRESSIONS.add(WIRE_GET_STRICT_KEYWORD, (op, [, sym, _path]) => {
  op(HighLevelResolutionOpcodes.Free, sym, (_handle: unknown) => {
    // TODO: Implement in strict mode
  });
});

EXPRESSIONS.add(WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OR_THIS_FALLBACK, () => {
  // TODO: The logic for this opcode currently exists in STATEMENTS.Append, since
  // we want different wrapping logic depending on if we are invoking a component,
  // helper, or {{this}} fallback. Eventually we fix the opcodes so that we can
  // traverse the subexpression tree like normal in this location.
  throw new Error('unimplemented opcode');
});

EXPRESSIONS.add(WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK, (op, expr) => {
  // <div id={{baz}}>

  op(HighLevelResolutionOpcodes.Local, expr[1], (_name: string) => {
    op(HighLevelResolutionOpcodes.OptionalHelper, expr, {
      ifHelper: (handle: number) => {
        Call(op, handle, null, null);
      },
    });
  });
});

EXPRESSIONS.add(WIRE_GET_FREE_AS_DEPRECATED_HELPER_HEAD_OR_THIS_FALLBACK, (op, expr) => {
  // <Foo @bar={{baz}}>

  op(HighLevelResolutionOpcodes.Local, expr[1], (_name: string) => {
    op(HighLevelResolutionOpcodes.OptionalHelper, expr, {
      ifHelper: (handle: number, name: string, moduleName: string) => {
        assert(expr[2] && expr[2].length === 1, '[BUG] Missing argument name');

        let arg = expr[2][0];

        deprecate(
          `The \`${name}\` helper was used in the \`${moduleName}\` template as \`${arg}={{${name}}}\`. ` +
            `This is ambigious between wanting the \`${arg}\` argument to be the \`${name}\` helper itself, ` +
            `or the result of invoking the \`${name}\` helper (current behavior). ` +
            `This implicit invocation behavior has been deprecated.\n\n` +
            `Instead, please explicitly invoke the helper with parenthesis, i.e. \`${arg}={{(${name})}}\`.\n\n` +
            `Note: the parenthesis are only required in this exact scenario where an ambiguity is present – where ` +
            `\`${name}\` referes to a global helper (as opposed to a local variable), AND ` +
            `the \`${name}\` helper invocation does not take any arguments, AND ` +
            `this occurs in a named argument position of a component invocation.\n\n` +
            `We expect this combination to be quite rare, as most helpers require at least one argument. ` +
            `There is no need to refactor helper invocations in cases where this deprecation was not triggered.`,
          false,
          {
            id: 'argument-less-helper-paren-less-invocation',
          }
        );

        Call(op, handle, null, null);
      },
    });
  });
});

function withPath(op: PushExpressionOp, path?: string[]) {
  if (path === undefined || path.length === 0) return;

  for (let i = 0; i < path.length; i++) {
    op(GET_PROPERTY_OP, path[i]);
  }
}

EXPRESSIONS.add(WIRE_UNDEFINED, (op) => PushPrimitiveReference(op, undefined));
EXPRESSIONS.add(WIRE_HAS_BLOCK, (op, [, block]) => {
  expr(op, block);
  op(HAS_BLOCK_OP);
});

EXPRESSIONS.add(WIRE_HAS_BLOCK_PARAMS, (op, [, block]) => {
  expr(op, block);
  op(SPREAD_BLOCK_OP);
  op(COMPILE_BLOCK_OP);
  op(HAS_BLOCK_PARAMS_OP);
});

EXPRESSIONS.add(WIRE_IF_INLINE, (op, [, condition, truthy, falsy]) => {
  // Push in reverse order
  expr(op, falsy);
  expr(op, truthy);
  expr(op, condition);
  op(IF_INLINE_OP);
});

EXPRESSIONS.add(WIRE_NOT, (op, [, value]) => {
  expr(op, value);
  op(NOT_OP);
});

EXPRESSIONS.add(WIRE_GET_DYNAMIC_VAR, (op, [, expression]) => {
  expr(op, expression);
  op(GET_DYNAMIC_VAR_OP);
});

EXPRESSIONS.add(WIRE_LOG, (op, [, positional]) => {
  op(PUSH_FRAME_OP);
  SimpleArgs(op, positional, null, false);
  op(LOG_OP);
  op(POP_FRAME_OP);
  op(FETCH_OP, $v0);
});
