/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import type { Nullable, Recast } from '@glimmer/interfaces';
import type { TokenizerState } from 'simple-html-tokenizer';
import { getLast, isPresentArray, localAssert, unwrap } from '@glimmer/debug-util';

import type { ParserNodeBuilder, StartTag } from '../parser';
import type * as src from '../source/api';
import type { SourceOffset, SourceSpan } from '../source/span';
import type * as ASTv1 from '../v1/api';
import type * as HBS from '../v1/handlebars-ast';

import { Parser } from '../parser';
import { NON_EXISTENT_LOCATION } from '../source/location';
import { generateSyntaxError } from '../syntax-error';
import { appendChild, isHBSLiteral, printLiteral } from '../utils';
import b from '../v1/parser-builders';

const BEFORE_ATTRIBUTE_NAME = 'beforeAttributeName' as TokenizerState.beforeAttributeName;
const ATTRIBUTE_VALUE_UNQUOTED = 'attributeValueUnquoted' as TokenizerState.attributeValueUnquoted;

export interface PendingError {
  mustache(span: SourceSpan): never;
  eof(offset: SourceOffset): never;
}

export abstract class HandlebarsNodeVisitors extends Parser {
  // Because we interleave the HTML and HBS parsing, sometimes the HTML
  // tokenizer can run out of tokens when we switch into {{...}} or reached
  // EOF. There are positions where neither of these are expected, and it would
  // like to generate an error, but there is no span to attach the error to.
  // This allows the HTML tokenization to stash an error message and the next
  // mustache visitor will attach the message to the appropriate span and throw
  // the error.
  protected pendingError: Nullable<PendingError> = null;

  abstract override appendToCommentData(s: string): void;
  abstract override beginAttributeValue(quoted: boolean): void;
  abstract override finishAttributeValue(): void;

  parse(program: HBS.UpstreamProgram, blockParams: string[]): ASTv1.Template {
    localAssert(program.loc, '[BUG] Program in parser unexpectedly did not have loc');

    let node = b.template({
      body: [],
      blockParams,
      loc: this.source.spanFor(program.loc),
    });

    let template = this.parseProgram(node, program);

    // TODO: we really need to verify that the tokenizer is in an acceptable
    // state when we are "done" parsing. For example, right now, `<foo` parses
    // into `Template { body: [] }` which is obviously incorrect

    this.pendingError?.eof(template.loc.getEnd());

    return template;
  }

  Program(program: HBS.Program, blockParams?: ASTv1.VarHead[]): ASTv1.Block {
    // The abstract signature doesn't have the blockParams argument, but in
    // practice we can only come from this.BlockStatement() which adds the
    // extra argument for us
    localAssert(
      Array.isArray(blockParams),
      '[BUG] Program in parser unexpectedly called without block params'
    );

    localAssert(
      program.loc,
      '[BUG] Program in parser unexpectedly did not have loc. This should have been fixed in BlockStatement'
    );

    let node = b.blockItself({
      body: [],
      params: blockParams,
      chained: program.chained,
      loc: this.source.spanFor(program.loc),
    });

    return this.parseProgram(node, program);
  }

  private parseProgram<T extends ASTv1.ParentNode>(node: T, program: HBS.UpstreamProgram): T {
    if (program.body.length === 0) {
      return node;
    }

    let poppedNode;

    try {
      this.elementStack.push(node);

      for (let child of program.body) {
        this.acceptNode(child);
      }
    } finally {
      poppedNode = this.elementStack.pop();
    }

    // Ensure that that the element stack is balanced properly.
    if (node !== poppedNode) {
      if (poppedNode?.type === 'ElementNode') {
        throw generateSyntaxError(`Unclosed element \`${poppedNode.tag}\``, poppedNode.loc);
      } else {
        // If the stack is not balanced, then it is likely our own bug, because
        // any unclosed Handlebars blocks should already been caught by now
        localAssert(poppedNode !== undefined, '[BUG] empty parser elementStack');
        localAssert(false, `[BUG] mismatched parser elementStack node: ${node.type}`);
      }
    }

    return node;
  }

