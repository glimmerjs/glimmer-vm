import type { Expressions, Statement, Statements } from '@glimmer/interfaces';

import { opcodes as Op } from './lib/opcodes';

export { opcodes as SexpOpcodes } from './lib/opcodes';
export { resolution as VariableResolutionContext } from './lib/resolution';
export { WellKnownAttrNames, WellKnownTagNames } from './lib/well-known';

export function is<T>(variant: number): (value: unknown) => value is T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (value: any): value is T {
    return Array.isArray(value) && value[0] === variant;
  };
}

// Statements
export const isFlushElement = is<Statements.FlushElement>(Op.FlushElement);

export function isAttribute(val: Statement): val is Statements.Attribute {
  return (
    val[0] === Op.StaticAttr ||
    val[0] === Op.DynamicAttr ||
    val[0] === Op.TrustingDynamicAttr ||
    val[0] === Op.ComponentAttr ||
    val[0] === Op.StaticComponentAttr ||
    val[0] === Op.TrustingComponentAttr ||
    val[0] === Op.AttrSplat ||
    val[0] === Op.LexicalModifier ||
    val[0] === Op.ResolvedModifier
  );
}

// Expressions

export function isGetVar(expr: Expressions.TupleExpression): expr is Expressions.GetVar {
  return isGet(expr) && expr.length === 2;
}

export function isGetPath(expr: Expressions.TupleExpression): expr is Expressions.GetPath {
  return isGet(expr) && expr.length === 3;
}

export function isGet(expr: Expressions.TupleExpression): expr is Expressions.Get {
  const [opcode] = expr;

  return opcode === Op.GetSymbol || opcode === Op.GetLexicalSymbol || isGetFree(expr);
}

export function isGetFree(expr: Expressions.TupleExpression): expr is Expressions.GetFree {
  const [opcode] = expr;
  return opcode === Op.GetStrictKeyword || isGetContextualFree(expr);
}

export function isGetLexical(
  expr: Expressions.TupleExpression
): expr is Expressions.GetLexicalSymbol | Expressions.GetPathLexicalSymbol {
  return expr[0] === Op.GetLexicalSymbol;
}

export function isGetContextualFree(
  expr: Expressions.TupleExpression
): expr is Expressions.GetContextualFree | Expressions.GetPathContextualFree {
  const [opcode] = expr;
  switch (opcode) {
    case Op.GetFreeAsComponentHead:
    case Op.GetFreeAsComponentOrHelperHead:
    case Op.GetFreeAsHelperHead:
    case Op.GetFreeAsModifierHead:
      return true;
    default:
      return false;
  }
}
