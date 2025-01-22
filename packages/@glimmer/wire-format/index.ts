import type { Content, Expressions } from '@glimmer/interfaces';

import { opcodes as Op } from './lib/opcodes';

export {
  BLOCKS_OPCODE,
  EMPTY_ARGS_OPCODE,
  NAMED_ARGS_AND_BLOCKS_OPCODE,
  NAMED_ARGS_OPCODE,
  POSITIONAL_AND_BLOCKS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_OPCODE,
  POSITIONAL_ARGS_OPCODE,
  opcodes as SexpOpcodes,
} from './lib/opcodes';
export { resolution as VariableResolutionContext } from './lib/resolution';
export { WellKnownAttrNames, WellKnownTagNames } from './lib/well-known';

export function is<T>(variant: number): (value: unknown) => value is T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (value: any): value is T {
    return Array.isArray(value) && value[0] === variant;
  };
}

// Statements
export const isFlushElement = is<Content.FlushElement>(Op.FlushElement);

export function isAttribute(val: Content): val is Content.Attribute {
  return (
    val[0] === Op.StaticAttr ||
    val[0] === Op.DynamicAttr ||
    val[0] === Op.TrustingDynamicAttr ||
    val[0] === Op.ComponentAttr ||
    val[0] === Op.StaticComponentAttr ||
    val[0] === Op.TrustingComponentAttr ||
    val[0] === Op.AttrSplat ||
    val[0] === Op.DynamicModifier ||
    val[0] === Op.ResolvedModifier
  );
}

// Expressions

export function isGetVar(expr: Expressions.TupleExpression): expr is Expressions.GetVar {
  return isGet(expr) && expr.length === 2;
}

export function isGetPath(expr: Expressions.TupleExpression): expr is Expressions.GetPath {
  return expr[0] === Op.GetPath;
}

export function isGet(expr: Expressions.TupleExpression): expr is Expressions.Get {
  const [opcode] = expr;

  return (
    opcode === Op.GetLocalSymbol ||
    opcode === Op.GetLexicalSymbol ||
    isGetFree(expr) ||
    isGetPath(expr)
  );
}

export function isGetFree(
  expr: Expressions.TupleExpression
): expr is Expressions.GetResolvedOrKeyword {
  const [opcode] = expr;
  return opcode === Op.GetKeyword || isGetContextualFree(expr);
}

export function isGetLexical(
  expr: Expressions.TupleExpression
): expr is Expressions.GetLexicalSymbol | Expressions.GetPathLexicalSymbol {
  return expr[0] === Op.GetLexicalSymbol;
}

export function isGetContextualFree(
  expr: Expressions.TupleExpression
): expr is Expressions.GetResolved | Expressions.GetPathContextualFree {
  const [opcode] = expr;
  switch (opcode) {
    case Op.ResolveAsComponentCallee:
    case Op.ResolveAsCurlyCallee:
    case Op.ResolveAsHelperCallee:
    case Op.ResolveAsModifierCallee:
      return true;
    default:
      return false;
  }
}
