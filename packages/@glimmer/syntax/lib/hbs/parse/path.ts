import * as hbs from '../../types/handlebars-ast';
import { Syntax, HandlebarsParser, Thunk, FallibleSyntax, node } from './core';
import { Option } from '@glimmer/interfaces';
import { TokenKind } from '../lex';
import { TOKENS } from './tokens';

export const enum PathKind {
  LocalReference,
  ArgReference,
  MacroHead,
}

export class HeadSyntax implements Syntax<hbs.Head, PathKind> {
  readonly description = 'path head';

  test(parser: HandlebarsParser): Option<PathKind> {
    if (parser.isMacro('head')) {
      return PathKind.MacroHead;
    }

    switch (parser.peek().kind) {
      case TokenKind.Identifier:
        return PathKind.LocalReference;
      case TokenKind.AtName:
        return PathKind.ArgReference;
      default:
        return null;
    }
  }

  parse(parser: HandlebarsParser, kind: PathKind): Thunk<hbs.Head> {
    switch (kind) {
      case PathKind.LocalReference: {
        let head = parser.shift();
        return span => ({ type: 'LocalReference', span, name: parser.slice(head.span) });
      }

      case PathKind.ArgReference: {
        let head = parser.shift();
        return span => ({ type: 'ArgReference', span, name: parser.slice(head.span).slice(1) });
      }

      case PathKind.MacroHead: {
        return node(parser.expandHeadMacro());
      }
    }
  }
}

export const HEAD = new HeadSyntax();

export class PathSyntax implements Syntax<hbs.PathExpression, PathKind> {
  readonly description = 'path';

  test(parser: HandlebarsParser): Option<PathKind> {
    return parser.test(HEAD);
  }

  parse(parser: HandlebarsParser, kind: PathKind): Thunk<hbs.PathExpression> {
    let head = parser.parse(HEAD, kind);

    let tail: hbs.PathSegment[] = [];

    while (true) {
      if (parser.test(TOKENS['.'])) {
        parser.shift();
        tail.push(parser.expect(SEGMENT));
      } else {
        break;
      }
    }

    return span => ({
      type: 'PathExpression',
      span,
      head,
      tail: tail.length ? tail : null,
    });
  }
}

export const PATH = new PathSyntax();

export class PathSegmentSyntax implements FallibleSyntax<hbs.PathSegment, true> {
  readonly description = 'path segment';
  readonly fallible = true;

  test(parser: HandlebarsParser): Option<true> {
    return parser.is(TokenKind.Identifier) ? true : null;
  }

  parse(parser: HandlebarsParser): Thunk<hbs.PathSegment> {
    parser.shift();

    return span => ({
      type: 'PathSegment',
      span,
      name: parser.slice(span),
    });
  }

  orElse(): Thunk<hbs.PathSegment> {
    return span => ({
      type: 'PathSegment',
      span,
      name: '<error>',
    });
  }
}

const SEGMENT = new PathSegmentSyntax();
