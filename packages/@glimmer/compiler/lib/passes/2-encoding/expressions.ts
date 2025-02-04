import type { Optional, PresentArray, WireFormat } from '@glimmer/interfaces';
import type { ASTv2 } from '@glimmer/syntax';
import { assertPresentArray, localAssert, mapPresentArray } from '@glimmer/debug-util';
import { SexpOpcodes as Op } from '@glimmer/wire-format';

import type * as mir from './mir';

import { CALL_TYPES, compact, headType } from '../../builder/builder';

export type HashPair = [string, WireFormat.Expression];

export function expr(expr: ASTv2.LocalVarReference): WireFormat.Expressions.GetVar;
export function expr(expr: ASTv2.ResolvedVarReference): WireFormat.Expressions.GetResolved;
export function expr(expr: mir.ExpressionNode): WireFormat.Expression;
export function expr(expr: mir.ExpressionNode): WireFormat.Expression {
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
      return Resolved(expr);
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

function args(
  positionalNode: mir.Positional,
  namedNode: mir.NamedArguments,
  insertAtPrefix: boolean
): Optional<WireFormat.Core.Args> {
  const positional = Positional(positionalNode);
  const named = NamedArguments(namedNode, insertAtPrefix);

  return compact({ params: positional, hash: named });
}

export function Resolved({
  resolution,
  symbol,
}: ASTv2.ResolvedVarReference): WireFormat.Expressions.GetResolvedOrKeyword {
  return [resolution.resolution(), symbol];
}

export function Positional({ list }: mir.Positional): Optional<WireFormat.Core.Params> {
  return list.map((l) => expr(l)).toPresentArray();
}

export function NamedArgument({ key, value }: mir.NamedArgument): HashPair {
  return [key.chars, expr(value)];
}

export function NamedArguments(
  { entries: pairs }: mir.NamedArguments,
  insertAtPrefix: boolean
): Optional<WireFormat.Core.Hash> {
  let list = pairs.toPresentArray();

  if (list) {
    let names: string[] = [];
    let values: WireFormat.Expression[] = [];

    for (let pair of list) {
      let [name, value] = NamedArgument(pair);
      names.push(insertAtPrefix ? `@${name}` : name);
      values.push(value);
    }

    assertPresentArray(names);
    assertPresentArray(values);

    return [names, values];
  }
}

export function This(): WireFormat.Expressions.GetLocalSymbol {
  return [Op.GetLocalSymbol, 0];
}

export function Arg({ symbol }: ASTv2.ArgReference): WireFormat.Expressions.GetLocalSymbol {
  return [Op.GetLocalSymbol, symbol];
}

export function Literal({
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

export function HasBlock({ symbol }: mir.HasBlock): WireFormat.Expressions.HasBlock {
  return [Op.HasBlock, [Op.GetLocalSymbol, symbol]];
}

export function HasBlockParams({
  symbol,
}: mir.HasBlockParams): WireFormat.Expressions.HasBlockParams {
  return [Op.HasBlockParams, [Op.GetLocalSymbol, symbol]];
}

export function Curry({ definition, curriedType, args }: mir.Curry): WireFormat.Expressions.Curry {
  return [Op.Curry, expr(definition), curriedType, Args(args)];
}

export function Local({
  referenceType,
  symbol,
}: ASTv2.LocalVarReference):
  | WireFormat.Expressions.GetLocalSymbol
  | WireFormat.Expressions.GetLexicalSymbol {
  return [referenceType === 'lexical' ? Op.GetLexicalSymbol : Op.GetLocalSymbol, symbol];
}

export function Keyword({
  symbol,
}: ASTv2.KeywordExpression): WireFormat.Expressions.GetStrictKeyword {
  return [Op.GetStrictKeyword, symbol];
}

export function PathExpression({ head, tail }: mir.PathExpression): WireFormat.Expressions.GetPath {
  let getOp = expr(head) as WireFormat.Expressions.GetVar;
  localAssert(getOp[0] !== Op.GetStrictKeyword, '[BUG] keyword in a PathExpression');
  return [...getOp, Tail(tail)];
}

export function InterpolateExpression({
  parts,
}: mir.InterpolateExpression): WireFormat.Expressions.Concat {
  return [Op.Concat, parts.map((e) => expr(e)).toArray()];
}

export function CallExpression({
  callee,
  args,
}: mir.CallExpression): WireFormat.Expressions.SomeInvoke {
  const calleeExpr = expr(callee);
  return [CALL_TYPES[headType(calleeExpr, 'expr:call')], calleeExpr, Args(args)];
}

export function Tail({ members }: mir.Tail): PresentArray<string> {
  return mapPresentArray(members, (member) => member.chars);
}

export function Args(
  node: Pick<mir.Args, 'positional' | 'named'>,
  insertAtPrefix: boolean = false
): Optional<WireFormat.Core.Args> {
  return args(node.positional, node.named, insertAtPrefix);
}

export function Not({ value }: mir.Not): WireFormat.Expressions.Not {
  return [Op.Not, expr(value)];
}

export function IfInline({
  condition,
  truthy,
  falsy,
}: mir.IfExpression): WireFormat.Expressions.IfInline {
  let expression = [Op.IfInline, expr(condition), expr(truthy)];

  if (falsy) {
    expression.push(expr(falsy));
  }

  return expression as WireFormat.Expressions.IfInline;
}

export function GetDynamicVar({ name }: mir.GetDynamicVar): WireFormat.Expressions.GetDynamicVar {
  return [Op.GetDynamicVar, expr(name)];
}

export function Log({ positional }: mir.Log): WireFormat.Expressions.Log {
  return [Op.Log, Positional(positional)];
}
