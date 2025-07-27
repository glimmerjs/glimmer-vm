import { exhausted } from '@glimmer/debug-util';

import type { PrecompileOptionsWithLexicalScope } from './parser/tokenizer-event-handlers';
import type { ErrorNode } from './v1/api';
import type * as ASTv2 from './v2/api';
import type { ReportableContext } from './validation-context/validation-context';

import { GlimmerSyntaxError } from './syntax-error';
import * as Validation from './validation-context/validation-context';

interface VerifyState {
  options: PrecompileOptionsWithLexicalScope;
  errors: ReportableContext[];
}

export function verifyTemplate(
  program: ASTv2.Template,
  options: PrecompileOptionsWithLexicalScope
): ReportableContext[] {
  const state = {
    options,
    errors: [],
  } as VerifyState;

  if (program.error?.eof) {
    state.errors.push(toReportable(program.error.eof));
  }

  for (const content of program.body) {
    verifyContent(state, content);
  }

  return state.errors;
}

function verifyContent(state: VerifyState, content: ASTv2.ContentNode) {
  switch (content.type) {
    case 'HtmlText':
    case 'HtmlComment':
    case 'GlimmerComment':
    case 'AppendStaticContent':
      break;
    case 'AppendContent': {
      verifyCallee(state, content.value, Validation.append(content));
      break;
    }

    case 'SimpleElement':
      {
        const elementContext = Validation.element(content);

        verifyParentNode(state, content);
        verifyAttrs(state, content.attrs, elementContext);

        for (const _arg of content.componentArgs) {
          // @todo should this fail?
        }

        for (const modifier of content.modifiers) {
          verifyModifier(state, modifier, elementContext.modifier(modifier));
        }
      }
      break;
    case 'AppendResolvedContent':
      verifyResolved(
        state,
        content.resolved,
        Validation.appending(content).resolved(content.resolved)
      );
      break;
    case 'AppendResolvedInvokable': {
      const invokeContext = Validation.appending(content).invoke();
      verifyResolved(state, content.resolved, invokeContext.resolved(content.resolved));
      verifyHandlebarsArgs(state, content.args, invokeContext);
      break;
    }
    case 'AppendInvokable': {
      const invokeContext = Validation.appending(content).invoke();
      verifyCallee(state, content.callee, invokeContext.callee(content.callee));
      verifyHandlebarsArgs(state, content.args, invokeContext);
      break;
    }
    case 'InvokeResolvedBlock': {
      const blockContext = Validation.block(content);
      verifyResolved(state, content.resolved, blockContext.resolved(content.resolved));
      verifyBlockArgs(state, content, blockContext);
      break;
    }
    case 'InvokeBlock': {
      const blockContext = Validation.block(content);
      verifyCallee(state, content.callee, blockContext.callee(content.callee));
      verifyBlockArgs(state, content, blockContext);
      break;
    }
    case 'InvokeAngleBracketComponent': {
      const componentContext = Validation.component(content);
      verifyCallee(state, content.callee, componentContext.tag(content.callee));
      verifyInvokeComponent(state, content, componentContext);
      break;
    }
    case 'InvokeResolvedAngleBracketComponent': {
      const componentContext = Validation.component(content);
      verifyResolved(
        state,
        content.callee,
        componentContext.tag(content.callee).resolved(content.callee)
      );
      verifyInvokeComponent(state, content, Validation.component(content));
      break;
    }

    case 'Error':
      state.errors.push(toReportable(content));
      break;
    default:
      exhausted(content);
  }
}

function verifyInvokeComponent(
  state: VerifyState,
  component: ASTv2.InvokeSomeAngleBracketComponent,
  context: Validation.AngleBracketContext
) {
  verifyAttrs(state, component.attrs, context);
  verifyNamedBlocks(state, component.blocks);
  verifyComponentArgs(state, component, context);
  verifyModifiers(state, component.modifiers, context);
}

function verifyBlockArgs(
  state: VerifyState,
  block: ASTv2.InvokeSomeBlock,
  context: Validation.InvokeBlockContext
) {
  verifyHandlebarsArgs(state, block.args, context);
  verifyNamedBlocks(state, block.blocks);
}

