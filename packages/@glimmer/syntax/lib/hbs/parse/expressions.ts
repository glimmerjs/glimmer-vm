import { Option } from '@glimmer/interfaces';
import * as hbs from '../../types/handlebars-ast';
import { TokenKind } from '../lex';
import { FallibleSyntax, HandlebarsParser, Syntax, UNMATCHED } from './core';
import { NUMBER, STRING } from './literals';
import { PATH, PathKind } from './path';
import { TOKENS } from './tokens';

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
      result: hbs.NumberLiteral;
    }
  | {
      type: ExpressionTypeKind.String;
    }
  | {
      type: ExpressionTypeKind.Path;
      kind: PathKind;
    };

class ExpressionSyntax implements FallibleSyntax<hbs.Expression> {
  readonly description = 'expression';
  readonly fallible = true;

  parse(parser: HandlebarsParser): hbs.Expression | UNMATCHED {
    if (parser.isMacro('expr')) {
      return parser.expandExpressionMacro();
    }

    let number = parser.parse(NUMBER);

    if (number !== UNMATCHED) {
      return number;
    }

    let string = parser.parse(STRING);

    if (string !== UNMATCHED) {
      return string;
    }

    let path = parser.parse(PATH);

    if (path !== UNMATCHED) {
      return path;
    }

    return UNMATCHED;
  }

  orElse(parser: HandlebarsParser): hbs.Expression {
    return {
      type: 'UndefinedLiteral',
      span: { start: parser.position(), end: parser.position() },
      value: undefined,
    };
  }
}

export const EXPR = new ExpressionSyntax();

export class ParamsSyntax implements Syntax<Option<hbs.Expression[]>> {
  readonly description = 'params';

  parse(parser: HandlebarsParser): hbs.Expression[] | UNMATCHED {
    let hash = parser.test(HASH);

    if (hash) {
      return UNMATCHED;
    }

    let first = parser.parse(EXPR);

    if (first === UNMATCHED) {
      return UNMATCHED;
    }

    let params: hbs.Expression[] = [first];

    while (true) {
      if (parser.test(HASH)) {
        break;
      }

      let next = parser.parse(EXPR);

      if (next === UNMATCHED) {
        break;
      } else {
        params.push(next);
      }
    }

    return params;
  }
}

export const PARAMS = new ParamsSyntax();

export class HashSyntax implements Syntax<hbs.Hash> {
  readonly description = 'hash';

  parse(parser: HandlebarsParser): hbs.Hash | UNMATCHED {
    let { value, span } = parser.spanned(() => {
      let first = parser.parse(HASH_PAIR);

      if (first === UNMATCHED) {
        return UNMATCHED;
      }

      let pairs: hbs.HashPair[] = [first];

      while (true) {
        let pair = parser.parse(HASH_PAIR);

        if (pair === UNMATCHED) {
          break;
        } else {
          pairs.push(pair);
        }
      }

      return pairs;
    });

    if (value === UNMATCHED) {
      return UNMATCHED;
    }

    return {
      type: 'Hash',
      span: { start: value[0].span.start, end: value[value.length - 1].span.end },
      pairs: value,
    };
  }
}

export const HASH = new HashSyntax();

export class HashPairSyntax implements Syntax<hbs.HashPair> {
  readonly description = 'hash pair';

  parse(parser: HandlebarsParser): hbs.HashPair | UNMATCHED {
    if (parser.peek().kind !== TokenKind.Identifier) {
      return UNMATCHED;
    }

    let after = parser.peek2();

    if (!after || after.kind !== TokenKind.Equals) {
      return UNMATCHED;
    }

    let id = parser.shift();
    parser.expect(TOKENS['=']);
    let expr = parser.expect(EXPR);

    return {
      type: 'HashPair',
      span: { start: id.span.start, end: expr.span.end },
      key: parser.slice(id.span),
      value: expr,
    };
  }
}

const HASH_PAIR = new HashPairSyntax();
