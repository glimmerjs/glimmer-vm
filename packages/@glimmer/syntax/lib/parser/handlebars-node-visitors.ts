import b from '../builders';
import { appendChild, isLiteral, printLiteral } from '../utils';
import * as AST from '../types/nodes';
import * as HBS from '../types/handlebars-ast';
import { Parser, Tag, Attribute } from '../parser';
import SyntaxError from '../errors/syntax-error';
import { Option } from '@glimmer/util';
import { TokenizerState } from 'simple-html-tokenizer';
import { locForSpan, Location } from '../hbs/pos';

export abstract class HandlebarsNodeVisitors extends Parser {
  abstract appendToCommentData(s: string): void;
  abstract beginAttributeValue(quoted: boolean): void;
  abstract finishAttributeValue(): void;

  cursorCount = 0;

  cursor() {
    return `%cursor:${this.cursorCount++}%`;
  }

  private get isTopLevel() {
    return this.elementStack.length === 0;
  }

  private loc(span: HBS.Span): Location {
    return locForSpan(this.source, span);
  }

  private locString(span: HBS.Span): string {
    let loc = this.loc(span);

    return `L${loc.start.line}:C${loc.start.column}`;
  }

  Program(program: HBS.Program): AST.Block;
  Program(program: HBS.Program): AST.Template;
  Program(program: HBS.Program): AST.Template | AST.Block;
  Program(program: HBS.Program): AST.Block | AST.Template {
    let body: AST.Statement[] = [];
    this.cursorCount = 0;

    let node;

    if (this.isTopLevel) {
      node = b.template(body, program.blockParams, this.loc(program.span));
    } else {
      node = b.blockItself(body, program.blockParams, this.loc(program.span));
    }

    let i,
      l = program.body.length;

    this.elementStack.push(node);

    if (l === 0) {
      return this.elementStack.pop() as AST.Block | AST.Template;
    }

    for (i = 0; i < l; i++) {
      this.acceptNode(program.body[i]);
    }

    // Ensure that that the element stack is balanced properly.
    let poppedNode = this.elementStack.pop();
    if (poppedNode !== node) {
      let elementNode = poppedNode as AST.ElementNode;

      throw new SyntaxError(
        'Unclosed element `' + elementNode.tag + '` (on line ' + elementNode.loc!.start.line + ').',
        elementNode.loc
      );
    }

    return node;
  }

  BlockStatement(block: HBS.BlockStatement): AST.BlockStatement | void {
    if (this.tokenizer['state'] === 'comment') {
      this.appendToCommentData(this.sourceForNode(block));
      return;
    }

    if (
      this.tokenizer['state'] !== 'comment' &&
      this.tokenizer['state'] !== 'data' &&
      this.tokenizer['state'] !== 'beforeData'
    ) {
      throw new SyntaxError(
        'A block may only be used inside an HTML element or another block.',
        locForSpan(this.source, block.span)
      );
    }

    let { call, params, hash } = acceptCallNodes(this, block);
    let program = this.Program(block.program);
    let inverse = block.inverse ? this.Program(block.inverse) : null;

    if (isSimple(call, 'in-element')) {
      hash = addInElementHash(this.cursor(), hash, this.loc(block.span));
    }

    let node = b.block(call, params, hash, program, inverse, this.loc(block.span));

    let parentProgram = this.currentElement();

    appendChild(parentProgram, node);
  }

  MustacheContent(rawMustache: HBS.MustacheContent): AST.MustacheStatement | void {
    let { tokenizer } = this;

    if (tokenizer.state === 'comment') {
      this.appendToCommentData(this.sourceForNode(rawMustache));
      return;
    }

    let mustache: AST.MustacheStatement;
    let { trusted, span } = rawMustache;

    if (isLiteral(rawMustache.value)) {
      mustache = {
        type: 'MustacheStatement',
        call: this.expression(rawMustache.value),
        params: [],
        hash: b.hash(),
        trusted,
        loc: locForSpan(this.source, span),
        span,
      };
    } else {
      let call = this.expression(rawMustache.value);
      mustache = b.mustache(call, undefined, undefined, rawMustache.trusted);
    }

    switch (tokenizer.state) {
      // Tag helpers
      case TokenizerState.tagOpen:
      case TokenizerState.tagName: {
        let loc = this.loc(rawMustache.value.span);
        throw new SyntaxError(
          `Cannot use mustaches in an elements tagname: \`${this.source.slice(
            rawMustache.value.span.start,
            rawMustache.value.span.end
          )}\` at L${loc.start.line}:C${loc.start.column}`,
          mustache.loc
        );
      }

      case TokenizerState.beforeAttributeName:
        addElementModifier(this.currentStartTag, mustache, this.source);
        break;
      case TokenizerState.attributeName:
      case TokenizerState.afterAttributeName:
        this.beginAttributeValue(false);
        this.finishAttributeValue();
        addElementModifier(this.currentStartTag, mustache, this.source);
        tokenizer.transitionTo(TokenizerState.beforeAttributeName);
        break;
      case TokenizerState.afterAttributeValueQuoted:
        addElementModifier(this.currentStartTag, mustache, this.source);
        tokenizer.transitionTo(TokenizerState.beforeAttributeName);
        break;

      // Attribute values
      case TokenizerState.beforeAttributeValue:
        this.beginAttributeValue(false);
        appendDynamicAttributeValuePart(this.currentAttribute!, mustache);
        tokenizer.transitionTo(TokenizerState.attributeValueUnquoted);
        break;
      case TokenizerState.attributeValueDoubleQuoted:
      case TokenizerState.attributeValueSingleQuoted:
      case TokenizerState.attributeValueUnquoted:
        appendDynamicAttributeValuePart(this.currentAttribute!, mustache);
        break;

      // TODO: Only append child when the tokenizer state makes
      // sense to do so, otherwise throw an error.
      default:
        appendChild(this.currentElement(), mustache);
    }

    return mustache;
  }

