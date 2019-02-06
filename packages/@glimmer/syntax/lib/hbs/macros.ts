import { ExpressionSyntax, HandlebarsParser } from './parser';
import * as hbs from '../types/handlebars-ast';
import { unreachable } from '@glimmer/util';

export interface Macro<T> {
  description(): string;
  parse(openSpan: hbs.Span, parser: HandlebarsParser): T;
  placeholder(): T;
}

export type MacroExpansion<M extends Macro<unknown>> = M extends Macro<infer T> ? T : never;

function LiteralMacro<T extends hbs.Literal>(type: T['type'], value: T['value']): Macro<T> {
  return {
    description() {
      return `${value}`;
    },

    parse(span) {
      return {
        span,
        type,
        value,
        original: value,
      } as T;
    },

    placeholder() {
      throw unreachable();
    },
  };
}

export const TRUE_MACRO = LiteralMacro('BooleanLiteral', true);
export const FALSE_MACRO = LiteralMacro('BooleanLiteral', false);
export const NULL_MACRO = LiteralMacro('NullLiteral', null);
export const UNDEFINED_MACRO = LiteralMacro('UndefinedLiteral', undefined);
