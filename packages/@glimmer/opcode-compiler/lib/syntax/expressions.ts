import { assert, deprecate } from '@glimmer/global-context';
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
import { SimpleArguments } from '../opcode-builder/helpers/shared';
import { Call, CallDynamic, Curry, PushPrimitiveReference } from '../opcode-builder/helpers/vm';
import type { PushExpressionOp } from './compiler-impl';
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
import { defineExpr } from './compilers';
import {
  RESOLVE_FREE,
  RESOLVE_HELPER,
  RESOLVE_LOCAL,
  RESOLVE_OPTIONAL_HELPER,
  RESOLVE_TEMPLATE_LOCAL,
} from '../opcode-builder/opcodes';

defineExpr(WIRE_CONCAT, (op, [, parts]) => {
  for (let part of parts) {
    expr(op, part);
  }

  op(CONCAT_OP, parts.length);
});

defineExpr(WIRE_CALL, (op, [, expression, positional, named]) => {
  if (isGetFreeHelper(expression)) {
    op(RESOLVE_HELPER, expression, (handle: number) => {
      Call(op, handle, positional, named);
    });
  } else {
    expr(op, expression);
    CallDynamic(op, positional, named);
  }
});

defineExpr(WIRE_CURRY, (op, [, expr, type, positional, named]) => {
  Curry(op, type, expr, positional, named);
});

defineExpr(WIRE_GET_SYMBOL, (op, [, sym, path]) => {
  op(GET_VARIABLE_OP, sym);
  withPath(op, path);
});

defineExpr(WIRE_GET_LEXICAL_SYMBOL, (op, [, sym, path]) => {
  op(RESOLVE_TEMPLATE_LOCAL, sym, (handle: number) => {
    op(CONSTANT_REFERENCE_OP, handle);
    withPath(op, path);
  });
});

defineExpr(WIRE_GET_STRICT_KEYWORD, (op, [, sym, _path]) => {
  op(RESOLVE_FREE, sym, (_handle: unknown) => {
    // TODO: Implement in strict mode
  });
});

defineExpr(WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OR_THIS_FALLBACK, () => {
  // TODO: The logic for this opcode currently exists in STATEMENTS.Append, since
  // we want different wrapping logic depending on if we are invoking a component,
  // helper, or {{this}} fallback. Eventually we fix the opcodes so that we can
  // traverse the subexpression tree like normal in this location.
  throw new Error('unimplemented opcode');
});

defineExpr(WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK, (op, expr) => {
  // <div id={{baz}}>

  op(RESOLVE_LOCAL, expr[1], (_name: string) => {
    op(RESOLVE_OPTIONAL_HELPER, expr, {
      ifHelper: (handle: number) => {
        Call(op, handle, null, null);
      },
    });
  });
});

defineExpr(WIRE_GET_FREE_AS_DEPRECATED_HELPER_HEAD_OR_THIS_FALLBACK, (op, expr) => {
  // <Foo @bar={{baz}}>

  op(RESOLVE_LOCAL, expr[1], (_name: string) => {
    op(RESOLVE_OPTIONAL_HELPER, expr, {
      ifHelper: (handle: number, name: string, moduleName: string) => {
        assert(expr[2] && expr[2].length === 1, '[BUG] Missing argument name');

        let argument = expr[2][0];

        deprecate(
          `The \`${name}\` helper was used in the \`${moduleName}\` template as \`${argument}={{${name}}}\`. ` +
            `This is ambigious between wanting the \`${argument}\` argument to be the \`${name}\` helper itself, ` +
            `or the result of invoking the \`${name}\` helper (current behavior). ` +
            `This implicit invocation behavior has been deprecated.\n\n` +
            `Instead, please explicitly invoke the helper with parenthesis, i.e. \`${argument}={{(${name})}}\`.\n\n` +
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

  for (let element of path) {
    op(GET_PROPERTY_OP, element);
  }
}

defineExpr(WIRE_UNDEFINED, (op) => PushPrimitiveReference(op, void 0));
defineExpr(WIRE_HAS_BLOCK, (op, [, block]) => {
  expr(op, block);
  op(HAS_BLOCK_OP);
});

defineExpr(WIRE_HAS_BLOCK_PARAMS, (op, [, block]) => {
  expr(op, block);
  op(SPREAD_BLOCK_OP);
  op(COMPILE_BLOCK_OP);
  op(HAS_BLOCK_PARAMS_OP);
});

defineExpr(WIRE_IF_INLINE, (op, [, condition, truthy, falsy]) => {
  // Push in reverse order
  expr(op, falsy);
  expr(op, truthy);
  expr(op, condition);
  op(IF_INLINE_OP);
});

defineExpr(WIRE_NOT, (op, [, value]) => {
  expr(op, value);
  op(NOT_OP);
});

defineExpr(WIRE_GET_DYNAMIC_VAR, (op, [, expression]) => {
  expr(op, expression);
  op(GET_DYNAMIC_VAR_OP);
});

defineExpr(WIRE_LOG, (op, [, positional]) => {
  op(PUSH_FRAME_OP);
  SimpleArguments(op, positional, null, false);
  op(LOG_OP);
  op(POP_FRAME_OP);
  op(FETCH_OP, $v0);
});