  MustacheStatement(rawMustache: HBS.MustacheStatement): AST.MustacheStatement | void {
    let { tokenizer } = this;

    if (tokenizer.state === 'comment') {
      this.appendToCommentData(this.sourceForNode(rawMustache));
      return;
    }

    let mustache: AST.MustacheStatement;
    let { trusted, span } = rawMustache;

    if (isLiteral(rawMustache.call)) {
      mustache = {
        type: 'MustacheStatement',
        call: this.acceptNode<AST.Literal>(rawMustache.call),
        params: [],
        hash: b.hash(),
        trusted,
        loc: this.loc(span),
        span,
      };
    } else {
      let { call, params, hash } = acceptCallNodes(this, rawMustache as HBS.MustacheStatement & {
        path: HBS.PathExpression;
      });
      mustache = b.mustache(call, params, hash, trusted, this.loc(span));
    }

    switch (tokenizer.state) {
      // Tag helpers
      case TokenizerState.tagOpen:
      case TokenizerState.tagName:
        throw new SyntaxError(
          `Cannot use mustaches in an elements tagname: \`${this.sourceForNode(
            rawMustache
          )}\` at ${this.locString(rawMustache.span)}`,
          mustache.loc
        );

      case TokenizerState.beforeAttributeName:
        addElementModifier(this.currentStartTag, mustache, this.source);
        break;
      case TokenizerState.attributeName:
      case TokenizerState.afterAttributeName:
        this.beginAttributeValue(false);
        this.finishAttributeValue();
        addElementModifier(this.currentStartTag, mustache, this.source);
        tokenizer.transitionTo(TokenizerState.beforeAttributeName);
        break;
      case TokenizerState.afterAttributeValueQuoted:
        addElementModifier(this.currentStartTag, mustache, this.source);
        tokenizer.transitionTo(TokenizerState.beforeAttributeName);
        break;

      // Attribute values
      case TokenizerState.beforeAttributeValue:
        this.beginAttributeValue(false);
        appendDynamicAttributeValuePart(this.currentAttribute!, mustache);
        tokenizer.transitionTo(TokenizerState.attributeValueUnquoted);
        break;
      case TokenizerState.attributeValueDoubleQuoted:
      case TokenizerState.attributeValueSingleQuoted:
      case TokenizerState.attributeValueUnquoted:
        appendDynamicAttributeValuePart(this.currentAttribute!, mustache);
        break;

      // TODO: Only append child when the tokenizer state makes
      // sense to do so, otherwise throw an error.
      default:
        appendChild(this.currentElement(), mustache);
    }

    return mustache;
  }

  ContentStatement(content: HBS.ContentStatement): void {
    // updateTokenizerLocation(this.tokenizer, content);

    this.tokenizer.tokenizePart(content.value);
    this.tokenizer.flushData();
  }

  CommentStatement(rawComment: HBS.CommentStatement): Option<AST.MustacheCommentStatement> {
    let { tokenizer } = this;

    if (tokenizer.state === TokenizerState.comment) {
      this.appendToCommentData(this.sourceForNode(rawComment));
      return null;
    }

    let { value, span } = rawComment;
    let comment = b.mustacheComment(value, this.loc(span));

    switch (tokenizer.state) {
      case TokenizerState.beforeAttributeName:
        this.currentStartTag.comments.push(comment);
        break;

      case TokenizerState.beforeData:
      case TokenizerState.data:
        appendChild(this.currentElement(), comment);
        break;

      default:
        throw new SyntaxError(
          `Using a Handlebars comment when in the \`${
            tokenizer['state']
          }\` state is not supported: "${comment.value}" on ${this.locString(rawComment.span)}`,
          this.loc(rawComment.span)
        );
    }

    return comment;
  }

  SubExpression(sexpr: HBS.SubExpression): AST.SubExpression {
    let { call, params, hash } = acceptCallNodes(this, sexpr);
    return b.sexpr(sexpr.span, call, params, hash, this.loc(sexpr.span));
  }

