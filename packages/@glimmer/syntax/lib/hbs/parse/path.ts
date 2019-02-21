import * as hbs from '../../types/handlebars-ast';
import { TokenKind } from '../lex';
import { FallibleSyntax, HandlebarsParser, Syntax, UNMATCHED } from './core';
import { TOKENS } from './tokens';

export const enum PathKind {
  LocalReference,
  ArgReference,
  MacroHead,
}

export class HeadSyntax implements Syntax<hbs.Head> {
  readonly description = 'path head';

  parse(parser: HandlebarsParser): hbs.Head | UNMATCHED {
    if (parser.isMacro('head')) {
      return parser.expandHeadMacro();
    }

    if (parser.is(TokenKind.Identifier)) {
      let head = parser.shift();
      return { type: 'LocalReference', span: head.span, name: parser.slice(head.span) };
    }

    if (parser.is(TokenKind.AtName)) {
      let head = parser.shift();
      return {
        type: 'ArgReference',
        span: head.span,
        name: parser.slice(head.span).slice(1),
      };
    }

    return UNMATCHED;
  }
}

export const HEAD = new HeadSyntax();

export class PathSyntax implements Syntax<hbs.PathExpression> {
  readonly description = 'path';

  parse(parser: HandlebarsParser): hbs.PathExpression | UNMATCHED {
    const { value, span } = parser.spanned(() => {
      const head = parser.parse(HEAD);

      if (head === UNMATCHED) {
        return UNMATCHED;
      }

      let tail: hbs.PathSegment[] = [];

      while (true) {
        if (parser.parse(TOKENS['.']) !== UNMATCHED) {
          tail.push(parser.expect(SEGMENT));
        } else {
          break;
        }
      }

      return { head, tail: tail.length ? tail : null };
    });

    if (value === UNMATCHED) {
      return UNMATCHED;
    }

    return {
      type: 'PathExpression',
      span: { start: value.head.span.start, end: span.end },
      head: value.head,
      tail: value.tail,
    };
  }
}

export const PATH = new PathSyntax();

export class PathSegmentSyntax implements FallibleSyntax<hbs.PathSegment> {
  readonly description = 'path segment';
  readonly fallible = true;

  parse(parser: HandlebarsParser): hbs.PathSegment | UNMATCHED {
    const id = parser.parse(TOKENS.ID);

    if (id === UNMATCHED) {
      return UNMATCHED;
    }

    return {
      type: 'PathSegment',
      span: id.span,
      name: parser.slice(id.span),
    };
  }

  orElse(parser: HandlebarsParser): hbs.PathSegment {
    return {
      type: 'PathSegment',
      span: { start: parser.position(), end: parser.position() },
      name: '<error>',
    };
  }
}

const SEGMENT = new PathSegmentSyntax();
