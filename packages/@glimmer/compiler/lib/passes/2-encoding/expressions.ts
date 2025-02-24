import type { Optional, PresentArray, WireFormat } from '@glimmer/interfaces';
import type { ASTv2 } from '@glimmer/syntax';
import { assertPresentArray, exhausted, localAssert, mapPresentArray } from '@glimmer/debug-util';
import {
  BLOCKS_OPCODE,
  EMPTY_ARGS_OPCODE,
  NAMED_ARGS_AND_BLOCKS_OPCODE,
  NAMED_ARGS_OPCODE,
  POSITIONAL_AND_BLOCKS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_OPCODE,
  POSITIONAL_ARGS_OPCODE,
  SexpOpcodes as Op,
} from '@glimmer/wire-format';

import type * as mir from './mir';

import { NamedBlocks } from './content';

export type HashPair = [string, WireFormat.Expression];

export function encodeMaybeExpr(
  expr: mir.ExpressionNode | mir.Missing
): WireFormat.Expression | undefined {
  return expr.type === 'Missing' ? undefined : encodeExpr(expr);
}

export function encodeInterpolatePart(expr: mir.AttrStyleInterpolatePart) {
  switch (expr.type) {
    case 'mir.CustomInterpolationPart':
      return encodeExpr(expr.value);
    default:
      return encodeCoreInterpolatePart(expr);
  }
}

export function encodeCoreInterpolatePart(
  expr: mir.CoreAttrStyleInterpolatePart
): WireFormat.Expressions.Expression {
  switch (expr.type) {
    case 'Literal':
      return Literal(expr);
    case 'mir.CurlyAttrValue':
      return encodeExpr(expr.value);
    case 'CurlyResolvedAttrValue':
      return [Op.CallResolved, expr.resolved.symbol, [EMPTY_ARGS_OPCODE]];

    case 'mir.CurlyInvokeAttr':
      return CallExpression(expr);
    case 'mir.CurlyInvokeResolvedAttr':
      return [
        Op.CallResolved,
        expr.resolved.symbol,
        encodeCallArgs(expr.args.positional, expr.args.named, { insertAtPrefix: false }),
      ];

    default:
      exhausted(expr);
  }
}

export function encodeAttrValue(expr: mir.AttrStyleValue): WireFormat.Expression {
  switch (expr.type) {
    case 'InterpolateExpression':
      return InterpolateExpression(expr);
    default:
      return encodeInterpolatePart(expr);
  }
}

export function encodeExpr(
  expr: ASTv2.LiteralExpression | ASTv2.UnresolvedBinding
): string | number | boolean | null | WireFormat.Expressions.Undefined;
export function encodeExpr(
  expr: mir.CallExpression | ASTv2.UnresolvedBinding
): WireFormat.Expressions.SomeCallHelper;
export function encodeExpr(
  expr: mir.PathExpression | ASTv2.VariableReference | ASTv2.UnresolvedBinding
): WireFormat.Expressions.Get;
export function encodeExpr(
  expr: Extract<mir.ExpressionNode, object> | ASTv2.UnresolvedBinding
): WireFormat.Expression;
export function encodeExpr(
  expr: mir.ExpressionNode | mir.InterpolateExpression | mir.Missing | ASTv2.UnresolvedBinding
): WireFormat.Expression | undefined {
  localAssert(
    expr.type !== 'UnresolvedBinding',
    // @todo make a variant of the mir types that don't include `UnresolvedBinding`
    `Unresolved bindings should be removed during verification and should not reach the encoder`
  );

  switch (expr.type) {
    case 'Missing':
      return undefined;
    case 'Literal':
      return Literal(expr);
    case 'Keyword':
      return Keyword(expr);
    case 'CallExpression':
      return CallExpression(expr);
    case 'ResolvedCallExpression':
      return ResolvedCallExpression(expr);
    case 'PathExpression':
      return PathExpression(expr);
    case 'Arg':
      return Arg(expr);
    case 'Local':
      return Local(expr);
    case 'Lexical':
      return Lexical(expr);
    case 'This':
      return This();
    case 'HasBlock':
      return HasBlock(expr);
    case 'HasBlockParams':
      return HasBlockParams(expr);
    case 'Curry':
      return Curry(expr);
    case 'Not':
      return Not(expr);
    case 'IfExpression':
      return IfInline(expr);
    case 'GetDynamicVar':
      return GetDynamicVar(expr);
    case 'Log':
      return Log(expr);
    case 'InterpolateExpression':
      return InterpolateExpression(expr);
    case 'CustomNamedArgument':
      return encodeExpr(expr.value);

    default:
      exhausted(expr);
  }
}