  BlockStatement(block: HBS.UpstreamBlockStatement): ASTv1.BlockStatement | void {
    if (this.tokenizer.state === 'comment') {
      localAssert(block.loc, '[BUG] BlockStatement in parser unexpectedly did not have loc');
      this.appendToCommentData(this.sourceForNode(block as HBS.Node));
      return;
    }

    if (this.tokenizer.state !== 'data' && this.tokenizer.state !== 'beforeData') {
      throw generateSyntaxError(
        'A block may only be used inside an HTML element or another block.',
        this.source.spanFor(block.loc)
      );
    }

    const { path, params, hash } = acceptCallNodes(this, block);
    const loc = this.source.spanFor(block.loc);

    // Backfill block params loc for the default block
    let blockParams: ASTv1.VarHead[] = [];
    let repairedBlock: HBS.BlockStatement;

    if (block.program.blockParams?.length) {
      // Start from right after the hash
      let span = hash.loc.collapse('end');

      // Extend till the beginning of the block
      if (block.program.loc) {
        span = span.withEnd(this.source.spanFor(block.program.loc).getStart());
      } else if (block.program.body[0]) {
        span = span.withEnd(this.source.spanFor(block.program.body[0].loc).getStart());
      } else {
        // ...or if all else fail, use the end of the block statement
        // this can only happen if the block statement is empty anyway
        span = span.withEnd(loc.getEnd());
      }

      repairedBlock = repairBlock(this.source, block, span);

      // Now we have a span for something like this:
      //
      //   {{#foo bar baz=bat as |wow wat|}}
      //                     ~~~~~~~~~~~~~~~
      //
      // Or, if we are unlucky:
      //
      // {{#foo bar baz=bat as |wow wat|}}{{/foo}}
      //                   ~~~~~~~~~~~~~~~~~~~~~~~
      //
      // Either way, within this span, there should be exactly two pipes
      // fencing our block params, neatly whitespace separated and with
      // legal identifiers only
      const content = span.asString();
      let skipStart = content.indexOf('|') + 1;
      const limit = content.indexOf('|', skipStart);

      for (const name of block.program.blockParams) {
        let nameStart: number;
        let loc: SourceSpan;

        if (skipStart >= limit) {
          nameStart = -1;
        } else {
          nameStart = content.indexOf(name, skipStart);
        }

        if (nameStart === -1 || nameStart + name.length > limit) {
          skipStart = limit;
          loc = this.source.spanFor(NON_EXISTENT_LOCATION);
        } else {
          skipStart = nameStart;
          loc = span.sliceStartChars({ skipStart, chars: name.length });
          skipStart += name.length;
        }

        blockParams.push(b.var({ name, loc }));
      }
    } else {
      repairedBlock = repairBlock(this.source, block, loc);
    }

    const program = this.Program(repairedBlock.program, blockParams);
    const inverse = repairedBlock.inverse ? this.Program(repairedBlock.inverse, []) : null;

    const node = b.block({
      path,
      params,
      hash,
      defaultBlock: program,
      elseBlock: inverse,
      loc: this.source.spanFor(block.loc),
      openStrip: block.openStrip,
      inverseStrip: block.inverseStrip,
      closeStrip: block.closeStrip,
    });

    const parentProgram = this.currentElement();

    appendChild(parentProgram, node);
  }

  MustacheStatement(rawMustache: HBS.MustacheStatement): ASTv1.MustacheStatement | void {
    this.pendingError?.mustache(this.source.spanFor(rawMustache.loc));

    const { tokenizer } = this;

    if (tokenizer.state === 'comment') {
      this.appendToCommentData(this.sourceForNode(rawMustache));
      return;
    }

    let mustache: ASTv1.MustacheStatement;
    const { escaped, loc, strip } = rawMustache;

    if ('original' in rawMustache.path && rawMustache.path.original === '...attributes') {
      throw generateSyntaxError(
        'Illegal use of ...attributes',
        this.source.spanFor(rawMustache.loc)
      );
    }

    if (isHBSLiteral(rawMustache.path)) {
      mustache = b.mustache({
        path: this.acceptNode<(typeof rawMustache.path)['type']>(rawMustache.path),
        params: [],
        hash: b.hash({ pairs: [], loc: this.source.spanFor(rawMustache.path.loc).collapse('end') }),
        trusting: !escaped,
        loc: this.source.spanFor(loc),
        strip,
      });
    } else {
      const { path, params, hash } = acceptCallNodes(
        this,
        rawMustache as HBS.MustacheStatement & {
          path: HBS.PathExpression | HBS.SubExpression;
        }
      );
      mustache = b.mustache({
        path,
        params,
        hash,
        trusting: !escaped,
        loc: this.source.spanFor(loc),
        strip,
      });
    }

    switch (tokenizer.state) {
      // Tag helpers
      case 'tagOpen':
      case 'tagName':
        throw generateSyntaxError(`Cannot use mustaches in an elements tagname`, mustache.loc);

      case 'beforeAttributeName':
        addElementModifier(this.currentStartTag, mustache);
        break;
      case 'attributeName':
      case 'afterAttributeName':
        this.beginAttributeValue(false);
        this.finishAttributeValue();
        addElementModifier(this.currentStartTag, mustache);
        tokenizer.transitionTo(BEFORE_ATTRIBUTE_NAME);
        break;
      case 'afterAttributeValueQuoted':
        addElementModifier(this.currentStartTag, mustache);
        tokenizer.transitionTo(BEFORE_ATTRIBUTE_NAME);
        break;

      // Attribute values
      case 'beforeAttributeValue':
        this.beginAttributeValue(false);
        this.appendDynamicAttributeValuePart(mustache);
        tokenizer.transitionTo(ATTRIBUTE_VALUE_UNQUOTED);
        break;
      case 'attributeValueDoubleQuoted':
      case 'attributeValueSingleQuoted':
      case 'attributeValueUnquoted':
        this.appendDynamicAttributeValuePart(mustache);
        break;

      // TODO: Only append child when the tokenizer state makes
      // sense to do so, otherwise throw an error.
      default:
        appendChild(this.currentElement(), mustache);
    }

    return mustache;
  }

