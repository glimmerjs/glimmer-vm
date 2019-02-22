import { Option } from '@glimmer/interfaces';
import * as hbs from '../../types/handlebars-ast';
import { TokenKind } from '../lex';
import { FallibleSyntax, HandlebarsParser, Syntax, UNMATCHED } from './core';
import { CallBodySyntax } from './mustache';
import { TOKENS } from './tokens';
import { TOP } from './top';
import { optionalLeadingWS, TRAILING_WS } from './whitespace';
import { listSpan } from '../pos';

class BlockSyntax implements Syntax<hbs.BlockStatement> {
  readonly description = 'block';

  parse(parser: HandlebarsParser): hbs.BlockStatement | UNMATCHED {
    if (!parser.is(TokenKind.OpenBlock)) return UNMATCHED;

    let {
      value: { callBody, defaultBlock, inverseBlock, blockEnd },
      span,
    } = parser.spanned(() => {
      parser.shift();

      let { body: callBody, span: openBlockSpan } = parser.expect(OPEN_BLOCK);
      let innerStart = openBlockSpan.end;

      let defaultBlock: Option<hbs.Program> = null;
      let inverseBlock: Option<hbs.Program> = null;
      let adjustedDefault = false;

      while (true) {
        let startEndBlock = parser.test(OPEN_END);

        if (startEndBlock === true) {
          break;
        }

        let inverseMustache = parser.parse(ELSE);

        debugger;

        if (inverseMustache !== UNMATCHED) {
          defaultBlock!.span.end = inverseMustache.inner.span.start;
          inverseBlock = parser.parse(BLOCK_BODY);
          inverseBlock.span.start = inverseMustache.inner.span.end;
          adjustedDefault = true;
        } else {
          defaultBlock = parser.expect(BLOCK_BODY);
          defaultBlock.span.start = innerStart;
        }
      }

      let close = parser.expect(CLOSE_BLOCK);

      if (defaultBlock && !adjustedDefault) {
        defaultBlock.span.end = close.inner.start;
      }

      if (!defaultBlock) {
        defaultBlock = {
          type: 'Program',
          span: { start: innerStart, end: close.inner.start },
          body: null,
          blockParams: null,
        };
      }

      return {
        callBody,
        defaultBlock,
        inverseBlock,
        blockEnd: close.inner.end,
      };
    });

    return {
      type: 'BlockStatement',
      span: { start: span.start, end: blockEnd },
      body: callBody,
      program: defaultBlock,
      inverse: inverseBlock,
    };
  }
}

export const RAW_BLOCK = new BlockSyntax();

export const BLOCK = optionalLeadingWS(RAW_BLOCK);

class OpenBlockSyntax implements FallibleSyntax<{ body: hbs.CallBody; span: hbs.Span }> {
  readonly description = 'open block';
  readonly fallible = true;

  parse(parser: HandlebarsParser): { body: hbs.CallBody; span: hbs.Span } | UNMATCHED {
    let bodySyntax = new CallBodySyntax(TOKENS['}}']);

    let { value: mustache, span } = parser.spanned(() => {
      return parser.parse(bodySyntax);
    });

    if (mustache === UNMATCHED) {
      return UNMATCHED;
    }

    parser.parse(TRAILING_WS);

    return {
      span,
      body: mustache,
    };
  }

  orElse(parser: HandlebarsParser): { body: hbs.CallBody; span: hbs.Span } {
    let span = { start: parser.position(), end: parser.position() };

    return {
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
    };
  }
}

const OPEN_BLOCK = new OpenBlockSyntax();

class BlockBody implements FallibleSyntax<hbs.Program> {
  readonly description = 'block body';
  readonly fallible = true;

  parse(parser: HandlebarsParser): hbs.Program {
    const elseSyntax = parser.parse(ELSE);

    if (elseSyntax !== UNMATCHED) {
      return {
        type: 'Program',
        span: elseSyntax.inner.span,
        body: [],
        blockParams: [],
      };
    }

    let body: hbs.Statement[] = [];

    while (true) {
      let start = parser.parse(BLOCK_CONTENT);

      if (start === UNMATCHED) break;

      body.push(start);
    }

    return {
      type: 'Program',
      span: listSpan(body, parser.position()),
      body: body.length ? body : null,
      blockParams: null,
    };
  }

  orElse(parser: HandlebarsParser): hbs.Program {
    return {
      type: 'Program',
      span: { start: parser.position(), end: parser.position() },
      body: [],
      blockParams: [],
    };
  }
}

const BLOCK_BODY = new BlockBody();

class BlockContentSyntax implements Syntax<hbs.Statement> {
  readonly description = 'block content';

  parse(parser: HandlebarsParser): hbs.Statement | UNMATCHED {
    let elseSyntax = parser.test(ELSE);

    if (elseSyntax) {
      return UNMATCHED;
    }

    let endSyntax = parser.test(OPEN_END);

    if (endSyntax) {
      return UNMATCHED;
    }

    return TOP.parse(parser);
  }
}

const BLOCK_CONTENT = new BlockContentSyntax();

class ElseSyntax implements Syntax<{ span: hbs.Span }> {
  readonly description = '{{else';

  parse(parser: HandlebarsParser): { span: hbs.Span; value: hbs.CallBody | null } | UNMATCHED {
    if (parser.isCurlyPath('else')) {
      let { span, value } = parser.spanned(() => {
        parser.shift();
        parser.shift();

        if (parser.parse(TOKENS['}}']) !== UNMATCHED) {
          return null;
        } else {
          let bodySyntax = new CallBodySyntax(TOKENS['}}']);
          return parser.expect(bodySyntax);
        }
      });

      parser.parse(TRAILING_WS);

      return { span, value };
    } else {
      return UNMATCHED;
    }
  }
}

const RAW_ELSE = new ElseSyntax();
const ELSE = optionalLeadingWS(RAW_ELSE);

const OPEN_END = optionalLeadingWS(TOKENS['{{/']);

class CloseBlockSyntax implements FallibleSyntax<{ outer: hbs.Span; inner: hbs.Span }> {
  readonly fallible = true;

  get description() {
    return 'close block';
  }

  parse(parser: HandlebarsParser): { outer: hbs.Span; inner: hbs.Span } | UNMATCHED {
    const openEnd = parser.parse(OPEN_END);

    if (openEnd === UNMATCHED) {
      return UNMATCHED;
    }

    parser.expect(TOKENS.ID);
    parser.expect(TOKENS['}}']);
    let endStart = parser.position();

    parser.parse(TRAILING_WS);
    let endPos = parser.position();

    return {
      outer: { start: openEnd.outer.start, end: endPos },
      inner: { start: openEnd.inner.span.start, end: endStart },
    };
  }

  orElse(parser: HandlebarsParser): { outer: hbs.Span; inner: hbs.Span } {
    let span = { start: parser.position(), end: parser.position() };
    return { outer: span, inner: span };
  }
}

const CLOSE_BLOCK = new CloseBlockSyntax();