export function encodePositional(positional: mir.PresentPositional): WireFormat.Core.Params;
export function encodePositional(positional: mir.Positional): Optional<WireFormat.Core.Params>;
export function encodePositional({ list }: mir.Positional): Optional<WireFormat.Core.Params> {
  return list.map((l) => encodeExpr(l)).toPresentArray();
}

export function encodeComponentArguments(
  args: mir.ComponentArguments
): Optional<WireFormat.Core.Hash> {
  let list = args.entries.toPresentArray();

  if (list) {
    let names: string[] = [];
    let values: WireFormat.Expression[] = [];

    for (let pair of list) {
      let [name, value] = encodeComponentArgument(pair);
      names.push(name);
      values.push(value);
    }

    assertPresentArray(names);
    assertPresentArray(values);

    return [names, values];
  }
}

/**
 * `insertAtPrefix` controls whether the `@` prefix is inserted for named arguments.
 *
 * - `<AngleBrackets>`: no. They already have `@`-prefixes in their syntax.
 * - `{{#some-component}}`: yes. Their arguments are equivalent to `@`-prefixed named arguments.
 * - `{{component ...}}`: yes. Their arguments are equivalent to `@`-prefixed named arguments.
 */
export function encodeNamedArguments(
  named: mir.PresentCurlyNamedArguments,
  { insertAtPrefix }: { insertAtPrefix: boolean }
): WireFormat.Core.Hash;
export function encodeNamedArguments(
  named: mir.CurlyNamedArguments,
  { insertAtPrefix }: { insertAtPrefix: boolean }
): Optional<WireFormat.Core.Hash>;
export function encodeNamedArguments(
  { entries: pairs }: mir.CurlyNamedArguments,
  { insertAtPrefix }: { insertAtPrefix: boolean }
): Optional<WireFormat.Core.Hash> {
  let list = pairs.toPresentArray();

  if (list) {
    let names: string[] = [];
    let values: WireFormat.Expression[] = [];

    for (let pair of list) {
      let [name, value] = encodeNamedArgument(pair);
      names.push(insertAtPrefix ? `@${name}` : name);
      values.push(value);
    }

    assertPresentArray(names);
    assertPresentArray(values);

    return [names, values];
  }
}

/**
 * Encodes call-like arguments (positional and named arguments) into a `CallArgs` opcode with
 * appropriate tagging.
 *
 * This is used internally by other arg-encoding functions.
 *
 * See {@linkcode encodeNamedArguments} for information about `insertAtPrefix`.
 */
function encodeCallArgs(
  positionalArgs: mir.Args['positional'],
  namedArgs: mir.Args['named'],
  { insertAtPrefix }: { insertAtPrefix: boolean }
): WireFormat.Core.CallArgs {
  const positional = encodePositional(positionalArgs);
  const named = encodeNamedArguments(namedArgs, { insertAtPrefix });

  if (positional && named) {
    return [POSITIONAL_AND_NAMED_ARGS_OPCODE, positional, named];
  } else if (positional) {
    return [POSITIONAL_ARGS_OPCODE, positional];
  } else if (named) {
    return [NAMED_ARGS_OPCODE, named];
  } else {
    return [EMPTY_ARGS_OPCODE];
  }
}

export function callArgs(
  positionalArgs: mir.Args['positional'],
  namedArgs: mir.Args['named']
): WireFormat.Core.CallArgs {
  return encodeCallArgs(positionalArgs, namedArgs, { insertAtPrefix: false });
}

export function encodeComponentBlockArgs(
  positionalArgs: mir.Positional,
  namedArgs: mir.CurlyNamedArguments,
  blocksArgs: Optional<mir.NamedBlocks>
): WireFormat.Core.BlockArgs {
  const blocks = blocksArgs && NamedBlocks(blocksArgs);

  if (blocks) {
    const positional = encodePositional(positionalArgs);
    const named = encodeNamedArguments(namedArgs, { insertAtPrefix: true });

    if (positional && named) {
      return [POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE, positional, named, blocks];
    } else if (positional) {
      return [POSITIONAL_AND_BLOCKS_OPCODE, positional, blocks];
    } else if (named) {
      return [NAMED_ARGS_AND_BLOCKS_OPCODE, named, blocks];
    } else {
      return [BLOCKS_OPCODE, blocks];
    }
  } else {
    return encodeCallArgs(positionalArgs, namedArgs, { insertAtPrefix: true });
  }
}