  appendDynamicAttributeValuePart(part: ASTv1.MustacheStatement): void {
    this.finalizeTextPart();
    const attr = this.currentAttr;
    attr.isDynamic = true;
    attr.parts.push(part);
  }

  finalizeTextPart(): void {
    const attr = this.currentAttr;
    const text = attr.currentPart;
    if (text !== null) {
      this.currentAttr.parts.push(text);
      this.startTextPart();
    }
  }

  startTextPart(): void {
    this.currentAttr.currentPart = null;
  }

  ContentStatement(content: HBS.ContentStatement): void {
    updateTokenizerLocation(this.tokenizer, content);

    this.tokenizer.tokenizePart(content.value);
    this.tokenizer.flushData();
  }

  CommentStatement(rawComment: HBS.CommentStatement): Nullable<ASTv1.MustacheCommentStatement> {
    const { tokenizer } = this;

    if (tokenizer.state === 'comment') {
      this.appendToCommentData(this.sourceForNode(rawComment));
      return null;
    }

    const { value, loc } = rawComment;
    const comment = b.mustacheComment({ value, loc: this.source.spanFor(loc) });

    switch (tokenizer.state) {
      case 'beforeAttributeName':
      case 'afterAttributeName':
        this.currentStartTag.comments.push(comment);
        break;

      case 'beforeData':
      case 'data':
        appendChild(this.currentElement(), comment);
        break;

      default:
        throw generateSyntaxError(
          `Using a Handlebars comment when in the \`${tokenizer['state']}\` state is not supported`,
          this.source.spanFor(rawComment.loc)
        );
    }

    return comment;
  }

  PartialStatement(partial: HBS.PartialStatement): never {
    throw generateSyntaxError(
      `Handlebars partials are not supported`,
      this.source.spanFor(partial.loc)
    );
  }

  PartialBlockStatement(partialBlock: HBS.PartialBlockStatement): never {
    throw generateSyntaxError(
      `Handlebars partial blocks are not supported`,
      this.source.spanFor(partialBlock.loc)
    );
  }

  Decorator(decorator: HBS.Decorator): never {
    throw generateSyntaxError(
      `Handlebars decorators are not supported`,
      this.source.spanFor(decorator.loc)
    );
  }

  DecoratorBlock(decoratorBlock: HBS.DecoratorBlock): never {
    throw generateSyntaxError(
      `Handlebars decorator blocks are not supported`,
      this.source.spanFor(decoratorBlock.loc)
    );
  }

  SubExpression(sexpr: HBS.SubExpression): ASTv1.SubExpression {
    const { path, params, hash } = acceptCallNodes(this, sexpr);
    return b.sexpr({ path, params, hash, loc: this.source.spanFor(sexpr.loc) });
  }

