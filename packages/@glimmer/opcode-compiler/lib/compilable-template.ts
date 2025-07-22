import type {
  BlockMetadata,
  BlockSymbolTable,
  CompilableBlock,
  CompilableProgram,
  CompilableTemplate,
  CompileTimeComponent,
  Content,
  EvaluationContext,
  HandleResult,
  LayoutWithContext,
  Nullable,
  SerializedBlock,
  SerializedInlineBlock,
  SymbolTable,
  WireFormat,
} from '@glimmer/interfaces';
import {
  IS_COMPILABLE_TEMPLATE,
  VM_BIND_DYNAMIC_SCOPE_OP,
  VM_CALL_SUB_OP,
  VM_CHILD_SCOPE_OP,
  VM_CLOSE_ELEMENT_OP,
  VM_COMMENT_OP,
  VM_COMPILE_BLOCK_OP,
  VM_COMPONENT_ATTR_OP,
  VM_DEBUGGER_OP,
  VM_DUP_FP_OP,
  VM_DYNAMIC_ATTR_OP,
  VM_DYNAMIC_CONTENT_TYPE_OP,
  VM_DYNAMIC_HELPER_OP,
  VM_DYNAMIC_MODIFIER_OP,
  VM_FLUSH_ELEMENT_OP,
  VM_GET_BLOCK_OP,
  VM_INVOKE_STATIC_OP,
  VM_INVOKE_YIELD_OP,
  VM_JIT_INVOKE_VIRTUAL_OP,
  VM_MODIFIER_OP,
  VM_OPEN_ELEMENT_OP,
  VM_POP_DYNAMIC_SCOPE_OP,
  VM_POP_FRAME_OP,
  VM_POP_SCOPE_OP,
  VM_PUSH_COMPONENT_DEFINITION_OP,
  VM_PUSH_EMPTY_ARGS_OP,
  VM_PUSH_FRAME_OP,
  VM_PUT_COMPONENT_OPERATIONS_OP,
  VM_RESOLVE_COMPONENT_DEFINITION,
  VM_SET_VARIABLE_OP,
  VM_SPREAD_BLOCK_OP,
  VM_STATIC_ATTR_OP,
  VM_STATIC_COMPONENT_ATTR_OP,
  VM_TEXT_OP,
} from '@glimmer/constants';
import { LOCAL_TRACE_LOGGING } from '@glimmer/local-debug-flags';
import { EMPTY_ARRAY } from '@glimmer/util';
import { ContentType } from '@glimmer/vm';
import { EMPTY_ARGS_OPCODE, SexpOpcodes as Op } from '@glimmer/wire-format';

import { debugCompiler } from './compiler';
import { templateCompilationContext } from './opcode-builder/context';
import { EncodeOp } from './opcode-builder/encoder';
import { InvokeStaticBlockWithPresentStack } from './opcode-builder/helpers/blocks';
import {
  InvokeDynamicComponent,
  InvokeReplayableComponentExpression,
  InvokeResolvedComponent,
  InvokeStaticComponent,
} from './opcode-builder/helpers/components';
import { SwitchCases } from './opcode-builder/helpers/conditional';
import { compilePositional, expr } from './opcode-builder/helpers/expr';
import { CompilePresentPositional, meta, SimpleArgs } from './opcode-builder/helpers/shared';
import { Call } from './opcode-builder/helpers/vm';
import { inflateAttrName, inflateTagName, prefixAtNames, STATEMENTS } from './syntax/statements';

export const PLACEHOLDER_HANDLE = -1;

class CompilableTemplateImpl<S extends SymbolTable> implements CompilableTemplate<S> {
  static {
    if (LOCAL_TRACE_LOGGING) {
      Reflect.set(this.prototype, IS_COMPILABLE_TEMPLATE, true);
    }
  }

  compiled: Nullable<HandleResult> = null;

  constructor(
    readonly statements: WireFormat.Content[],
    readonly meta: BlockMetadata,
    // Part of CompilableTemplate
    readonly symbolTable: S,
    // Used for debugging
    readonly moduleName = 'plain block'
  ) {}

  // Part of CompilableTemplate
  compile(context: EvaluationContext): HandleResult {
    return maybeCompile(this, context);
  }
}

