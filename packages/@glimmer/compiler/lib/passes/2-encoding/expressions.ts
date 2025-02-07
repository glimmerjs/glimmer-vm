import type { Optional, PresentArray, WireFormat } from '@glimmer/interfaces';
import type { ASTv2 } from '@glimmer/syntax';
import { assertPresentArray, localAssert, mapPresentArray } from '@glimmer/debug-util';
import { SexpOpcodes as Op } from '@glimmer/wire-format';

import type * as mir from './mir';

import { CALL_TYPES, compact, headType } from '../../builder/builder';

export type HashPair = [string, WireFormat.Expression];

export function encodeMaybeExpr(
  expr: mir.ExpressionNode | mir.Missing
): WireFormat.Expression | undefined {
  return expr.type === 'Missing' ? undefined : encodeExpr(expr);
}

export function encodeExpr(expr: ASTv2.ResolvedVarReference): WireFormat.Expressions.GetResolved;
export function encodeExpr(expr: mir.ExpressionNode): WireFormat.Expression;
export function encodeExpr(
  expr: mir.ExpressionNode | mir.Missing
): WireFormat.Expression | undefined {
  switch (expr.type) {
    case 'Missing':
      return undefined;
    case 'Literal':
      return Literal(expr);
    case 'Keyword':
      return Keyword(expr);
    case 'CallExpression':
      return CallExpression(expr);
    case 'PathExpression':
      return PathExpression(expr);
    case 'Arg':
      return Arg(expr);
    case 'Local':
      return Local(expr);
    case 'This':
      return This();
    case 'Resolved':
      return encodeResolved(expr);
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
    case 'InterpolateExpression':
      return InterpolateExpression(expr);
    case 'GetDynamicVar':
      return GetDynamicVar(expr);
    case 'Log':
      return Log(expr);
  }
}

export function encodePositional({ list }: mir.Positional): Optional<WireFormat.Core.Params> {
  return list.map((l) => encodeExpr(l)).toPresentArray();
}

export function encodeNamedArguments(
  { entries: pairs }: mir.NamedArguments,
  insertAtPrefix: boolean
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

export function encodeArgs(
  node: Pick<mir.Args, 'positional' | 'named'>,
  insertAtPrefix: boolean = false
): Optional<WireFormat.Core.Args> {
  return args(node.positional, node.named, insertAtPrefix);
}

function args(
  positionalNode: mir.Positional,
  namedNode: mir.NamedArguments,
  insertAtPrefix: boolean
): Optional<WireFormat.Core.Args> {
  const positional = encodePositional(positionalNode);
  const named = encodeNamedArguments(namedNode, insertAtPrefix);

  return compact({ params: positional, hash: named });
}

function encodeResolved({
  resolution,
  symbol,
}: ASTv2.ResolvedVarReference): WireFormat.Expressions.GetResolvedOrKeyword {
  return [resolution.resolution(), symbol];
}

function encodeNamedArgument({ key, value }: mir.NamedArgument): HashPair {
  return [key.chars, encodeExpr(value)];
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
  return [Op.Curry, encodeExpr(definition), curriedType, encodeArgs(args)];
}

function Local({
  referenceType,
  symbol,
}: ASTv2.LocalVarReference):
  | WireFormat.Expressions.GetLocalSymbol
  | WireFormat.Expressions.GetLexicalSymbol {
  return [referenceType === 'lexical' ? Op.GetLexicalSymbol : Op.GetLocalSymbol, symbol];
}

function Keyword({ symbol }: ASTv2.KeywordExpression): WireFormat.Expressions.GetStrictKeyword {
  return [Op.GetStrictKeyword, symbol];
}

function PathExpression({ head, tail }: mir.PathExpression): WireFormat.Expressions.GetPath {
  let getOp = encodeExpr(head) as WireFormat.Expressions.GetVar;
  localAssert(getOp[0] !== Op.GetStrictKeyword, '[BUG] keyword in a PathExpression');
  return [...getOp, Tail(tail)];
}

function InterpolateExpression({
  parts,
}: mir.InterpolateExpression): WireFormat.Expressions.Concat {
  return [Op.Concat, parts.map((e) => encodeExpr(e)).toArray()];
}

function CallExpression({ callee, args }: mir.CallExpression): WireFormat.Expressions.SomeInvoke {
  const calleeExpr = encodeExpr(callee);
  return [CALL_TYPES[headType(calleeExpr, 'expr:call')], calleeExpr, encodeArgs(args)];
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