  PathExpression(path: HBS.PathExpression): ASTv1.PathExpression {
    const { original } = path;
    let parts: string[];

    if (original.indexOf('/') !== -1) {
      if (original.slice(0, 2) === './') {
        throw generateSyntaxError(
          `Using "./" is not supported in Glimmer and unnecessary`,
          this.source.spanFor(path.loc)
        );
      }
      if (original.slice(0, 3) === '../') {
        throw generateSyntaxError(
          `Changing context using "../" is not supported in Glimmer`,
          this.source.spanFor(path.loc)
        );
      }
      if (original.indexOf('.') !== -1) {
        throw generateSyntaxError(
          `Mixing '.' and '/' in paths is not supported in Glimmer; use only '.' to separate property paths`,
          this.source.spanFor(path.loc)
        );
      }
      parts = [path.parts.join('/')];
    } else if (original === '.') {
      throw generateSyntaxError(
        `'.' is not a supported path in Glimmer; check for a path with a trailing '.'`,
        this.source.spanFor(path.loc)
      );
    } else {
      parts = path.parts;
    }

    let thisHead = false;

    // This is to fix a bug in the Handlebars AST where the path expressions in
    // `{{this.foo}}` (and similarly `{{foo-bar this.foo named=this.foo}}` etc)
    // are simply turned into `{{foo}}`. The fix is to push it back onto the
    // parts array and let the runtime see the difference. However, we cannot
    // simply use the string `this` as it means literally the property called
    // "this" in the current context (it can be expressed in the syntax as
    // `{{[this]}}`, where the square bracket are generally for this kind of
    // escaping – such as `{{foo.["bar.baz"]}}` would mean lookup a property
    // named literally "bar.baz" on `this.foo`). By convention, we use `null`
    // for this purpose.
    if (/^this(?:\..+)?$/u.test(original)) {
      thisHead = true;
    }

    let pathHead: ASTv1.PathHead;
    if (thisHead) {
      pathHead = b.this({
        loc: this.source.spanFor({
          start: path.loc.start,
          end: { line: path.loc.start.line, column: path.loc.start.column + 4 },
        }),
      });
    } else if (path.data) {
      const head = parts.shift();

      if (head === undefined) {
        throw generateSyntaxError(
          `Attempted to parse a path expression, but it was not valid. Paths beginning with @ must start with a-z.`,
          this.source.spanFor(path.loc)
        );
      }

      pathHead = b.atName({
        name: `@${head}`,
        loc: this.source.spanFor({
          start: path.loc.start,
          end: { line: path.loc.start.line, column: path.loc.start.column + head.length + 1 },
        }),
      });
    } else {
      const head = parts.shift();

      if (head === undefined) {
        throw generateSyntaxError(
          `Attempted to parse a path expression, but it was not valid. Paths must start with a-z or A-Z.`,
          this.source.spanFor(path.loc)
        );
      }

      pathHead = b.var({
        name: head,
        loc: this.source.spanFor({
          start: path.loc.start,
          end: { line: path.loc.start.line, column: path.loc.start.column + head.length },
        }),
      });
    }

    return b.path({
      head: pathHead,
      tail: parts,
      loc: this.source.spanFor(path.loc),
    });
  }

  Hash(hash: HBS.Hash): ASTv1.Hash {
    const pairs = hash.pairs.map((pair) =>
      b.pair({
        key: pair.key,
        value: this.acceptNode<HBS.Expression['type']>(pair.value),
        loc: this.source.spanFor(pair.loc),
      })
    );

    return b.hash({ pairs, loc: this.source.spanFor(hash.loc) });
  }

  StringLiteral(string: HBS.StringLiteral): ASTv1.StringLiteral {
    return b.literal({
      type: 'StringLiteral',
      value: string.value,
      loc: this.source.spanFor(string.loc),
    });
  }

  BooleanLiteral(boolean: HBS.BooleanLiteral): ASTv1.BooleanLiteral {
    return b.literal({
      type: 'BooleanLiteral',
      value: boolean.value,
      loc: this.source.spanFor(boolean.loc),
    });
  }

  NumberLiteral(number: HBS.NumberLiteral): ASTv1.NumberLiteral {
    return b.literal({
      type: 'NumberLiteral',
      value: number.value,
      loc: this.source.spanFor(number.loc),
    });
  }

  UndefinedLiteral(undef: HBS.UndefinedLiteral): ASTv1.UndefinedLiteral {
    return b.literal({
      type: 'UndefinedLiteral',
      value: undefined,
      loc: this.source.spanFor(undef.loc),
    });
  }

  NullLiteral(nul: HBS.NullLiteral): ASTv1.NullLiteral {
    return b.literal({
      type: 'NullLiteral',
      value: null,
      loc: this.source.spanFor(nul.loc),
    });
  }
}

