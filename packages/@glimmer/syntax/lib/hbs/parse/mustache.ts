import { Option } from '@glimmer/interfaces';
import * as hbs from '../../types/handlebars-ast';
import { FallibleSyntax, HandlebarsParser, Syntax, UNMATCHED } from './core';
import { HASH, PARAMS } from './expressions';
import { NUMBER, STRING } from './literals';
import { PATH, PathKind } from './path';
import { TOKENS } from './tokens';

export const enum MustacheKind {
  Double,
  Triple,
}

export class MustacheSyntax implements Syntax<hbs.MustacheStatement | hbs.MustacheContent> {
  readonly description = `{{...}}`;

  parse(parser: HandlebarsParser): hbs.MustacheStatement | hbs.MustacheContent | UNMATCHED {
    let bodySyntax: CallBodySyntax;
    let trusted: boolean;

    const { value, span } = parser.spanned(() => {
      if (parser.parse(TOKENS['{{']) !== UNMATCHED) {
        bodySyntax = new CallBodySyntax(TOKENS['}}']);
        trusted = false;
      } else if (parser.parse(TOKENS['{{{']) !== UNMATCHED) {
        bodySyntax = new CallBodySyntax(TOKENS['}}}']);
        trusted = true;
      } else {
        return UNMATCHED;
      }

      let result = parser.parse(bodySyntax);

      if (result === UNMATCHED) {
        throw new Error('unimplemented, parse error recovery after {{');
      }

      return { result, trusted };
    });

    if (value === UNMATCHED) {
      return UNMATCHED;
    }

    return buildMustache(value.result, value.trusted, span);
  }
}

export const MUSTACHE = new MustacheSyntax();

const enum CallBodyStartKind {
  Sexp,
  Path,
  ExprMacro,
  StringLiteral,
  NumberLiteral,
}

export type CallBodyStart =
  | {
      type: CallBodyStartKind.Sexp;
    }
  | {
      type: CallBodyStartKind.Path;
      kind: PathKind;
    }
  | { type: CallBodyStartKind.ExprMacro }
  | {
      type: CallBodyStartKind.StringLiteral;
    }
  | {
      type: CallBodyStartKind.NumberLiteral;
    };

export class CallBodySyntax implements FallibleSyntax<hbs.CallBody> {
  readonly fallible = true;

  constructor(private close: FallibleSyntax<{ span: hbs.Span }>) {}

  get description() {
    return `call body (closed by ${this.close}})`;
  }

  parse(parser: HandlebarsParser): hbs.CallBody | UNMATCHED {
    {
      const number = parser.parse(NUMBER);

      if (number !== UNMATCHED) {
        parser.expect(this.close);
        return buildCallBody(number);
      }
    }

    {
      const string = parser.parse(STRING);

      if (string !== UNMATCHED) {
        parser.expect(this.close);
        return buildCallBody(string);
      }
    }

    if (parser.isMacro('expr')) {
      let expr = parser.expandExpressionMacro();
      parser.expect(this.close);

      return buildCallBody(expr);
    }

    const call = parser.parse(PATH);

    if (call !== UNMATCHED) {
      let close = parser.parse(this.close);

      if (close !== UNMATCHED) {
        return buildCallBody(call);
      }

      let params = parser.parse(PARAMS);
      let hash = parser.parse(HASH);
      parser.expect(this.close);

      return buildCallBody(
        call,
        params === UNMATCHED ? null : params,
        hash === UNMATCHED ? null : hash
      );
    } else {
      return UNMATCHED;
    }
  }

  orElse(parser: HandlebarsParser): hbs.CallBody {
    let span = { start: parser.position(), end: parser.position() };
    return buildCallBody({
      type: 'UndefinedLiteral',
      span,
      value: undefined,
    });
  }
}

function buildCallBody(
  call: hbs.Expression,
  params: Option<hbs.Expression[]> = null,
  hash: Option<hbs.Hash> = null
): hbs.CallBody {
  let end: number;
  if (hash) {
    end = hash.span.end;
  } else if (params) {
    end = params[params.length - 1].span.end;
  } else {
    end = call.span.end;
  }

  return {
    type: 'CallBody',
    span: { start: call.span.start, end },
    call,
    params: params || null,
    hash: hash || null,
  };
}

function buildMustache(
  mustache: hbs.CallBody,
  trusted: boolean,
  span: hbs.Span
): hbs.MustacheContent | hbs.MustacheStatement {
  if (mustache.params === null && mustache.hash === null) {
    return {
      type: 'MustacheContent',
      span,
      value: mustache.call,
      trusted,
    };
  } else {
    return {
      type: 'MustacheStatement',
      span,
      body: mustache,
      trusted,
    };
  }
}
