import type {
  CompileTimeComponent,
  Optional,
  StatementSexpOpcode,
  WellKnownAttrName,
  WellKnownTagName,
  WireFormat,
} from '@glimmer/interfaces';
import type { RequireAtLeastOne, Simplify } from 'type-fest';
import {
  VM_COMPONENT_ATTR_OP,
  VM_DEBUGGER_OP,
  VM_DUP_OP,
  VM_DYNAMIC_ATTR_OP,
  VM_DYNAMIC_CONTENT_TYPE_OP,
  VM_ENTER_LIST_OP,
  VM_EXIT_LIST_OP,
  VM_INVOKE_STATIC_OP,
  VM_ITERATE_OP,
  VM_JUMP_OP,
  VM_MODIFIER_OP,
  VM_OPEN_ELEMENT_OP,
  VM_POP_FRAME_OP,
  VM_POP_OP,
  VM_POP_REMOTE_ELEMENT_OP,
  VM_PUSH_DYNAMIC_COMPONENT_INSTANCE_OP,
  VM_PUSH_FRAME_OP,
  VM_PUSH_REMOTE_ELEMENT_OP,
  VM_PUT_COMPONENT_OPERATIONS_OP,
  VM_RESOLVE_CURRIED_COMPONENT_OP,
  VM_RETURN_TO_OP,
  VM_STATIC_ATTR_OP,
  VM_STATIC_COMPONENT_ATTR_OP,
  VM_TEXT_OP,
  VM_TO_BOOLEAN_OP,
} from '@glimmer/constants';
import { $fp, $sp, ContentType } from '@glimmer/vm';
import { SexpOpcodes as Op } from '@glimmer/wire-format';

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
import { CompilePositional, SimpleArgs } from '../opcode-builder/helpers/shared';
import {
  Call,
  CallDynamicBlock,
  DynamicScope,
  PushPrimitiveReference,
} from '../opcode-builder/helpers/vm';
import { namedBlocks } from '../utils';
import { CloseElement, Comment, FlushElement, LexicalModifier } from './api';
import { Compilers } from './compilers';

export const STATEMENTS = new Compilers<StatementSexpOpcode>();

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

STATEMENTS.add(Op.Comment, (op, [, comment]) => Comment(op, comment));
STATEMENTS.add(Op.CloseElement, (op) => CloseElement(op));
STATEMENTS.add(Op.FlushElement, (op) => FlushElement(op));

STATEMENTS.add(Op.ResolvedModifier, (encode, [, expression, args]) => {
  encode.modifier(expression, (handle: number) => {
    encode.op(VM_PUSH_FRAME_OP);
    SimpleArgs(encode, args, false);
    encode.op(VM_MODIFIER_OP, handle);
    encode.op(VM_POP_FRAME_OP);
  });
});

STATEMENTS.add(Op.LexicalModifier, (encode, [, expression, args]) => {
  expr(encode, expression);
  LexicalModifier(
    encode,
    () => expr(encode, expression),
    () => SimpleArgs(encode, args, false)
  );
});