function calculateRightStrippedOffsets(original: string, value: string) {
  if (value === '') {
    // if it is empty, just return the count of newlines
    // in original
    return {
      lines: original.split('\n').length - 1,
      columns: 0,
    };
  }

  // otherwise, return the number of newlines prior to
  // `value`
  const [difference] = original.split(value) as [string];
  const lines = difference.split(/\n/u);
  const lineCount = lines.length - 1;

  return {
    lines: lineCount,
    columns: unwrap(lines[lineCount]).length,
  };
}

function updateTokenizerLocation(tokenizer: Parser['tokenizer'], content: HBS.ContentStatement) {
  let line = content.loc.start.line;
  let column = content.loc.start.column;

  const offsets = calculateRightStrippedOffsets(
    content.original as Recast<HBS.StripFlags, string>,
    content.value
  );

  line = line + offsets.lines;
  if (offsets.lines) {
    column = offsets.columns;
  } else {
    column = column + offsets.columns;
  }

  tokenizer.line = line;
  tokenizer.column = column;
}

function acceptCallNodes(
  compiler: HandlebarsNodeVisitors,
  node: {
    path:
      | HBS.PathExpression
      | HBS.SubExpression
      | HBS.StringLiteral
      | HBS.UndefinedLiteral
      | HBS.NullLiteral
      | HBS.NumberLiteral
      | HBS.BooleanLiteral;
    params: HBS.Expression[];
    hash?: HBS.Hash;
  }
): {
  path: ASTv1.PathExpression | ASTv1.SubExpression;
  params: ASTv1.Expression[];
  hash: ASTv1.Hash;
} {
  let path: ASTv1.PathExpression | ASTv1.SubExpression;

  switch (node.path.type) {
    case 'PathExpression':
      path = compiler.PathExpression(node.path);
      break;

    case 'SubExpression':
      path = compiler.SubExpression(node.path);
      break;

    case 'StringLiteral':
    case 'UndefinedLiteral':
    case 'NullLiteral':
    case 'NumberLiteral':
    case 'BooleanLiteral': {
      let value: string;
      if (node.path.type === 'BooleanLiteral') {
        value = node.path.original.toString();
      } else if (node.path.type === 'StringLiteral') {
        value = `"${node.path.original}"`;
      } else if (node.path.type === 'NullLiteral') {
        value = 'null';
      } else if (node.path.type === 'NumberLiteral') {
        value = node.path.value.toString();
      } else {
        value = 'undefined';
      }
      throw generateSyntaxError(
        `${node.path.type} "${
          node.path.type === 'StringLiteral' ? node.path.original : value
        }" cannot be called as a sub-expression, replace (${value}) with ${value}`,
        compiler.source.spanFor(node.path.loc)
      );
    }
  }

  const params = node.params.map((e) => compiler.acceptNode<HBS.Expression['type']>(e));

  // if there is no hash, position it as a collapsed node immediately after the last param (or the
  // path, if there are also no params)
  const end = isPresentArray(params) ? getLast(params).loc : path.loc;

  const hash = node.hash
    ? compiler.Hash(node.hash)
    : b.hash({
        pairs: [],
        loc: compiler.source.spanFor(end).collapse('end'),
      });

  return { path, params, hash };
}

function addElementModifier(
  element: ParserNodeBuilder<StartTag>,
  mustache: ASTv1.MustacheStatement
) {
  const { path, params, hash, loc } = mustache;

  if (isHBSLiteral(path)) {
    const modifier = `{{${printLiteral(path)}}}`;
    const tag = `<${element.name} ... ${modifier} ...`;

    throw generateSyntaxError(`In ${tag}, ${modifier} is not a valid modifier`, mustache.loc);
  }

  const modifier = b.elementModifier({ path, params, hash, loc });
  element.modifiers.push(modifier);
}

function repairBlock(
  source: src.Source,
  block: HBS.UpstreamBlockStatement,
  fallbackStart: SourceSpan
): HBS.BlockStatement {
  // Extend till the beginning of the block
  if (!block.program.loc) {
    const start = block.program.body.at(0);
    const end = block.program.body.at(-1);

    if (start && end) {
      block.program.loc = {
        ...start.loc,
        end: end.loc.end,
      };
    } else {
      const loc = source.spanFor(block.loc);
      block.program.loc = fallbackStart.withEnd(loc.getEnd());
    }
  }

  let endProgram = source.spanFor(block.program.loc).getEnd();

  if (block.inverse && !block.inverse.loc) {
    block.inverse.loc = endProgram.collapsed();
  }

  return block as HBS.BlockStatement;
}
