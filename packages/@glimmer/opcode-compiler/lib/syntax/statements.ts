import type {
  CompileTimeComponent,
  StatementSexpOpcode,
  WellKnownAttrName,
  WellKnownTagName,
  WireFormat,
} from '@glimmer/interfaces';
import {
  $fp,
  $sp,
  PUSH_FRAME_OP,
  POP_FRAME_OP,
  INVOKE_STATIC_OP,
  JUMP_OP,
  RETURN_TO_OP,
  CLOSE_ELEMENT_OP,
  COMMENT_OP,
  COMPONENT_ATTR_OP,
  CONSTANT_REFERENCE_OP,
  DEBUGGER_OP,
  DUP_OP,
  DYNAMIC_ATTR_OP,
  DYNAMIC_CONTENT_TYPE_OP,
  DYNAMIC_MODIFIER_OP,
  ENTER_LIST_OP,
  EXIT_LIST_OP,
  FLUSH_ELEMENT_OP,
  ITERATE_OP,
  MODIFIER_OP,
  OPEN_ELEMENT_OP,
  POP_OP,
  POP_REMOTE_ELEMENT_OP,
  PUSH_DYNAMIC_COMPONENT_INSTANCE_OP,
  PUSH_REMOTE_ELEMENT_OP,
  PUT_COMPONENT_OPERATIONS_OP,
  RESOLVE_CURRIED_COMPONENT_OP,
  STATIC_ATTR_OP,
  STATIC_COMPONENT_ATTR_OP,
  TEXT_OP,
  TO_BOOLEAN_OP,
  COMPONENT_CONTENT,
  HELPER_CONTENT,
} from '@glimmer/vm-constants';

import {
  InvokeStaticBlock,
  InvokeStaticBlockWithStack,
  YieldBlock,
} from '../opcode-builder/helpers/blocks';
import {
  InvokeComponent,
  InvokeDynamicComponent,
  InvokeNonStaticComponent,
} from '../opcode-builder/helpers/components';
import { Replayable, ReplayableIf, SwitchCases } from '../opcode-builder/helpers/conditional';
import { expr } from '../opcode-builder/helpers/expr';
import {
  isGetFreeComponent,
  isGetFreeComponentOrHelper,
  isGetFreeModifier,
  isGetFreeOptionalComponentOrHelper,
} from '../opcode-builder/helpers/resolution';
import { CompilePositional, SimpleArgs } from '../opcode-builder/helpers/shared';
import {
  Call,
  CallDynamic,
  DynamicScope,
  PushPrimitiveReference,
} from '../opcode-builder/helpers/vm';
import { HighLevelBuilderOpcodes, HighLevelResolutionOpcodes } from '../opcode-builder/opcodes';
import { debugSymbolsOperand, labelOperand, stdlibOperand } from '../opcode-builder/operands';
import { namedBlocks } from '../utils';
import { Compilers, type PushStatementOp } from './compilers';
import {
  STDLIB_CAUTIOUS_GUARDED_APPEND,
  STDLIB_CAUTIOUS_NON_DYNAMIC_APPEND,
  STDLIB_TRUSTING_GUARDED_APPEND,
} from '../opcode-builder/stdlib';
import {
  WIRE_COMMENT,
  WIRE_CLOSE_ELEMENT,
  WIRE_FLUSH_ELEMENT,
  WIRE_MODIFIER,
  WIRE_STATIC_ATTR,
  WIRE_STATIC_COMPONENT_ATTR,
  WIRE_DYNAMIC_ATTR,
  WIRE_TRUSTING_DYNAMIC_ATTR,
  WIRE_COMPONENT_ATTR,
  WIRE_TRUSTING_COMPONENT_ATTR,
  WIRE_OPEN_ELEMENT,
  WIRE_OPEN_ELEMENT_WITH_SPLAT,
  WIRE_COMPONENT,
  WIRE_YIELD,
  WIRE_ATTR_SPLAT,
  WIRE_DEBUGGER,
  WIRE_APPEND,
  WIRE_CALL,
  WIRE_TRUSTING_APPEND,
  WIRE_BLOCK,
  WIRE_IN_ELEMENT,
  WIRE_IF,
  WIRE_EACH,
  WIRE_WITH,
  WIRE_LET,
  WIRE_WITH_DYNAMIC_VARS,
  WIRE_INVOKE_COMPONENT,
} from '@glimmer/wire-format';

