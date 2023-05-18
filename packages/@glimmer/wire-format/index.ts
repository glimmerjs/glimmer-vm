import type { Expression, Expressions, Statement, Statements } from '@glimmer/interfaces';
import {
  WIRE_ATTR_SPLAT,
  WIRE_CALL,
  WIRE_COMPONENT_ATTR,
  WIRE_DYNAMIC_ARG,
  WIRE_DYNAMIC_ATTR,
  WIRE_FLUSH_ELEMENT,
  WIRE_GET_SYMBOL,
  WIRE_MODIFIER,
  WIRE_STATIC_ARG,
  WIRE_STATIC_ATTR,
  WIRE_STATIC_COMPONENT_ATTR,
  WIRE_TRUSTING_COMPONENT_ATTR,
  WIRE_TRUSTING_DYNAMIC_ATTR,
} from './lib/opcodes';

export * from './lib/opcodes';

export { resolution as VariableResolutionContext } from './lib/resolution';
export { WellKnownAttrNames, WellKnownTagNames } from './lib/well-known';

export function is<T>(variant: number): (value: any) => value is T {
  return function (value: any): value is T {
    return Array.isArray(value) && value[0] === variant;
  };
}

// Statements
export const isFlushElement = is<Statements.FlushElement>(WIRE_FLUSH_ELEMENT);

export function isAttribute(val: Statement): val is Statements.Attribute {
  return (
    val[0] === WIRE_STATIC_ATTR ||
    val[0] === WIRE_DYNAMIC_ATTR ||
    val[0] === WIRE_TRUSTING_DYNAMIC_ATTR ||
    val[0] === WIRE_COMPONENT_ATTR ||
    val[0] === WIRE_STATIC_COMPONENT_ATTR ||
    val[0] === WIRE_TRUSTING_COMPONENT_ATTR ||
    val[0] === WIRE_ATTR_SPLAT ||
    val[0] === WIRE_MODIFIER
  );
}

export function isStringLiteral(expr: Expression): expr is Expressions.StringValue {
  return typeof expr === 'string';
}

export function getStringFromValue(expr: Expressions.StringValue): string {
  return expr;
}

export function isArgument(val: Statement): val is Statements.Argument {
  return val[0] === WIRE_STATIC_ARG || val[0] === WIRE_DYNAMIC_ARG;
}

export function isHelper(expr: Expression): expr is Expressions.Helper {
  return Array.isArray(expr) && expr[0] === WIRE_CALL;
}

// Expressions
export const isGet = is<Expressions.GetSymbol>(WIRE_GET_SYMBOL);
