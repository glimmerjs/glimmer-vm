import {
  CompileTimeConstants,
  CompileTimeResolver,
  ContainingMetadata,
  Encoder,
  ExpressionCompileActions,
  ExpressionContext,
  HighLevelResolutionOp,
  HighLevelResolutionOpcode,
  IfResolvedOp,
  Op,
  Option,
  ResolveHandle,
  TemplateCompilationContext,
  WireFormat,
} from '@glimmer/interfaces';
import { emptyArray, EMPTY_STRING_ARRAY, exhausted } from '@glimmer/util';
import { error, op } from '../opcode-builder/encoder';
import { CompilePositional } from '../opcode-builder/helpers/shared';
import { Call, PushPrimitive } from '../opcode-builder/helpers/vm';
import { strArray } from '../opcode-builder/operands';
import { concatExpressions } from './concat';
import { EXPRESSIONS } from './expressions';

export default function pushResolutionOp(
  encoder: Encoder,
  context: TemplateCompilationContext,
  operation: HighLevelResolutionOp,
  constants: CompileTimeConstants
): void {
  switch (operation.op) {
    case HighLevelResolutionOpcode.SimpleArgs:
      concatExpressions(
        encoder,
        context,
        compileSimpleArgs(operation.op1.params, operation.op1.hash, operation.op1.atNames),
        constants
      );
      break;
    case HighLevelResolutionOpcode.Expr:
      concatExpressions(encoder, context, expr(operation.op1, context.meta), constants);
      break;
    case HighLevelResolutionOpcode.IfResolved: {
      concatExpressions(encoder, context, ifResolved(context, operation), constants);
      break;
    }
    case HighLevelResolutionOpcode.ResolveFree: {
      throw new Error('Unimplemented HighLevelResolutionOpcode.ResolveFree');
    }
    case HighLevelResolutionOpcode.ResolveContextualFree: {
      let { freeVar, context: expressionContext } = operation.op1;

      if (context.meta.asPartial) {
        let name = context.meta.upvars![freeVar];

        concatExpressions(encoder, context, [op(Op.ResolveMaybeLocal, name)], constants);

        break;
      }

      switch (expressionContext) {
        case ExpressionContext.Expression: {
          // in classic mode, this is always a this-fallback
          let name = context.meta.upvars![freeVar];

          concatExpressions(
            encoder,
            context,
            [op(Op.GetVariable, 0), op(Op.GetProperty, name)],
            constants
          );

          break;
        }

        case ExpressionContext.AppendSingleId: {
          let resolver = context.syntax.program.resolver;
          let name = context.meta.upvars![freeVar];

          let resolvedHelper = resolver.lookupHelper(name, context.meta.referrer);
          let expressions: ExpressionCompileActions;

          if (resolvedHelper) {
            expressions = Call({ handle: resolvedHelper, params: null, hash: null });
          } else {
            // in classic mode, this is always a this-fallback
            expressions = [op(Op.GetVariable, 0), op(Op.GetProperty, name)];
          }

          concatExpressions(encoder, context, expressions, constants);

          break;
        }

        // case ExpressionContext.ComponentHead: {
        //   let resolver = context.syntax.program.resolverDelegate;
        //   let name = context.meta.upvars![freeVar];

        //   let resolvedComponent = resolver.lookupComponent(name, context.meta.referrer);
        //   let expressions: ExpressionCompileActions;

        //   if (resolvedHelper) {
        //     expressions = Call({ handle: resolvedHelper, params: null, hash: null });
        //   } else {
        //     // in classic mode, this is always a this-fallback
        //     expressions = [op(Op.GetVariable, 0), op(Op.GetProperty, name)];
        //   }

        //   concatExpressions(encoder, context, expressions, constants);

        //   break;
        // }

        default:
          throw new Error(
            `unimplemented: Can't evaluate expression in context ${expressionContext}`
          );
      }

      break;
    }
    default:
      return exhausted(operation);
  }
}

export function expr(
  expression: WireFormat.Expression,
  meta: ContainingMetadata
): ExpressionCompileActions {
  if (Array.isArray(expression)) {
    return EXPRESSIONS.compile(expression, meta);
  } else {
    return [PushPrimitive(expression), op(Op.PrimitiveReference)];
  }
}

export function compileSimpleArgs(
  params: Option<WireFormat.Core.Params>,
  hash: Option<WireFormat.Core.Hash>,
  atNames: boolean
): ExpressionCompileActions {
  let out: ExpressionCompileActions = [];

  let { count, actions } = CompilePositional(params);

  out.push(actions);

  let flags = count << 4;

  if (atNames) flags |= 0b1000;

  let names = emptyArray<string>();

  if (hash) {
    names = hash[0];
    let val = hash[1];
    for (let i = 0; i < val.length; i++) {
      out.push(op('Expr', val[i]));
    }
  }

  out.push(op(Op.PushArgs, strArray(names), strArray(EMPTY_STRING_ARRAY), flags));

  return out;
}

function ifResolved(
  context: TemplateCompilationContext,
  { op1 }: IfResolvedOp
): ExpressionCompileActions {
  let { kind, name, andThen, orElse, span } = op1;

  let resolved = resolve(context.syntax.program.resolver, kind, name, context.meta.referrer);

  if (resolved !== null) {
    return andThen(resolved);
  } else if (orElse) {
    return orElse();
  } else {
    return error(`Unexpected ${kind} ${name}`, span.start, span.end);
  }
}

function resolve(
  resolver: CompileTimeResolver,
  kind: ResolveHandle,
  name: string,
  referrer: unknown
): Option<number> {
  switch (kind) {
    case ResolveHandle.Modifier:
      return resolver.lookupModifier(name, referrer);
    case ResolveHandle.Helper:
      return resolver.lookupHelper(name, referrer);
    case ResolveHandle.ComponentDefinition: {
      let component = resolver.lookupComponent(name, referrer);
      return component && component.handle;
    }
  }
}