function encodeNamedArgument({ key, value }: mir.CurlyNamedArgument): HashPair {
  return [key.chars, encodeExpr(value)];
}

function encodeComponentArgument({ key, value }: mir.ComponentArgument): HashPair {
  return [key.chars, encodeAttrValue(value)];
}

function This(): WireFormat.Expressions.GetLocalSymbol {
  return [Op.GetLocalSymbol, 0];
}

function Arg({ symbol }: ASTv2.ArgReference): WireFormat.Expressions.GetLocalSymbol {
  return [Op.GetLocalSymbol, symbol];
}

function Literal({
  value,
}: ASTv2.LiteralExpression): WireFormat.Expressions.Value | WireFormat.Expressions.Undefined {
  if (value === undefined) {
    return [Op.Undefined];
  } else {
    return value;
  }
}

export function Missing(): undefined {
  return undefined;
}

function HasBlock({ symbol }: mir.HasBlock): WireFormat.Expressions.HasBlock {
  return [Op.HasBlock, [Op.GetLocalSymbol, symbol]];
}

function HasBlockParams({ symbol }: mir.HasBlockParams): WireFormat.Expressions.HasBlockParams {
  return [Op.HasBlockParams, [Op.GetLocalSymbol, symbol]];
}

function Curry({ definition, curriedType, args }: mir.Curry): WireFormat.Expressions.Curry {
  return [Op.Curry, encodeExpr(definition), curriedType, callArgs(args.positional, args.named)];
}

function Local({ symbol }: ASTv2.LocalVarReference): WireFormat.Expressions.GetLocalSymbol {
  return [Op.GetLocalSymbol, symbol];
}

function Lexical({ symbol }: ASTv2.LexicalVarReference): WireFormat.Expressions.GetLexicalSymbol {
  return [Op.GetLexicalSymbol, symbol];
}

function Keyword({ symbol }: ASTv2.KeywordExpression): WireFormat.Expressions.GetKeyword {
  return [Op.GetKeyword, symbol];
}

function PathExpression({ head, tail }: mir.PathExpression): WireFormat.Expressions.GetPath {
  let getOp = encodeExpr(head) as WireFormat.Expressions.GetVar;
  return [Op.GetPath, ...getOp, Tail(tail)];
}

function InterpolateExpression({
  parts,
}: mir.InterpolateExpression): WireFormat.Expressions.Concat {
  return [Op.Concat, parts.map((e) => encodeInterpolatePart(e)).toArray()];
}

function ResolvedCallExpression({
  callee,
  args,
}: mir.ResolvedCallExpression): WireFormat.Expressions.SomeCallHelper {
  return [Op.CallResolved, callee.symbol, callArgs(args.positional, args.named)];
}

function CallExpression({
  callee,
  args,
}: mir.CallExpression | mir.CurlyInvokeAttr): WireFormat.Expressions.SomeCallHelper {
  return [Op.CallDynamicValue, encodeExpr(callee), callArgs(args.positional, args.named)];
}

function Tail({ members }: mir.Tail): PresentArray<string> {
  return mapPresentArray(members, (member) => member.chars);
}

function Not({ value }: mir.Not): WireFormat.Expressions.Not {
  return [Op.Not, encodeExpr(value)];
}

function IfInline({ condition, truthy, falsy }: mir.IfExpression): WireFormat.Expressions.IfInline {
  let expression = [Op.IfInline, encodeExpr(condition), encodeExpr(truthy)];

  if (falsy) {
    expression.push(encodeExpr(falsy));
  }

  return expression as WireFormat.Expressions.IfInline;
}

function GetDynamicVar({ name }: mir.GetDynamicVar): WireFormat.Expressions.GetDynamicVar {
  return [Op.GetDynamicVar, encodeExpr(name)];
}

function Log({ positional }: mir.Log): WireFormat.Expressions.Log {
  return [Op.Log, encodePositional(positional)];
}
