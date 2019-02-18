import * as hbs from '../../types/handlebars-ast';
import { Syntax, HandlebarsParser, Thunk, FallibleSyntax } from './core';
import { Option } from '@glimmer/interfaces';
import { TokenKind } from '../lex';
import { NUMBER, STRING } from './literals';
import { TOKENS } from './tokens';
import { PATH, PathKind } from './path';

export const enum ExpressionTypeKind {
  Macro,
  Number,
  String,
  Path,
}

export type ExpressionType =
  | {
      type: ExpressionTypeKind.Macro;
    }
  | {
      type: ExpressionTypeKind.Number;
    }
  | {
      type: ExpressionTypeKind.String;
    }
  | {
      type: ExpressionTypeKind.Path;
      kind: PathKind;
    };

class ExpressionSyntax implements Syntax<hbs.Expression, ExpressionType> {
  readonly description = 'expression';

  test(parser: HandlebarsParser): Option<ExpressionType> {
    if (parser.isMacro('expr')) {
      return { type: ExpressionTypeKind.Macro };
    }

    let number = parser.test(NUMBER);

    if (number !== null) {
      return { type: ExpressionTypeKind.Number };
    }

    let string = parser.test(STRING);

    if (string !== null) {
      return { type: ExpressionTypeKind.String };
    }

    let path = parser.test(PATH);

    if (path !== null) {
      return { type: ExpressionTypeKind.Path, kind: path };
    }

    return null;
  }

  parse(parser: HandlebarsParser, type: ExpressionType): Thunk<hbs.Expression> {
    switch (type.type) {
      case ExpressionTypeKind.Macro: {
        let expr = parser.expandExpressionMacro();

        return () => expr;
      }

      case ExpressionTypeKind.Number: {
        let expr = parser.parse(NUMBER, true);

        return () => expr;
      }

      case ExpressionTypeKind.String: {
        let expr = parser.parse(STRING, true);

        return () => expr;
      }

      case ExpressionTypeKind.Path: {
        let expr = parser.parse(PATH, type.kind);

        return () => expr;
      }
    }
  }
}

export const EXPR = new ExpressionSyntax();

export class ParamsSyntax implements Syntax<hbs.Expression[], true> {
  readonly description = 'params';

  test(parser: HandlebarsParser): Option<true> {
    return parser.test(EXPR) ? true : null;
  }

  parse(parser: HandlebarsParser): Thunk<hbs.Expression[]> {
    let params: hbs.Expression[] = [];

    while (true) {
      let next = parser.test(EXPR);

      if (next === null) {
        break;
      } else {
        params.push(parser.parse(EXPR, next));
      }
    }

    return () => params;
  }
}

export const PARAMS = new ParamsSyntax();
