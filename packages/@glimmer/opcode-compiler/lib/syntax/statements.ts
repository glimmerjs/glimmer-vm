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
  VM_CONSTANT_REFERENCE_OP,
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
import { SexpOpcodes } from '@glimmer/wire-format';

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
import { isGetFreeComponent } from '../opcode-builder/helpers/resolution';
import { CompilePositional, SimpleArgs } from '../opcode-builder/helpers/shared';
import {
  Call,
  CallDynamic,
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

STATEMENTS.add(SexpOpcodes.Comment, (op, [, comment]) => Comment(op, comment));
STATEMENTS.add(SexpOpcodes.CloseElement, (op) => CloseElement(op));
STATEMENTS.add(SexpOpcodes.FlushElement, (op) => FlushElement(op));

STATEMENTS.add(SexpOpcodes.ResolvedModifier, (encode, [, expression, args]) => {
  encode.modifier(expression, (handle: number) => {
    encode.op(VM_PUSH_FRAME_OP);
    SimpleArgs(encode, args, false);
    encode.op(VM_MODIFIER_OP, handle);
    encode.op(VM_POP_FRAME_OP);
  });
});

STATEMENTS.add(SexpOpcodes.LexicalModifier, (encode, [, expression, args]) => {
  expr(encode, expression);
  LexicalModifier(
    encode,
    () => expr(encode, expression),
    () => {
      return SimpleArgs(encode, args, false);
    }
  );
});

STATEMENTS.add(SexpOpcodes.StaticAttr, (encode, [, name, value, namespace]) => {
  encode.op(
    VM_STATIC_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(value as string),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(SexpOpcodes.StaticComponentAttr, (encode, [, name, value, namespace]) => {
  encode.op(
    VM_STATIC_COMPONENT_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(value as string),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(SexpOpcodes.DynamicAttr, (encode, [, name, value, namespace]) => {
  expr(encode, value);
  encode.op(
    VM_DYNAMIC_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(false),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(SexpOpcodes.TrustingDynamicAttr, (encode, [, name, value, namespace]) => {
  expr(encode, value);
  encode.op(
    VM_DYNAMIC_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(true),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(SexpOpcodes.ComponentAttr, (encode, [, name, value, namespace]) => {
  expr(encode, value);
  encode.op(
    VM_COMPONENT_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(false),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(SexpOpcodes.TrustingComponentAttr, (encode, [, name, value, namespace]) => {
  expr(encode, value);
  encode.op(
    VM_COMPONENT_ATTR_OP,
    encode.constant(inflateAttrName(name)),
    encode.constant(true),
    encode.constant(namespace ?? null)
  );
});

STATEMENTS.add(SexpOpcodes.OpenElement, (encode, [, tag]) => {
  encode.op(VM_OPEN_ELEMENT_OP, encode.constant(inflateTagName(tag)));
});

STATEMENTS.add(SexpOpcodes.OpenElementWithSplat, (encode, [, tag]) => {
  encode.op(VM_PUT_COMPONENT_OPERATIONS_OP);
  encode.op(VM_OPEN_ELEMENT_OP, encode.constant(inflateTagName(tag)));
});

STATEMENTS.add(SexpOpcodes.Component, (encode, [, expr, args]) => {
  if (isGetFreeComponent(expr)) {
    encode.component(expr, (component: CompileTimeComponent) => {
      InvokeComponent(encode, component, args);
    });
  } else {
    // otherwise, the component name was an expression, so resolve the expression
    // and invoke it as a dynamic component
    InvokeDynamicComponent(encode, expr, args, { atNames: true, curried: true });
  }
});

STATEMENTS.add(SexpOpcodes.Yield, (encode, [, to, params]) => YieldBlock(encode, to, params));

STATEMENTS.add(SexpOpcodes.AttrSplat, (encode, [, to]) => YieldBlock(encode, to));

STATEMENTS.add(SexpOpcodes.Debugger, (encode, [, locals, upvars, lexical]) => {
  encode.op(VM_DEBUGGER_OP, encode.constant({ locals, upvars, lexical }));
});

STATEMENTS.add(SexpOpcodes.UnknownAppend, (encode, [, value]) => {
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

    ifValue(handle: number) {
      encode.op(VM_PUSH_FRAME_OP);
      encode.op(VM_CONSTANT_REFERENCE_OP, handle);
      encode.op(VM_INVOKE_STATIC_OP, encode.stdlibFn('cautious-non-dynamic-append'));
      encode.op(VM_POP_FRAME_OP);
    },
  });
});

STATEMENTS.add(SexpOpcodes.Append, (encode, [, value]) => {
  // Special case for static values
  if (!Array.isArray(value)) {
    encode.op(
      VM_TEXT_OP,
      encode.constant(value === null || value === undefined ? '' : String(value))
    );
  } else if (value[0] === SexpOpcodes.CallLexical) {
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
          CallDynamic(encode, args, () => {
            encode.op(VM_INVOKE_STATIC_OP, encode.stdlibFn('cautious-non-dynamic-append'));
          });
        });
      }
    );
  } else if (value[0] === SexpOpcodes.CallResolved) {
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
  } else {
    encode.op(VM_PUSH_FRAME_OP);
    expr(encode, value);
    encode.op(VM_INVOKE_STATIC_OP, encode.stdlibFn('cautious-append'));
    encode.op(VM_POP_FRAME_OP);
  }
});

STATEMENTS.add(SexpOpcodes.TrustingAppend, (encode, [, value]) => {
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

STATEMENTS.add(SexpOpcodes.Block, (encode, [, expr, args]) => {
  if (isGetFreeComponent(expr)) {
    encode.component(expr, (component: CompileTimeComponent) => {
      InvokeComponent(
        encode,
        component,
        compact({
          hash: hashToArgs(args?.hash),
          blocks: args?.blocks,
        }),
        args?.params
      );
    });
  } else {
    InvokeDynamicComponent(encode, expr, compact({ hash: args?.hash, blocks: args?.blocks }), {
      positional: args?.params,
    });
  }
});

STATEMENTS.add(SexpOpcodes.InElement, (encode, [, block, guid, destination, insertBefore]) => {
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

STATEMENTS.add(SexpOpcodes.If, (encode, [, condition, block, inverse]) =>
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

STATEMENTS.add(SexpOpcodes.Each, (encode, [, value, key, block, inverse]) =>
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

STATEMENTS.add(SexpOpcodes.Let, (encode, [, positional, block]) => {
  let count = CompilePositional(encode, positional);
  InvokeStaticBlockWithStack(encode, block, count);
});

STATEMENTS.add(SexpOpcodes.WithDynamicVars, (encode, [, named, block]) => {
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

STATEMENTS.add(SexpOpcodes.InvokeLexicalComponent, (encode, [, expr, args]) => {
  InvokeDynamicComponent(encode, expr, compact({ hash: args?.hash, blocks: args?.blocks }), {
    positional: args?.params,
  });
});

STATEMENTS.add(SexpOpcodes.InvokeResolvedComponent, (encode, [, expr, args]) => {
  encode.component(expr, (component: CompileTimeComponent) => {
    InvokeComponent(
      encode,
      component,
      compact({ hash: hashToArgs(args?.hash), blocks: args?.blocks }),
      args?.params
    );
  });
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
