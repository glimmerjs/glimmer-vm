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
      value: { defaultBlock, inverseBlocks, blockEnd },
      span,
    } = parser.spanned(() => {
      parser.shift();

      let defaultBlock = parser.parse(WHOLE_BLOCK);

      if (defaultBlock === UNMATCHED) {
        throw new Error(`Unimplemented error recovery after {{#`);
      }

      let currentBlock: hbs.Program = defaultBlock;

      let inverseBlocks: hbs.Program[] = [];

      while (true) {
        let startEndBlock = parser.test(OPEN_END);

        if (startEndBlock === true) {
          break;
        }

        let inverseMustache = parser.parse(ELSE);

        if (inverseMustache !== UNMATCHED) {
          // defaultBlock!.span.end = inverseMustache.inner.span.start;
          let inverseBlock = parser.parse(WHOLE_BLOCK);

          if (inverseBlock === UNMATCHED) {
            throw new Error(`unimplemented error recovery after {{else`);
          }

          currentBlock.span.end = inverseMustache.inner.span.start;
          currentBlock = inverseBlock;

          inverseBlocks.push(inverseBlock);
          // inverseBlock.span.start = inverseMustache.inner.span.end;
          // adjustedDefault = true;
        }
      }

      let close = parser.expect(CLOSE_BLOCK);

      debugger;
      currentBlock.span.end = close.inner.start;

      return {
        defaultBlock,
        inverseBlocks: inverseBlocks.length ? inverseBlocks : null,
        blockEnd: close.inner.end,
      };
    });

    return {
      type: 'BlockStatement',
      span: { start: span.start, end: blockEnd },
      program: defaultBlock,
      inverses: inverseBlocks,
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

class BlockBody implements FallibleSyntax<{ span: hbs.Span; body: hbs.Statement[] | null }> {
  readonly description = 'block body';
  readonly fallible = true;

  parse(parser: HandlebarsParser): { span: hbs.Span; body: hbs.Statement[] | null } {
    const elseSyntax = parser.parse(ELSE);

    if (elseSyntax !== UNMATCHED) {
      return {
        span: elseSyntax.inner.span,
        body: null,
      };
    }

    let body: hbs.Statement[] = [];

    while (true) {
      let start = parser.parse(BLOCK_CONTENT);

      if (start === UNMATCHED) break;

      body.push(start);
    }

    return {
      span: listSpan(body, parser.position()),
      body: body.length ? body : null,
    };
  }

  orElse(parser: HandlebarsParser): { span: hbs.Span; body: hbs.Statement[] | null } {
    return {
      span: { start: parser.position(), end: parser.position() },
      body: null,
    };
  }
}

const BLOCK_BODY = new BlockBody();

class WholeBlock implements Syntax<hbs.Program> {
  readonly description = 'entire block';

  parse(parser: HandlebarsParser): hbs.Program | UNMATCHED {
    let call: Option<hbs.CallBody>;

    if (parser.is(TokenKind.Close)) {
      parser.shift();
      call = null;
    } else {
      let callBody = parser.parse(new CallBodySyntax(TOKENS['}}']));

      if (callBody === UNMATCHED) {
        return UNMATCHED;
      }

      call = callBody;
    }

    let startPos = parser.position();
    parser.parse(TRAILING_WS);

    let { span, body } = parser.parse(BLOCK_BODY);

    return {
      type: 'Program',
      span: { start: startPos, end: span.end },
      call,
      body,
      blockParams: null,
    };
  }
}

const WHOLE_BLOCK = new WholeBlock();

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

  parse(parser: HandlebarsParser): { span: hbs.Span } | UNMATCHED {
    if (parser.isCurlyPath('else')) {
      let { span } = parser.spanned(() => {
        parser.shift();
        parser.shift();
      });

      return { span };
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