STATEMENTS.add(Op.StaticAttr, (encode, [, name, value, namespace]) => {
  encode.op(
    VM_STATIC_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(value as string),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(Op.StaticComponentAttr, (encode, [, name, value, namespace]) => {
  encode.op(
    VM_STATIC_COMPONENT_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(value as string),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(Op.DynamicAttr, (encode, [, name, value, namespace]) => {
  expr(encode, value);
  encode.op(
    VM_DYNAMIC_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(false),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(Op.TrustingDynamicAttr, (encode, [, name, value, namespace]) => {
  expr(encode, value);
  encode.op(
    VM_DYNAMIC_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(true),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(Op.ComponentAttr, (encode, [, name, value, namespace]) => {
  expr(encode, value);
  encode.op(
    VM_COMPONENT_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(false),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(Op.TrustingComponentAttr, (encode, [, name, value, namespace]) => {
  expr(encode, value);
  encode.op(
    VM_COMPONENT_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(true),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(Op.OpenElement, (encode, [, tag]) => {
  encode.op(VM_OPEN_ELEMENT_OP, encode.constant(inflateTagName(tag)));
});

STATEMENTS.add(Op.OpenElementWithSplat, (encode, [, tag]) => {
  encode.op(VM_PUT_COMPONENT_OPERATIONS_OP);
  encode.op(VM_OPEN_ELEMENT_OP, encode.constant(inflateTagName(tag)));
});

export function isLexicalCall(expr: WireFormat.Expression) {
  return Array.isArray(expr) && expr[0] === Op.GetLexicalSymbol;
}

STATEMENTS.add(Op.Yield, (encode, [, to, params]) => YieldBlock(encode, to, params));

STATEMENTS.add(Op.AttrSplat, (encode, [, to]) => YieldBlock(encode, to));

STATEMENTS.add(Op.Debugger, (encode, [, locals, upvars, lexical]) => {
  encode.op(VM_DEBUGGER_OP, encode.constant({ locals, upvars, lexical }));
});

STATEMENTS.add(Op.UnknownAppend, (encode, [, value]) => {
  encode.appendAny(value, {
    ifComponent(component: CompileTimeComponent) {
      InvokeComponent(encode, component);
    },

    ifHelper(handle: number) {
      encode.op(VM_PUSH_FRAME_OP);
      Call(encode, handle);
      encode.op(VM_INVOKE_STATIC_OP, encode.stdlibFn('cautious-non-dynamic-append'));
      encode.op(VM_POP_FRAME_OP);
    },
  });
});

// This opcode refers to this syntax:
//
// {{}}
STATEMENTS.add(Op.AppendResolved, (encode, [, value]) => {
  let [, expression, args] = value;

  encode.appendInvokable(expression, {
    ifComponent(component: CompileTimeComponent) {
      InvokeComponent(encode, component, compact({ hash: hashToArgs(args?.hash) }), args?.params);
    },
    ifHelper(handle: number) {
      encode.op(VM_PUSH_FRAME_OP);
      Call(encode, handle, args);
      encode.op(VM_INVOKE_STATIC_OP, encode.stdlibFn('cautious-non-dynamic-append'));
      encode.op(VM_POP_FRAME_OP);
    },
  });
});

STATEMENTS.add(Op.AppendLexical, (encode, [, value]) => {
  let [, expression, args] = value;

  SwitchCases(
    encode,
    () => {
      expr(encode, expression);
      encode.op(VM_DYNAMIC_CONTENT_TYPE_OP);
    },
    (when) => {
      when(ContentType.Component, () => {
        encode.op(VM_RESOLVE_CURRIED_COMPONENT_OP);
        encode.op(VM_PUSH_DYNAMIC_COMPONENT_INSTANCE_OP);
        InvokeNonStaticComponent(encode, {
          capabilities: true,
          positional: args?.params,
          named: args?.hash,
          atNames: false,
          blocks: namedBlocks(undefined),
        });
      });

      when(ContentType.Helper, () => {
        CallDynamicBlock(encode, encode.stdlibFn('cautious-non-dynamic-append'), args);
      });
    }
  );
});

STATEMENTS.add(Op.AppendStatic, (encode, [, value]) => {
  encode.op(
    VM_TEXT_OP,
    encode.constant(value === null || value === undefined ? '' : String(value))
  );
});

STATEMENTS.add(Op.Append, (encode, [, value]) => {
  encode.op(VM_PUSH_FRAME_OP);
  expr(encode, value);
  encode.op(VM_INVOKE_STATIC_OP, encode.stdlibFn('cautious-append'));
  encode.op(VM_POP_FRAME_OP);
});

STATEMENTS.add(Op.TrustingAppend, (encode, [, value]) => {
  if (!Array.isArray(value)) {
    encode.op(
      VM_TEXT_OP,
      encode.constant(value === null || value === undefined ? '' : String(value))
    );
  } else {
    encode.op(VM_PUSH_FRAME_OP);
    expr(encode, value);
    encode.op(VM_INVOKE_STATIC_OP, encode.stdlibFn('trusting-append'));
    encode.op(VM_POP_FRAME_OP);
  }
});

STATEMENTS.add(Op.LexicalBlockComponent, (encode, [, expr, args]) => {
  const component = encode.getLexicalComponent(expr);

  InvokeComponent(encode, component, args, args?.params);
});

STATEMENTS.add(Op.ResolvedBlock, (encode, [, expr, args]) => {
  const component = encode.resolveComponent(expr);

  InvokeComponent(
    encode,
    component,
    compact({
      hash: args?.hash,
      blocks: args?.blocks,
    }),
    args?.params
  );
});

STATEMENTS.add(Op.DynamicBlock, (encode, [, expr, args]) => {
  InvokeDynamicComponent(encode, expr, compact({ hash: args?.hash, blocks: args?.blocks }), {
    positional: args?.params,
  });
});

STATEMENTS.add(Op.InElement, (encode, [, block, guid, destination, insertBefore]) => {
  ReplayableIf(
    encode,

    () => {
      expr(encode, guid);

      if (insertBefore === undefined) {
        PushPrimitiveReference(encode, undefined);
      } else {
        expr(encode, insertBefore);
      }

      expr(encode, destination);
      encode.op(VM_DUP_OP, $sp, 0);

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

    () => {
      InvokeStaticBlock(encode, block);
    },

    inverse
      ? () => {
          InvokeStaticBlock(encode, inverse);
        }
      : undefined
  )
);

STATEMENTS.add(Op.Each, (encode, [, value, key, block, inverse]) =>
  Replayable(
    encode,

    () => {
      if (key) {
        expr(encode, key);
      } else {
        PushPrimitiveReference(encode, null);
      }

      expr(encode, value);

      return 2;
    },

    () => {
      encode.op(VM_ENTER_LIST_OP, encode.to('BODY'), encode.to('ELSE'));
      encode.op(VM_PUSH_FRAME_OP);
      encode.op(VM_DUP_OP, $fp, 1);
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
  )
);

STATEMENTS.add(Op.Let, (encode, [, positional, block]) => {
  let count = CompilePositional(encode, positional);
  InvokeStaticBlockWithStack(encode, block, count);
});

STATEMENTS.add(Op.WithDynamicVars, (encode, [, named, block]) => {
  if (named) {
    let [names, expressions] = named;

    CompilePositional(encode, expressions);
    DynamicScope(encode, names, () => {
      InvokeStaticBlockWithStack(encode, block, expressions.length);
    });
  } else {
    InvokeStaticBlockWithStack(encode, block, 0);
  }
});

STATEMENTS.add(Op.ResolvedComponent, (encode, [, expr, args]) => {
  const component = encode.resolveComponent(expr);
  InvokeComponent(encode, component, args);
});

STATEMENTS.add(Op.DynamicComponent, (encode, [, expr, args]) => {
  // otherwise, the component name was an expression, so resolve the expression
  // and invoke it as a dynamic component
  InvokeDynamicComponent(encode, expr, args, { atNames: true, curried: true });
});

STATEMENTS.add(Op.InvokeLexicalComponent, (encode, [, expr, args]) => {
  const component = encode.getLexicalComponent(expr);
  InvokeComponent(encode, component, args);
});

STATEMENTS.add(Op.InvokeDynamicComponent, (encode, [, expr, args]) => {
  InvokeDynamicComponent(encode, expr, compact({ hash: args?.hash, blocks: args?.blocks }), {
    positional: args?.params,
  });
});

STATEMENTS.add(Op.InvokeResolvedComponent, (encode, [, expr, args]) => {
  const component = encode.resolveComponent(expr);
  InvokeComponent(
    encode,
    component,
    compact({ hash: args?.hash, blocks: args?.blocks }),
    args?.params
  );
});

function hashToArgs(hash: Optional<WireFormat.Core.Hash>): Optional<WireFormat.Core.Hash> {
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