function verifyNamedBlocks(state: VerifyState, blocks: ASTv2.NamedBlocks) {
  for (const namedBlock of blocks.blocks) {
    // @todo should we verify attrs, componentArgs, modifiers?
    if (namedBlock.type === 'Error') {
      state.errors.push(toReportable(namedBlock));
    } else {
      verifyParentNode(state, namedBlock.block);
    }
  }
}

function verifyParentNode(state: VerifyState, parent: ASTv2.ParentNode) {
  for (const child of parent.body) {
    verifyContent(state, child);
  }
}

function verifyModifiers(
  state: VerifyState,
  modifiers: readonly ASTv2.SomeElementModifier[],
  context: Validation.AngleBracketContext
) {
  for (const modifier of modifiers) {
    verifyModifier(state, modifier, context.modifier(modifier));
  }
}

function verifyModifier(
  state: VerifyState,
  modifier: ASTv2.ElementModifier | ASTv2.ResolvedElementModifier,
  context: Validation.AnyInvokeParentContext
) {
  switch (modifier.type) {
    case 'ResolvedElementModifier':
      verifyResolved(state, modifier.resolved, context.resolved(modifier.resolved));
      break;
    case 'ElementModifier':
      verifyDynamicCallee(state, modifier.callee, context.callee(modifier.callee));
      break;
  }

  const argsContext = context.args(modifier.args);
  verifyPositionals(state, modifier.args.positional, argsContext);
  verifyHandlebarsNamedArgs(state, modifier.args.named, argsContext);
}

function verifyAttrs(
  state: VerifyState,
  attrs: readonly ASTv2.HtmlOrSplatAttr[],
  context: Validation.AngleBracketContext
) {
  for (const attr of attrs) {
    switch (attr.type) {
      case 'SplatAttr':
        break;
      case 'HtmlAttr':
        verifyAttrValueNode(state, attr.value, context.attr(attr));
        break;
      default:
        exhausted(attr);
    }
  }
}

function verifyDynamicCallee(
  state: VerifyState,
  value: ASTv2.DynamicCallee,
  context: Validation.ValueValidationContext
) {
  switch (value.type) {
    case 'Keyword':
    case 'Arg':
    case 'This':
    case 'Local':
    case 'Lexical':
      break;
    case 'Path':
      verifyPath(state, value, context.path());
      break;
    case 'Call':
      verifyCall(state, value, context.subexpression(value));
      break;
    case 'ResolvedCall':
      verifyResolvedCall(state, value, context.subexpression(value));
      break;
    case 'Error':
      return;
    default:
      exhausted(value);
  }
}

function verifyPath(
  state: VerifyState,
  value: ASTv2.PathExpression,
  context: Validation.PathValidationContext
) {
  if (value.ref.type === 'UnresolvedBinding') {
    state.errors.push(context.head(value.ref));
  }
}

function verifyCall(
  state: VerifyState,
  value: ASTv2.CallExpression,
  context: Validation.SubExpressionContext
) {
  verifyCallee(state, value.callee, context.callee(value.callee));
}

function verifyPositionals(
  state: VerifyState,
  positionals: ASTv2.PositionalArguments,
  context: Validation.ArgsContext
) {
  const positionalsContext = context.positionalArgs();
  for (const arg of positionals.exprs) {
    verifyExpressionValue(state, arg, positionalsContext.value(arg));
  }
}

function verifyNamed(
  state: VerifyState,
  named: Validation.NamedArgContainer & { value: ASTv2.ExpressionValueNode },
  context: Validation.ArgsContext
) {
  verifyExpressionValue(state, named.value, context.namedArg(named));
}

function verifyHandlebarsNamedArgs(
  state: VerifyState,
  named: ASTv2.CurlyNamedArguments,
  context: Validation.ArgsContext
) {
  for (const entry of named.entries) {
    verifyNamed(state, entry, context);
  }
}