export const STATEMENTS = new Compilers<PushStatementOp, StatementSexpOpcode>();

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

STATEMENTS.add(WIRE_COMMENT, (op, sexp) => op(COMMENT_OP, sexp[1]));
STATEMENTS.add(WIRE_CLOSE_ELEMENT, (op) => op(CLOSE_ELEMENT_OP));
STATEMENTS.add(WIRE_FLUSH_ELEMENT, (op) => op(FLUSH_ELEMENT_OP));

STATEMENTS.add(WIRE_MODIFIER, (op, [, expression, positional, named]) => {
  if (isGetFreeModifier(expression)) {
    op(HighLevelResolutionOpcodes.Modifier, expression, (handle: number) => {
      op(PUSH_FRAME_OP);
      SimpleArgs(op, positional, named, false);
      op(MODIFIER_OP, handle);
      op(POP_FRAME_OP);
    });
  } else {
    expr(op, expression);
    op(PUSH_FRAME_OP);
    SimpleArgs(op, positional, named, false);
    op(DUP_OP, $fp, 1);
    op(DYNAMIC_MODIFIER_OP);
    op(POP_FRAME_OP);
  }
});

STATEMENTS.add(WIRE_STATIC_ATTR, (op, [, name, value, namespace]) => {
  op(STATIC_ATTR_OP, inflateAttrName(name), value as string, namespace ?? null);
});

STATEMENTS.add(WIRE_STATIC_COMPONENT_ATTR, (op, [, name, value, namespace]) => {
  op(STATIC_COMPONENT_ATTR_OP, inflateAttrName(name), value as string, namespace ?? null);
});

STATEMENTS.add(WIRE_DYNAMIC_ATTR, (op, [, name, value, namespace]) => {
  expr(op, value);
  op(DYNAMIC_ATTR_OP, inflateAttrName(name), false, namespace ?? null);
});

STATEMENTS.add(WIRE_TRUSTING_DYNAMIC_ATTR, (op, [, name, value, namespace]) => {
  expr(op, value);
  op(DYNAMIC_ATTR_OP, inflateAttrName(name), true, namespace ?? null);
});

STATEMENTS.add(WIRE_COMPONENT_ATTR, (op, [, name, value, namespace]) => {
  expr(op, value);
  op(COMPONENT_ATTR_OP, inflateAttrName(name), false, namespace ?? null);
});

STATEMENTS.add(WIRE_TRUSTING_COMPONENT_ATTR, (op, [, name, value, namespace]) => {
  expr(op, value);
  op(COMPONENT_ATTR_OP, inflateAttrName(name), true, namespace ?? null);
});

STATEMENTS.add(WIRE_OPEN_ELEMENT, (op, [, tag]) => {
  op(OPEN_ELEMENT_OP, inflateTagName(tag));
});

STATEMENTS.add(WIRE_OPEN_ELEMENT_WITH_SPLAT, (op, [, tag]) => {
  op(PUT_COMPONENT_OPERATIONS_OP);
  op(OPEN_ELEMENT_OP, inflateTagName(tag));
});

STATEMENTS.add(WIRE_COMPONENT, (op, [, expr, elementBlock, named, blocks]) => {
  if (isGetFreeComponent(expr)) {
    op(HighLevelResolutionOpcodes.Component, expr, (component: CompileTimeComponent) => {
      InvokeComponent(op, component, elementBlock, null, named, blocks);
    });
  } else {
    // otherwise, the component name was an expression, so resolve the expression
    // and invoke it as a dynamic component
    InvokeDynamicComponent(op, expr, elementBlock, null, named, blocks, true, true);
  }
});

STATEMENTS.add(WIRE_YIELD, (op, [, to, params]) => YieldBlock(op, to, params));

