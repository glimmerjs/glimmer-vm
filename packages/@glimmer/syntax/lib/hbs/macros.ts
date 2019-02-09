import { HandlebarsParser } from './parser';
import * as hbs from '../types/handlebars-ast';
import { unreachable } from '@glimmer/util';

export interface Macro<T> {
  description(): string;
  parse(openSpan: hbs.Span, parser: HandlebarsParser): T;
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
      } as T;
    },
  };
}

export const THIS_MACRO: Macro<hbs.This> = {
  description() {
    return `this`;
  },

  parse(span) {
    return {
      span,
      type: 'This',
    };
  },
};

export const TRUE_MACRO = LiteralMacro('BooleanLiteral', true);
export const FALSE_MACRO = LiteralMacro('BooleanLiteral', false);
export const NULL_MACRO = LiteralMacro('NullLiteral', null);
export const UNDEFINED_MACRO = LiteralMacro('UndefinedLiteral', undefined);
