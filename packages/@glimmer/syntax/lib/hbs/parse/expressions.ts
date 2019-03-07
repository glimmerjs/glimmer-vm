import { Option } from '@glimmer/interfaces';
import * as hbs from '../../types/handlebars-ast';
import { TokenKind } from '../lex';
import { FallibleSyntax, HandlebarsParser, Syntax, UNMATCHED } from './core';
import { NUMBER, STRING } from './literals';
import { PATH } from './path';
import { TOKENS } from './tokens';
import { CallBodySyntax } from './mustache';
import { BLOCK_PARAMS } from './block';

export const enum ExpressionTypeKind {
  Macro,
  Number,
  String,
  Path,
}

class ExpressionSyntax implements FallibleSyntax<hbs.Expression> {
  readonly description = 'expression';
  readonly fallible = true;

  parse(parser: HandlebarsParser): hbs.Expression | UNMATCHED {
    if (parser.isMacro('expr')) {
      return parser.expandExpressionMacro();
    }

    let sexpr = parser.parse(SUBEXPR);

    if (sexpr !== UNMATCHED) {
      return sexpr;
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
    if (parser.test(BLOCK_PARAMS)) {
      return UNMATCHED;
    }

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
      if (parser.test(BLOCK_PARAMS)) {
        break;
      }

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
      span,
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

class SubExpression implements Syntax<hbs.SubExpression> {
  readonly description = 'subexpression';

  parse(parser: HandlebarsParser): hbs.SubExpression | UNMATCHED {
    if (!parser.is(TokenKind.OpenParen)) {
      return UNMATCHED;
    }

    let { span, value: body } = parser.spanned(() => {
      parser.shift();
      return parser.parse(new CallBodySyntax(TOKENS[')']));
    });

    if (body === UNMATCHED) {
      return UNMATCHED;
    }

    return {
      type: 'SubExpression',
      span,
      body,
    };
  }
}

const SUBEXPR = new SubExpression();