STATEMENTS.add(WIRE_ATTR_SPLAT, (op, [, to]) => YieldBlock(op, to, null));

STATEMENTS.add(WIRE_DEBUGGER, (op, [, debugInfo]) =>
  op(DEBUGGER_OP, debugSymbolsOperand(), debugInfo)
);

STATEMENTS.add(WIRE_APPEND, (op, [, value]) => {
  // Special case for static values
  if (!Array.isArray(value)) {
    op(TEXT_OP, value === null || value === undefined ? '' : String(value));
  } else if (isGetFreeOptionalComponentOrHelper(value)) {
    op(HighLevelResolutionOpcodes.OptionalComponentOrHelper, value, {
      ifComponent(component: CompileTimeComponent) {
        InvokeComponent(op, component, null, null, null, null);
      },

      ifHelper(handle: number) {
        op(PUSH_FRAME_OP);
        Call(op, handle, null, null);
        op(INVOKE_STATIC_OP, stdlibOperand(STDLIB_CAUTIOUS_NON_DYNAMIC_APPEND));
        op(POP_FRAME_OP);
      },

      ifValue(handle: number) {
        op(PUSH_FRAME_OP);
        op(CONSTANT_REFERENCE_OP, handle);
        op(INVOKE_STATIC_OP, stdlibOperand(STDLIB_CAUTIOUS_NON_DYNAMIC_APPEND));
        op(POP_FRAME_OP);
      },
    });
  } else if (value[0] === WIRE_CALL) {
    let [, expression, positional, named] = value;

    if (isGetFreeComponentOrHelper(expression)) {
      op(HighLevelResolutionOpcodes.ComponentOrHelper, expression, {
        ifComponent(component: CompileTimeComponent) {
          InvokeComponent(op, component, null, positional, hashToArgs(named), null);
        },
        ifHelper(handle: number) {
          op(PUSH_FRAME_OP);
          Call(op, handle, positional, named);
          op(INVOKE_STATIC_OP, stdlibOperand(STDLIB_CAUTIOUS_NON_DYNAMIC_APPEND));
          op(POP_FRAME_OP);
        },
      });
    } else {
      SwitchCases(
        op,
        () => {
          expr(op, expression);
          op(DYNAMIC_CONTENT_TYPE_OP);
        },
        (when) => {
          when(COMPONENT_CONTENT, () => {
            op(RESOLVE_CURRIED_COMPONENT_OP);
            op(PUSH_DYNAMIC_COMPONENT_INSTANCE_OP);
            InvokeNonStaticComponent(op, {
              capabilities: true,
              elementBlock: null,
              positional,
              named,
              atNames: false,
              blocks: namedBlocks(null),
            });
          });

          when(HELPER_CONTENT, () => {
            CallDynamic(op, positional, named, () => {
              op(INVOKE_STATIC_OP, stdlibOperand(STDLIB_CAUTIOUS_NON_DYNAMIC_APPEND));
            });
          });
        }
      );
    }
  } else {
    op(PUSH_FRAME_OP);
    expr(op, value);
    op(INVOKE_STATIC_OP, stdlibOperand(STDLIB_CAUTIOUS_GUARDED_APPEND));
    op(POP_FRAME_OP);
  }
});

STATEMENTS.add(WIRE_TRUSTING_APPEND, (op, [, value]) => {
  if (!Array.isArray(value)) {
    op(TEXT_OP, value === null || value === undefined ? '' : String(value));
  } else {
    op(PUSH_FRAME_OP);
    expr(op, value);
    op(INVOKE_STATIC_OP, stdlibOperand(STDLIB_TRUSTING_GUARDED_APPEND));
    op(POP_FRAME_OP);
  }
});

STATEMENTS.add(WIRE_BLOCK, (op, [, expr, positional, named, blocks]) => {
  if (isGetFreeComponent(expr)) {
    op(HighLevelResolutionOpcodes.Component, expr, (component: CompileTimeComponent) => {
      InvokeComponent(op, component, null, positional, hashToArgs(named), blocks);
    });
  } else {
    InvokeDynamicComponent(op, expr, null, positional, named, blocks, false, false);
  }
});

