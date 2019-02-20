import { Option } from '@glimmer/interfaces';
import * as hbs from '../../types/handlebars-ast';
import { TokenKind } from '../lex';
import { HandlebarsParser, Syntax, Thunk, FallibleSyntax, node } from './core';
import { optionalLeadingWS, TRAILING_WS, LeadingWhitespaceKind } from './whitespace';
import { CallBody, CallBodyStart } from './mustache';
import { TOKENS } from './tokens';
import { TOP, TopSyntaxStart } from './top';

class BlockSyntax implements Syntax<hbs.BlockStatement, true> {
  readonly description = 'block';

  test(parser: HandlebarsParser): Option<true> {
    return parser.is(TokenKind.OpenBlock) ? true : null;
  }

  parse(parser: HandlebarsParser): Thunk<hbs.BlockStatement> {
    parser.shift();

    let { body: callBody, span: openBlockSpan } = parser.expect(OPEN_BLOCK);
    let startPos = openBlockSpan.end;

    let defaultBlock: Option<hbs.Program> = null;
    let inverseBlock: Option<hbs.Program> = null;

    while (true) {
      let startEndBlock = parser.test(OPEN_END);

      if (startEndBlock !== null) {
        break;
      }

      let startElse = parser.test(ELSE);

      if (startElse !== null) {
        throw new Error('not implemented: else');
      }

      defaultBlock = parser.expect(BLOCK_BODY);
      if (defaultBlock.span) {
        defaultBlock.span.start = startPos;
      }
    }

    let close = parser.expect(CLOSE_BLOCK);

    if (defaultBlock && defaultBlock.span) {
      defaultBlock.span.end = close.inner.start;
    }

    return span => {
      return {
        type: 'BlockStatement',
        span,
        body: callBody,
        program: defaultBlock || {
          type: 'Program',
          span: { start: startPos, end: close.inner.start },
          body: null,
          blockParams: null,
        },
        inverse: inverseBlock,
      };
    };
  }
}

export const RAW_BLOCK = new BlockSyntax();

export const BLOCK = optionalLeadingWS(RAW_BLOCK);

class OpenBlockSyntax
  implements FallibleSyntax<{ body: hbs.CallBody; span: hbs.Span }, CallBodyStart> {
  readonly description = 'open block';
  readonly fallible = true;

  test(parser: HandlebarsParser): Option<CallBodyStart> {
    let body = new CallBody(TOKENS['}}']);

    return parser.test(body);
  }

  parse(
    parser: HandlebarsParser,
    start: CallBodyStart
  ): Thunk<{ body: hbs.CallBody; span: hbs.Span }> {
    let body = new CallBody(TOKENS['}}']);

    let mustache = parser.parse(body, start);

    let startWs = parser.test(TRAILING_WS);
    if (startWs !== null) {
      parser.skip(TRAILING_WS, startWs);
    }

    return span => ({
      span,
      body: mustache,
    });
  }

  orElse(): Thunk<{ body: hbs.CallBody; span: hbs.Span }> {
    return span => ({
      span,
      body: {
        type: 'CallBody',
        span,
        call: {
          type: 'UndefinedLiteral',
          span,
          value: undefined,
        },
        params: null,
        hash: null,
      },
    });
  }
}

const OPEN_BLOCK = new OpenBlockSyntax();

const enum InBlockKind {
  Top,
  EmptyDefault,
}

type InBlock =
  | { type: InBlockKind.Top; start: TopSyntaxStart }
  | { type: InBlockKind.EmptyDefault };

class BlockBody implements FallibleSyntax<hbs.Program, InBlock> {
  readonly description = 'block body';
  readonly fallible = true;

  test(parser: HandlebarsParser): Option<InBlock> {
    let startElse = parser.test(ELSE);

    if (startElse !== null) {
      return { type: InBlockKind.EmptyDefault };
    }

    let startTop = parser.test(TOP);

    if (startTop !== null) {
      return { type: InBlockKind.Top, start: startTop };
    } else {
      return null;
    }
  }

  parse(parser: HandlebarsParser, start: InBlock): Thunk<hbs.Program> {
    switch (start.type) {
      case InBlockKind.EmptyDefault: {
        return span => ({
          type: 'Program',
          span,
          body: [],
          blockParams: [],
        });
      }

      case InBlockKind.Top: {
        let body: hbs.Statement[] = [];

        while (true) {
          let start = parser.test(BLOCK_CONTENT);

          if (start === null) break;

          body.push(parser.parse(BLOCK_CONTENT, start));
        }

        return span => ({
          type: 'Program',
          span,
          body: body.length ? body : null,
          blockParams: null,
        });
      }
    }
  }

  orElse(): Thunk<hbs.Program> {
    return span => ({
      type: 'Program',
      span,
      body: [],
      blockParams: [],
    });
  }
}

const BLOCK_BODY = new BlockBody();

class BlockContentSyntax implements Syntax<hbs.Statement, TopSyntaxStart> {
  readonly description = 'block content';

  test(parser: HandlebarsParser): Option<TopSyntaxStart> {
    let startElse = parser.test(ELSE);

    if (startElse !== null) {
      return null;
    }

    let startEnd = parser.test(OPEN_END);

    if (startEnd !== null) {
      return null;
    }

    return parser.test(TOP);
  }

  parse(parser: HandlebarsParser, start: TopSyntaxStart): Thunk<hbs.Statement> {
    return node(parser.parse(TOP, start));
  }
}

const BLOCK_CONTENT = new BlockContentSyntax();

class ElseSyntax implements Syntax<{ span: hbs.Span }, true> {
  readonly description = '{{else';

  test(parser: HandlebarsParser): Option<true> {
    if (parser.isCurlyPath('else')) {
      return true;
    } else {
      return null;
    }
  }

  parse(parser: HandlebarsParser): Thunk<{ span: hbs.Span }> {
    parser.shift();
    parser.shift();

    parser.expect(TOKENS['}}']);

    return span => ({ span });
  }
}

const RAW_ELSE = new ElseSyntax();
const ELSE = optionalLeadingWS(RAW_ELSE);

const OPEN_END = optionalLeadingWS(TOKENS['{{/']);

class CloseBlockSyntax
  implements FallibleSyntax<{ outer: hbs.Span; inner: hbs.Span }, LeadingWhitespaceKind<true>> {
  readonly fallible = true;

  get description() {
    return 'close block';
  }

  test(parser: HandlebarsParser): Option<LeadingWhitespaceKind<true>> {
    return parser.test(OPEN_END);
  }

  parse(
    parser: HandlebarsParser,
    startWS: LeadingWhitespaceKind<true>
  ): Thunk<{ outer: hbs.Span; inner: hbs.Span }> {
    let openEnd = parser.parse(OPEN_END, startWS);
    parser.expect(TOKENS.ID);
    parser.expect(TOKENS['}}']);
    let endStart = parser.position();

    let start = parser.test(TRAILING_WS);
    if (start !== null) {
      parser.skip(TRAILING_WS, start);
    }
    let endPos = parser.position();

    return () => ({
      outer: { start: openEnd.outer.start, end: endPos },
      inner: { start: openEnd.inner.span.start, end: endStart },
    });
  }

  orElse(): Thunk<{ outer: hbs.Span; inner: hbs.Span }> {
    return span => ({ outer: span, inner: span });
  }
}

const CLOSE_BLOCK = new CloseBlockSyntax();
