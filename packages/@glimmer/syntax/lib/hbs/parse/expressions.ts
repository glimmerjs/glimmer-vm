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

class ExpressionSyntax implements FallibleSyntax<hbs.Expression, ExpressionType> {
  readonly description = 'expression';
  readonly fallible = true;

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

  orElse(): Thunk<hbs.Expression> {
    return span => ({
      type: 'UndefinedLiteral',
      span,
      value: undefined,
    });
  }
}

export const EXPR = new ExpressionSyntax();

export class ParamsSyntax implements Syntax<Option<hbs.Expression[]>, true> {
  readonly description = 'params';

  test(parser: HandlebarsParser): Option<true> {
    return parser.test(EXPR) ? true : null;
  }

  parse(parser: HandlebarsParser): Thunk<Option<hbs.Expression[]>> {
    let params: hbs.Expression[] = [];

    while (true) {
      let hash = parser.test(HASH);

      if (hash !== null) {
        break;
      }

      let next = parser.test(EXPR);

      if (next === null) {
        break;
      } else {
        params.push(parser.parse(EXPR, next));
      }
    }

    return () => (params.length ? params : null);
  }
}

export const PARAMS = new ParamsSyntax();

export class HashSyntax implements Syntax<hbs.Hash, true> {
  readonly description = 'hash';

  test(parser: HandlebarsParser): Option<true> {
    return parser.test(HASH_PAIR);
  }

  parse(parser: HandlebarsParser): Thunk<hbs.Hash> {
    let pairs: hbs.HashPair[] = [];

    pairs.push(parser.parse(HASH_PAIR, true));

    while (true) {
      let pair = parser.maybe(HASH_PAIR);

      if (pair === null) {
        break;
      } else {
        pairs.push(pair);
      }
    }

    return span => ({
      type: 'Hash',
      span,
      pairs,
    });
  }
}

export const HASH = new HashSyntax();

export class HashPairSyntax implements Syntax<hbs.HashPair, true> {
  readonly description = 'hash pair';

  test(parser: HandlebarsParser): Option<true> {
    if (parser.peek().kind !== TokenKind.Identifier) {
      return null;
    }

    let after = parser.peek2();

    if (after && after.kind === TokenKind.Equals) {
      return true;
    }

    return null;
  }

  parse(parser: HandlebarsParser): Thunk<hbs.HashPair> {
    let id = parser.shift();
    parser.expect(TOKENS['=']);
    let expr = parser.expect(EXPR);

    return span => ({
      type: 'HashPair',
      span,
      key: parser.slice(id.span),
      value: expr,
    });
  }
}

const HASH_PAIR = new HashPairSyntax();