STATEMENTS.add(WIRE_IN_ELEMENT, (op, [, block, guid, destination, insertBefore]) => {
  ReplayableIf(
    op,

    () => {
      expr(op, guid);

      if (insertBefore === undefined) {
        PushPrimitiveReference(op, undefined);
      } else {
        expr(op, insertBefore);
      }

      expr(op, destination);
      op(DUP_OP, $sp, 0);

      return 4;
    },

    () => {
      op(PUSH_REMOTE_ELEMENT_OP);
      InvokeStaticBlock(op, block);
      op(POP_REMOTE_ELEMENT_OP);
    }
  );
});

STATEMENTS.add(WIRE_IF, (op, [, condition, block, inverse]) =>
  ReplayableIf(
    op,
    () => {
      expr(op, condition);
      op(TO_BOOLEAN_OP);

      return 1;
    },

    () => {
      InvokeStaticBlock(op, block);
    },

    inverse
      ? () => {
          InvokeStaticBlock(op, inverse);
        }
      : undefined
  )
);

STATEMENTS.add(WIRE_EACH, (op, [, value, key, block, inverse]) =>
  Replayable(
    op,

    () => {
      if (key) {
        expr(op, key);
      } else {
        PushPrimitiveReference(op, null);
      }

      expr(op, value);

      return 2;
    },

    () => {
      op(ENTER_LIST_OP, labelOperand('BODY'), labelOperand('ELSE'));
      op(PUSH_FRAME_OP);
      op(DUP_OP, $fp, 1);
      op(RETURN_TO_OP, labelOperand('ITER'));
      op(HighLevelBuilderOpcodes.Label, 'ITER');
      op(ITERATE_OP, labelOperand('BREAK'));
      op(HighLevelBuilderOpcodes.Label, 'BODY');
      InvokeStaticBlockWithStack(op, block, 2);
      op(POP_OP, 2);
      op(JUMP_OP, labelOperand('FINALLY'));
      op(HighLevelBuilderOpcodes.Label, 'BREAK');
      op(POP_FRAME_OP);
      op(EXIT_LIST_OP);
      op(JUMP_OP, labelOperand('FINALLY'));
      op(HighLevelBuilderOpcodes.Label, 'ELSE');

      if (inverse) {
        InvokeStaticBlock(op, inverse);
      }
    }
  )
);

STATEMENTS.add(WIRE_WITH, (op, [, value, block, inverse]) => {
  ReplayableIf(
    op,

    () => {
      expr(op, value);
      op(DUP_OP, $sp, 0);
      op(TO_BOOLEAN_OP);

      return 2;
    },

    () => {
      InvokeStaticBlockWithStack(op, block, 1);
    },

    () => {
      if (inverse) {
        InvokeStaticBlock(op, inverse);
      }
    }
  );
});

STATEMENTS.add(WIRE_LET, (op, [, positional, block]) => {
  let count = CompilePositional(op, positional);
  InvokeStaticBlockWithStack(op, block, count);
});

STATEMENTS.add(WIRE_WITH_DYNAMIC_VARS, (op, [, named, block]) => {
  if (named) {
    let [names, expressions] = named;

    CompilePositional(op, expressions);
    DynamicScope(op, names, () => {
      InvokeStaticBlock(op, block);
    });
  } else {
    InvokeStaticBlock(op, block);
  }
});

STATEMENTS.add(WIRE_INVOKE_COMPONENT, (op, [, expr, positional, named, blocks]) => {
  if (isGetFreeComponent(expr)) {
    op(HighLevelResolutionOpcodes.Component, expr, (component: CompileTimeComponent) => {
      InvokeComponent(op, component, null, positional, hashToArgs(named), blocks);
    });
  } else {
    InvokeDynamicComponent(op, expr, null, positional, named, blocks, false, false);
  }
});

function hashToArgs(hash: WireFormat.Core.Hash | null): WireFormat.Core.Hash | null {
  if (hash === null) return null;
  let names = hash[0].map((key) => `@${key}`);
  return [names as [string, ...string[]], hash[1]];
}