function verifyComponentArgs(
  state: VerifyState,
  component: ASTv2.InvokeSomeAngleBracketComponent,
  context: Validation.AngleBracketContext
) {
  for (const arg of component.componentArgs) {
    verifyComponentArg(state, arg, context);
  }
}

function verifyComponentArg(
  state: VerifyState,
  named: Validation.NamedArgContainer & { value: ASTv2.AttrValueNode },
  context: Validation.AngleBracketContext
) {
  verifyAttrValueNode(state, named.value, context.arg(named));
}

function verifyAttrValueNode(
  state: VerifyState,
  value: ASTv2.AttrValueNode,
  context: Validation.FullElementParameterValidationContext
) {
  switch (value.type) {
    case 'Interpolate': {
      const concatContext = context.concat(value);
      for (const part of value.parts) {
        verifyInterpolatePartNode(state, part, concatContext);
      }
      break;
    }
    default:
      verifyInterpolatePartNode(state, value, context);
  }
}

function verifyInterpolatePartNode(
  state: VerifyState,
  node: ASTv2.InterpolatePartNode,
  context: Validation.AnyAttrLikeContainerContext
) {
  switch (node.type) {
    case 'Literal':
      break;

    case 'CurlyAttrValue':
      verifyExpressionValue(state, node.value, context.value({ value: node.value, curly: node }));
      break;
    case 'CurlyResolvedAttrValue': {
      verifyResolved(state, node.resolved, context.resolved(node));
      break;
    }
    case 'CurlyInvokeAttr': {
      const invokeContext = context.invoke(node);
      verifyCallee(state, node.callee, invokeContext.callee(node.callee));
      verifyHandlebarsArgs(state, node.args, invokeContext);
      break;
    }
    case 'CurlyInvokeResolvedAttr': {
      const invokeContext = context.invoke(node);
      verifyResolved(state, node.resolved, invokeContext.resolved(node.resolved));
      verifyHandlebarsArgs(state, node.args, invokeContext);
    }
  }
}

function verifyHandlebarsArgs(
  state: VerifyState,
  args: ASTv2.CurlyArgs,
  context: Validation.AnyInvokeParentContext
) {
  const argsContext = context.args(args);
  verifyPositionals(state, args.positional, argsContext);

  for (const entry of args.named.entries) {
    verifyNamed(state, entry, argsContext);
  }
}

function verifyExpressionValue(
  state: VerifyState,
  value: ASTv2.ExpressionValueNode,
  context: Validation.ValueValidationContext
) {
  switch (value.type) {
    case 'Literal':
    case 'This':
    case 'Arg':
    case 'Local':
    case 'Lexical':
    case 'Keyword':
      break;
    case 'Path':
      verifyPath(state, value, context.path());
      break;
    case 'Call':
      verifyCall(state, value, context.subexpression(value));
      break;
    case 'ResolvedCall':
      verifyResolvedCall(state, value, context.subexpression(value));

    case 'Error':
  }
}

function verifyResolvedCall(
  state: VerifyState,
  value: ASTv2.ResolvedCallExpression,
  context: Validation.SubExpressionContext
) {
  verifyResolved(state, value.resolved, context.resolved(value.resolved));

  const argsContext = context.args(value.args);
  verifyPositionals(state, value.args.positional, argsContext);
}

function verifyResolved(
  state: VerifyState,
  value: ASTv2.ResolvedName | ASTv2.UnresolvedBinding,
  context: Validation.VariableReferenceContext
) {
  if (value.type === 'UnresolvedBinding') {
    state.errors.push(context);
  }
}

function verifyCallee(
  state: VerifyState,
  value: ASTv2.CallExpression['callee'],
  context: Validation.ValueValidationContext
) {
  if (value.type === 'UnresolvedBinding') {
    state.errors.push(context.unresolved(value));
  } else if (value.type === 'Error') {
    state.errors.push(toReportable(value));
  } else {
    verifyDynamicCallee(state, value, context);
  }
}

function toReportable(error: ErrorNode): ReportableContext {
  return {
    message: error.message,
    error: (extra?: number) => GlimmerSyntaxError.forErrorNode(error, extra),
    highlights: () => error.highlight,
  };
}