  expression(input: HBS.Expression): AST.Expression {
    switch (input.type) {
      case 'PathExpression':
        return this.PathExpression(input);

      case 'BooleanLiteral':
        return this.BooleanLiteral(input);

      case 'NullLiteral':
        return this.NullLiteral(input);

      case 'UndefinedLiteral':
        return this.UndefinedLiteral(input);

      case 'NumberLiteral':
        return this.NumberLiteral(input);

      case 'StringLiteral':
        return this.StringLiteral(input);

      case 'PathExpression':
        return this.PathExpression(input);

      case 'SubExpression':
        return this.SubExpression(input);
    }
  }

  PathExpression(path: HBS.PathExpression): AST.PathExpression {
    let { span } = path;

    return {
      type: 'PathExpression',
      span,
      loc: locForSpan(this.source, span),
      head: this.head(path.head),
      tail: path.tail
        ? path.tail.map(
            s =>
              ({
                type: 'PathSegment',
                loc: locForSpan(this.source, s.span),
                name: s.name,
              } as AST.PathSegment)
          )
        : null,
    };
  }

  head(head: HBS.Head): AST.Head {
    switch (head.type) {
      case 'ArgReference':
        return {
          type: head.type,
          span: head.span,
          loc: locForSpan(this.source, head.span),
          name: head.name,
        };
      case 'LocalReference':
        return {
          type: head.type,
          span: head.span,
          loc: locForSpan(this.source, head.span),
          name: head.name,
        };
      case 'This':
        return {
          type: 'This',
          span: head.span,
          loc: locForSpan(this.source, head.span),
        };
    }
  }

  Hash(hash: HBS.Hash): AST.Hash {
    let pairs: AST.HashPair[] = [];

    for (let i = 0; i < hash.pairs.length; i++) {
      let pair = hash.pairs[i];
      pairs.push(b.pair(pair.key, this.acceptNode(pair.value), this.loc(pair.span)));
    }

    return b.hash(pairs, this.loc(hash.span));
  }

  StringLiteral(string: HBS.StringLiteral): AST.StringLiteral {
    return b.literal('StringLiteral', string.value, this.loc(string.span));
  }

  BooleanLiteral(boolean: HBS.BooleanLiteral): AST.BooleanLiteral {
    return b.literal('BooleanLiteral', boolean.value, this.loc(boolean.span));
  }

  NumberLiteral(number: HBS.NumberLiteral): AST.NumberLiteral {
    return b.literal('NumberLiteral', number.value, this.loc(number.span));
  }

  UndefinedLiteral(undef: HBS.UndefinedLiteral): AST.UndefinedLiteral {
    return b.literal('UndefinedLiteral', undefined, this.loc(undef.span));
  }

  NullLiteral(nul: HBS.NullLiteral): AST.NullLiteral {
    return b.literal('NullLiteral', null, this.loc(nul.span));
  }
}

function acceptCallNodes(
  compiler: HandlebarsNodeVisitors,
  node: HBS.MustacheBody
): { call: AST.Expression; params: AST.Expression[]; hash: AST.Hash } {
  let call = compiler.expression(node.call);

  let params = node.params ? node.params.map(e => compiler.acceptNode<AST.Expression>(e)) : [];
  let hash = node.hash ? compiler.Hash(node.hash) : b.hash();

  return { call, params, hash };
}

function addElementModifier(
  element: Tag<'StartTag'>,
  mustache: AST.MustacheStatement,
  source: string
) {
  let { call, params, hash, loc } = mustache;

  if (isLiteral(call)) {
    let modifier = `{{${printLiteral(call)}}}`;
    let tag = `<${element.name} ... ${modifier} ...`;

    throw new SyntaxError(
      `In ${tag}, ${modifier} is not a valid modifier: "${source.slice(
        call.span.start,
        call.span.end
      )}" on line ${loc && loc.start.line}.`,
      mustache.loc
    );
  }

  let modifier = b.elementModifier(call, params, hash, loc);
  element.modifiers.push(modifier);
}

function addInElementHash(cursor: string, hash: AST.Hash, loc: AST.SourceLocation) {
  let hasNextSibling = false;
  hash.pairs.forEach(pair => {
    if (pair.key === 'guid') {
      throw new SyntaxError('Cannot pass `guid` from user space', loc);
    }

    if (pair.key === 'nextSibling') {
      hasNextSibling = true;
    }
  });

  let guid = b.literal('StringLiteral', cursor);
  let guidPair = b.pair('guid', guid);
  hash.pairs.unshift(guidPair);

  if (!hasNextSibling) {
    let nullLiteral = b.literal('NullLiteral', null);
    let nextSibling = b.pair('nextSibling', nullLiteral);
    hash.pairs.push(nextSibling);
  }

  return hash;
}

function appendDynamicAttributeValuePart(attribute: Attribute, part: AST.MustacheStatement) {
  attribute.isDynamic = true;
  attribute.parts.push(part);
}

export function isSimple(path: AST.Expression, name: string): boolean {
  return (
    path.type === 'PathExpression' && path.head.type === 'LocalReference' && path.head.name === name
  );
}