export function compilable(layout: LayoutWithContext, moduleName: string): CompilableProgram {
  let [statements, symbols] = layout.block;
  return new CompilableTemplateImpl(
    statements,
    meta(layout),
    {
      symbols,
    },
    moduleName
  );
}

function maybeCompile(
  compilable: CompilableTemplateImpl<SymbolTable>,
  context: EvaluationContext
): HandleResult {
  if (compilable.compiled !== null) return compilable.compiled;

  compilable.compiled = PLACEHOLDER_HANDLE;

  let { statements, meta } = compilable;

  let result = compileStatements(statements, meta, context);
  compilable.compiled = result;

  return result;
}

export function compileStatements(
  statements: Content[],
  meta: BlockMetadata,
  syntaxContext: EvaluationContext
): HandleResult {
  let context = templateCompilationContext(syntaxContext, meta);

  let { encoder, evaluation } = context;

  const encode = new EncodeOp(encoder, evaluation, meta);

  for (const statement of statements) {
    compileContent(encode, statement);
  }

  let handle = context.encoder.commit(meta.size);

  if (LOCAL_TRACE_LOGGING) {
    debugCompiler(context, handle);
  }

  return handle;
}

export function compileContent(encode: EncodeOp, content: Content): void {
  switch (content[0]) {
    case Op.Comment: {
      encode.op(VM_COMMENT_OP, encode.constant(content[1]));
      return;
    }

    case Op.AppendHtmlText: {
      encode.op(VM_TEXT_OP, encode.constant(content[1]));
      return;
    }

    case Op.InvokeLexicalComponent: {
      const [, expr, args] = content;

      const component = encode.getLexicalComponent(expr);
      encode.op(VM_PUSH_COMPONENT_DEFINITION_OP, component.handle);

      InvokeStaticComponent(encode, args, component);
      return;
    }

    case Op.InvokeResolvedComponent: {
      const [, expr, args] = content;

      const component = encode.resolveComponent(expr);
      encode.op(VM_PUSH_COMPONENT_DEFINITION_OP, component.handle);

      InvokeResolvedComponent(encode, component, args);
      return;
    }

    case Op.InvokeDynamicBlock: {
      const [, expr, args] = content;

      InvokeReplayableComponentExpression(encode, expr, args);
      return;
    }

    case Op.AppendResolvedValueCautiously: {
      const [, callee] = content;

      encode.append(callee, {
        ifComponent(component: CompileTimeComponent) {
          encode.op(VM_PUSH_COMPONENT_DEFINITION_OP, component.handle);
          InvokeResolvedComponent(encode, component, [EMPTY_ARGS_OPCODE]);
        },
        ifHelper(handle: number) {
          encode.op(VM_PUSH_FRAME_OP);
          Call(encode, handle, [EMPTY_ARGS_OPCODE]);
          // Use the dynamic version to support helper-returns-helper
          encode.op(VM_INVOKE_STATIC_OP, encode.stdlibFn('cautious-append'));
          encode.op(VM_POP_FRAME_OP);
        },
      });
      return;
    }

    case Op.AppendTrustedResolvedHtml: {
      const [, callee] = content;

      encode.append(callee, {
        ifComponent(component: CompileTimeComponent) {
          encode.op(VM_PUSH_COMPONENT_DEFINITION_OP, component.handle);
          InvokeResolvedComponent(encode, component, [EMPTY_ARGS_OPCODE]);
        },
        ifHelper(handle: number) {
          encode.op(VM_PUSH_FRAME_OP);
          Call(encode, handle, [EMPTY_ARGS_OPCODE]);
          // Use the dynamic version to support helper-returns-helper
          encode.op(VM_INVOKE_STATIC_OP, encode.stdlibFn('trusting-append'));
          encode.op(VM_POP_FRAME_OP);
        },
      });
      return;
    }

    // In classic mode only, this corresponds to `{{name ...args}}` where `name` is not an in-scope
    // variable. In strict mode, this is a syntax error.
    //
    // In classic mode, `name` is resolved first as a component, and then as a helper. If either
    // succeeds, it is compiled into the appropriate invocation. If neither succeeds, it turns into an
    // early error.
    case Op.AppendResolvedInvokableCautiously:
    case Op.AppendTrustedResolvedInvokable: {
      const [, callee, args] = content;

      encode.append(callee, {
        ifComponent(component: CompileTimeComponent) {
          encode.op(VM_PUSH_COMPONENT_DEFINITION_OP, component.handle);
          InvokeResolvedComponent(encode, component, prefixAtNames(args));
        },
        ifHelper(handle: number) {
          encode.op(VM_PUSH_FRAME_OP);
          Call(encode, handle, args);
          // Use the dynamic version to support helper-returns-helper
          encode.op(
            VM_INVOKE_STATIC_OP,
            content[0] === Op.AppendTrustedResolvedInvokable
              ? encode.stdlibFn('trusting-append')
              : encode.stdlibFn('cautious-append')
          );
          encode.op(VM_POP_FRAME_OP);
        },
      });
      return;
    }

    case Op.AppendInvokableCautiously: {
      const [, callee, args] = content;
      // This corresponds to `{{<expr> ...args}}` where `<expr>` only references in-scope variables (and
      // no resolved variables).
      //
      // This generates code that allows the expression to change between a component and helper value. If
      // the value changes, the output is cleared the right behavior occurs.
      //
      // @todo Specialize the lexical variable case, since we can determine what kind of callee we're
      // looking at at compile time.
      SwitchCases(
        encode,
        () => {
          expr(encode, callee);
          encode.op(VM_DYNAMIC_CONTENT_TYPE_OP);
        },
        (when) => {
          when(ContentType.Component, () => {
            encode.op(VM_RESOLVE_COMPONENT_DEFINITION);
            InvokeDynamicComponent(encode, prefixAtNames(args));
          });

          when(ContentType.Helper, () => {
            // Call the helper with the provided args
            encode.op(VM_PUSH_FRAME_OP);
            SimpleArgs(encode, args);
            encode.op(VM_DYNAMIC_HELPER_OP);
            encode.op(VM_POP_FRAME_OP);

            // After POP_FRAME, the helper result is at the top of the stack
            // Now use simple call to invoke the stdlib function
            encode.op(VM_CALL_SUB_OP, encode.stdlibFn('cautious-dynamic-helper-append'));
          });
        }
      );

      return;
    }

    case Op.AppendTrustedHtml: {
      const [, value] = content;
      encode.op(VM_PUSH_FRAME_OP);
      expr(encode, value);
      encode.op(VM_INVOKE_STATIC_OP, encode.stdlibFn('trusting-append'));
      encode.op(VM_POP_FRAME_OP);
      return;
    }

    case Op.AppendValueCautiously: {
      const [, value] = content;
      encode.op(VM_PUSH_FRAME_OP);
      expr(encode, value);
      encode.op(VM_INVOKE_STATIC_OP, encode.stdlibFn('cautious-append'));
      encode.op(VM_POP_FRAME_OP);
      return;
    }

    case Op.AppendStatic: {
      const [, expr] = content;

      // The only static value that is an array is [Undefined].
      const value = Array.isArray(expr) || expr === null ? '' : String(expr);
      encode.op(VM_TEXT_OP, encode.constant(value));
      return;
    }

    case Op.OpenElementWithSplat:
      encode.op(VM_PUT_COMPONENT_OPERATIONS_OP);
    // intentional fallthrough

    case Op.OpenElement: {
      const [, tag] = content;
      encode.op(VM_OPEN_ELEMENT_OP, encode.constant(inflateTagName(tag)));
      return;
    }

    case Op.CloseElement: {
      encode.op(VM_CLOSE_ELEMENT_OP);
      return;
    }

    case Op.FlushElement: {
      encode.op(VM_FLUSH_ELEMENT_OP);
      return;
    }

    case Op.AttrSplat: {
      const [, to] = content;
      encode.op(VM_PUSH_EMPTY_ARGS_OP);
      compileYield(encode, to);
      return;
    }

    case Op.Yield: {
      const [, to, params] = content;
      compilePositional(encode, params);
      compileYield(encode, to);
      return;
    }

    case Op.StaticAttr: {
      const [, name, value, namespace] = content;

      encode.op(
        VM_STATIC_ATTR_OP,
        encode.constant(inflateAttrName(name)),
        encode.constant(value as string),
        encode.constant(namespace ?? null)
      );

      return;
    }

    case Op.StaticComponentAttr: {
      const [, name, value, namespace] = content;

      encode.op(
        VM_STATIC_COMPONENT_ATTR_OP,
        encode.constant(inflateAttrName(name)),
        encode.constant(value as string),
        encode.constant(namespace ?? null)
      );

      return;
    }

    case Op.ComponentAttr: {
      const [, name, value, namespace] = content;
      expr(encode, value);

      encode.op(
        VM_COMPONENT_ATTR_OP,
        encode.constant(inflateAttrName(name)),
        encode.constant(false),
        encode.constant(namespace ?? null)
      );

      return;
    }

    case Op.TrustingComponentAttr: {
      const [, name, value, namespace] = content;
      expr(encode, value);
      encode.op(
        VM_COMPONENT_ATTR_OP,
        encode.constant(inflateAttrName(name)),
        encode.constant(true),
        encode.constant(namespace ?? null)
      );
      return;
    }

    case Op.DynamicAttr: {
      const [, name, value, namespace] = content;
      expr(encode, value);
      encode.op(
        VM_DYNAMIC_ATTR_OP,
        encode.constant(inflateAttrName(name)),
        encode.constant(false),
        encode.constant(namespace ?? null)
      );
      return;
    }

    case Op.TrustingDynamicAttr: {
      const [, name, value, namespace] = content;
      expr(encode, value);

      encode.op(
        VM_DYNAMIC_ATTR_OP,
        encode.constant(inflateAttrName(name)),
        encode.constant(true),
        encode.constant(namespace ?? null)
      );
      return;
    }

    case Op.Debugger: {
      const [, locals, upvars, lexical] = content;
      encode.op(VM_DEBUGGER_OP, encode.constant({ locals, upvars, lexical }));
      return;
    }

    case Op.ResolvedModifier: {
      const [, callee, args] = content;
      const handle = encode.modifier(callee);
      SimpleArgs(encode, args);
      encode.op(VM_MODIFIER_OP, handle);
      return;
    }

    case Op.LexicalModifier: {
      const [, callee, args] = content;
      const handle = encode.lexicalModifier(callee);
      SimpleArgs(encode, args);
      encode.op(VM_MODIFIER_OP, handle);
      return;
    }

    case Op.DynamicModifier: {
      const [, expression, args] = content;

      expr(encode, expression);
      encode.op(VM_PUSH_FRAME_OP);
      SimpleArgs(encode, args);
      encode.op(VM_DUP_FP_OP, 1);
      encode.op(VM_DYNAMIC_MODIFIER_OP);
      encode.op(VM_POP_FRAME_OP);
      return;
    }

    case Op.Let: {
      const [, positional, block] = content;
      CompilePresentPositional(encode, positional);
      const parameters = block[1];

      encode.op(VM_PUSH_FRAME_OP);
      encode.op(VM_CHILD_SCOPE_OP);

      for (let i = 0; i < positional.length; i++) {
        encode.op(VM_DUP_FP_OP, positional.length - i);

        const parameter = parameters[i];
        if (parameter === undefined) {
          throw new Error(`Missing parameter at index ${i} for let statement`);
        }
        encode.op(VM_SET_VARIABLE_OP, parameter);
      }

      encode.op(VM_JIT_INVOKE_VIRTUAL_OP, encode.block(block));

      encode.op(VM_POP_SCOPE_OP);
      encode.op(VM_POP_FRAME_OP);
      return;
    }

    case Op.WithDynamicVars: {
      const [, named, block] = content;
      let [names, expressions] = named;

      CompilePresentPositional(encode, expressions);
      encode.op(VM_BIND_DYNAMIC_SCOPE_OP, encode.array(names));
      InvokeStaticBlockWithPresentStack(encode, block, expressions.length);
      encode.op(VM_POP_DYNAMIC_SCOPE_OP);
      return;
    }
  }

  STATEMENTS.compile(encode, content);
}

function compileYield(encode: EncodeOp, to: number) {
  encode.op(VM_GET_BLOCK_OP, to);
  encode.op(VM_SPREAD_BLOCK_OP);
  encode.op(VM_COMPILE_BLOCK_OP);
  encode.op(VM_INVOKE_YIELD_OP);
  encode.op(VM_POP_SCOPE_OP);
  encode.op(VM_POP_FRAME_OP);
}

export function compilableBlock(
  block: SerializedInlineBlock | SerializedBlock,
  containing: BlockMetadata
): CompilableBlock {
  return new CompilableTemplateImpl<BlockSymbolTable>(block[0], containing, {
    parameters: block[1] || (EMPTY_ARRAY as number[]),
  });
}
