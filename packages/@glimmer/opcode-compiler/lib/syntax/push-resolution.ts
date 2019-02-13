import {
  Encoder,
  HighLevelResolutionOp,
  HighLevelResolutionOpcode,
  CompileTimeResolverDelegate,
  ResolveHandle,
  Option,
  ExpressionCompileActions,
  IfResolvedOp,
  WireFormat,
  Op,
  CompileTimeConstants,
  ContainingMetadata,
  TemplateCompilationContext,
  ExprOp,
  SexpOpcodes,
} from '@glimmer/interfaces';
import { compileParams } from '../opcode-builder/helpers/shared';
import { exhausted, EMPTY_ARRAY } from '@glimmer/util';
import { op } from '../opcode-builder/encoder';
import { strArray } from '../opcode-builder/operands';
import { primitive } from '../opcode-builder/helpers/vm';
import { concatExpressions } from './concat';
import { EXPRESSIONS } from './expressions';

export default function pushResolutionOp(
  encoder: Encoder,
  context: TemplateCompilationContext,
  op: HighLevelResolutionOp,
  constants: CompileTimeConstants
): void {
  switch (op.op) {
    case HighLevelResolutionOpcode.SimpleArgs:
      concatExpressions(
        encoder,
        context,
        compileSimpleArgs(op.op1.params, op.op1.hash, op.op1.atNames),
        constants
      );
      break;
    case HighLevelResolutionOpcode.Expr:
      concatExpressions(encoder, context, expr(op.op1, context.meta), constants);
      break;
    case HighLevelResolutionOpcode.IfResolved: {
      concatExpressions(encoder, context, ifResolved(context, op), constants);
      break;
    }
    default:
      return exhausted(op);
  }
}

export function expr(
  expression: WireFormat.Expression,
  meta: ContainingMetadata
): ExpressionCompileActions {
  if (Array.isArray(expression)) {
    return EXPRESSIONS.compile(expression, meta);
  } else {
    return [primitive(expression), op(Op.PrimitiveReference)];
  }
}

export function compileSimpleArgs(
  params: Option<WireFormat.Core.Params>,
  hash: Option<WireFormat.Core.Hash>,
  atNames: boolean
): ExpressionCompileActions {
  let out: ExpressionCompileActions = [];

  let { count, actions } = compileParams(params);

  out.push(actions);

  let flags = count << 4;

  if (atNames) flags |= 0b1000;

  let names: string[] = EMPTY_ARRAY;

  if (hash) {
    names = hash[0];
    let val = hash[1];
    for (let i = 0; i < val.length; i++) {
      out.push(op('Expr', val[i]));
    }
  }

  out.push(op(Op.PushArgs, strArray(names), flags));

  return out;
}

function ifResolved(
  context: TemplateCompilationContext,
  op: IfResolvedOp
): ExpressionCompileActions {
  let { kind, call, andThen, orElse } = op.op1;

  let resolved = resolve(
    context.syntax.program.resolverDelegate,
    kind,
    call,
    context.meta.referrer
  );

  if (resolved !== null) {
    return andThen(resolved);
  } else if (orElse) {
    return orElse();
  } else {
    // TODO: Fix error reporting
    throw new Error(`Unexpected ${kind} ${call}`);
  }
}

function isSimplePath(
  expr: WireFormat.Expression
): expr is WireFormat.Expressions.FreeVariable | WireFormat.Expressions.MaybeLocal {
  return (
    Array.isArray(expr) &&
    (expr[0] === SexpOpcodes.FreeVariable || expr[0] === SexpOpcodes.MaybeLocal) &&
    expr[1].length === 1
  );
}

function resolve(
  resolver: CompileTimeResolverDelegate,
  kind: ResolveHandle,
  expr: ExprOp,
  referrer: unknown
): Option<number> {
  if (isSimplePath(expr.op1)) {
    let name = expr.op1[1][0];
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

  return null;
}
