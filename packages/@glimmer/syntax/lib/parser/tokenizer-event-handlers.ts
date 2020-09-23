import { assertPresent, assign } from '@glimmer/util';
import * as handlebars from 'handlebars';
import { EntityParser } from 'simple-html-tokenizer';
import { GlimmerSyntaxError } from '../errors/syntax-error';
import print from '../generation/print';
import { voidMap } from '../generation/printer';
import { Tag } from '../parser';
import type { SourceOffset, SourceOffsetKind, SourceOffsets } from '../source/offsets/abstract';
import { concrete } from '../source/offsets/concrete';
import { Source } from '../source/source';
import traverse from '../traversal/traverse';
import { NodeVisitor } from '../traversal/visitor';
import Walker from '../traversal/walker';
import * as AST from '../types/api';
import * as HBS from '../types/handlebars-ast';
import { appendChild, parseElementBlockParams } from '../utils';
import { default as b } from '../v1/parser-builders';
import { default as v1Builders } from '../v1/public-builders';
import { HandlebarsNodeVisitors } from './handlebars-node-visitors';

export class TokenizerEventHandlers extends HandlebarsNodeVisitors {
  private tagOpenLine = 0;
  private tagOpenColumn = 0;

  reset() {
    this.currentNode = null;
  }

  // Comment

  beginComment() {
    this.currentNode = b.comment(
      '',
      this.source.offsetFor({ line: this.tagOpenLine, column: this.tagOpenColumn })
    );
  }

  appendToCommentData(char: string) {
    this.currentComment.value += char;
  }

  finishComment() {
    appendChild(this.currentElement(), this.finish(this.currentComment, this.pos(this.tokenizer)));
  }

  // Data

  beginData() {
    this.currentNode = b.text({
      chars: '',
      loc: this.offset().collapsed(),
    });
  }

  appendToData(char: string) {
    this.currentData.chars += char;
  }

  finishData() {
    this.currentData.loc = this.currentData.loc.withEnd(this.offset());

    appendChild(this.currentElement(), this.currentData);
  }

  // Tags - basic

  tagOpen() {
    this.tagOpenLine = this.tokenizer.line;
    this.tagOpenColumn = this.tokenizer.column;
  }

  beginStartTag() {
    this.currentNode = {
      type: 'StartTag',
      name: '',
      attributes: [],
      modifiers: [],
      comments: [],
      selfClosing: false,
      loc: this.source.offsetFor({ line: this.tagOpenLine, column: this.tagOpenColumn }),
    };
  }

  beginEndTag() {
    this.currentNode = {
      type: 'EndTag',
      name: '',
      attributes: [],
      modifiers: [],
      comments: [],
      selfClosing: false,
      loc: this.source.offsetFor({ line: this.tagOpenLine, column: this.tagOpenColumn }),
    };
  }

  finishTag() {
    let tag = this.finish(this.currentTag, this.offset());

    if (tag.type === 'StartTag') {
      this.finishStartTag();

      if (voidMap[tag.name] || tag.selfClosing) {
        this.finishEndTag(true);
      }
    } else if (tag.type === 'EndTag') {
      this.finishEndTag(false);
    }
  }

  finishStartTag() {
    let { name, attributes: attrs, modifiers, comments, selfClosing, loc } = this.finish(
      this.currentStartTag,
      this.offset()
    );

    let element = b.element({
      tag: name,
      selfClosing,
      attrs,
      modifiers,
      comments,
      children: [],
      blockParams: [],
      loc,
    });
    this.elementStack.push(element);
  }

  finishEndTag(isVoid: boolean) {
    let tag = this.finish(this.currentTag, this.offset());

    let element = this.elementStack.pop() as AST.ElementNode;
    let parent = this.currentElement();

    this.validateEndTag(tag, element, isVoid);

    element.loc = element.loc.withEnd(this.offset());
    parseElementBlockParams(element);
    appendChild(parent, element);
  }

  markTagAsSelfClosing() {
    this.currentTag.selfClosing = true;
  }

  // Tags - name

  appendToTagName(char: string) {
    this.currentTag.name += char;
  }

  // Tags - attributes

  beginAttribute() {
    let tag = this.currentTag;
    if (tag.type === 'EndTag') {
      throw new GlimmerSyntaxError(
        `Invalid end tag: closing tag must not have attributes, ` +
          `in \`${tag.name}\` (on line ${this.tokenizer.line}).`,
        { start: tag.loc.toJSON(), end: tag.loc.toJSON() }
      );
    }

    let offset = this.offset();

    this.currentAttribute = {
      name: '',
      parts: [],
      currentPart: null,
      isQuoted: false,
      isDynamic: false,
      start: offset,
      valueOffsets: offset.collapsed(),
    };
  }

  appendToAttributeName(char: string) {
    this.currentAttr.name += char;
  }

  beginAttributeValue(isQuoted: boolean) {
    this.currentAttr.isQuoted = isQuoted;
    this.startTextPart();
    this.currentAttr.valueOffsets = this.offset().collapsed();
  }

  appendToAttributeValue(char: string) {
    let parts = this.currentAttr.parts;
    let lastPart = parts[parts.length - 1];

    let current = this.currentAttr.currentPart;

    if (current) {
      current.chars += char;

      // update end location for each added char
      current.loc = current.loc.withEnd(this.offset());
    } else {
      // initially assume the text node is a single char
      let loc: SourceOffset = this.offset();

      // the tokenizer line/column have already been advanced, correct location info
      if (char === '\n') {
        loc = lastPart ? lastPart.loc.endOffset : this.currentAttr.valueOffsets.startOffset;
      } else {
        loc = loc.move(-1);
      }

      this.currentAttr.currentPart = b.text({ chars: char, loc: loc.collapsed() });
    }
  }

  finishAttributeValue() {
    this.finalizeTextPart();
    let { name, parts, start, isQuoted, isDynamic, valueOffsets } = this.currentAttr;
    let tokenizerPos = this.offset();
    let value = this.assembleAttributeValue(parts, isQuoted, isDynamic, valueOffsets);
    value.loc = valueOffsets.withEnd(tokenizerPos);

    let attribute = b.attr({ name, value, loc: start.withEnd(tokenizerPos) });

    this.currentStartTag.attributes.push(attribute);
  }

  reportSyntaxError(message: string) {
    throw new GlimmerSyntaxError(
      `Syntax error at line ${this.tokenizer.line} col ${this.tokenizer.column}: ${message}`,
      this.offset().collapsed()
    );
  }

  assembleConcatenatedValue(parts: (AST.MustacheStatement | AST.TextNode)[]) {
    for (let i = 0; i < parts.length; i++) {
      let part: AST.BaseNode = parts[i];

      if (part.type !== 'MustacheStatement' && part.type !== 'TextNode') {
        throw new GlimmerSyntaxError(
          'Unsupported node in quoted attribute value: ' + part['type'],
          part.loc
        );
      }
    }

    assertPresent(parts, `the concatenation parts of an element should not be empty`);

    let first = parts[0];
    let last = parts[parts.length - 1];

    return b.concat(
      parts,
      this.source.offsetsFor(first.loc).extend(this.source.offsetsFor(last.loc))
    );
  }

  validateEndTag(tag: Tag<'StartTag' | 'EndTag'>, element: AST.ElementNode, selfClosing: boolean) {
    let error;

    if (voidMap[tag.name] && !selfClosing) {
      // EngTag is also called by StartTag for void and self-closing tags (i.e.
      // <input> or <br />, so we need to check for that here. Otherwise, we would
      // throw an error for those cases.
      error = 'Invalid end tag ' + formatEndTagInfo(tag) + ' (void elements cannot have end tags).';
    } else if (element.tag === undefined) {
      error = 'Closing tag ' + formatEndTagInfo(tag) + ' without an open tag.';
    } else if (element.tag !== tag.name) {
      error =
        'Closing tag ' +
        formatEndTagInfo(tag) +
        ' did not match last open tag `' +
        element.tag +
        '` (on line ' +
        element.loc.start.line +
        ').';
    }

    if (error) {
      throw new GlimmerSyntaxError(error, element.loc);
    }
  }

  assembleAttributeValue(
    parts: (AST.MustacheStatement | AST.TextNode)[],
    isQuoted: boolean,
    isDynamic: boolean,
    offsets: SourceOffsets
  ) {
    if (isDynamic) {
      if (isQuoted) {
        return this.assembleConcatenatedValue(parts);
      } else {
        if (
          parts.length === 1 ||
          (parts.length === 2 &&
            parts[1].type === 'TextNode' &&
            (parts[1] as AST.TextNode).chars === '/')
        ) {
          return parts[0];
        } else {
          throw new GlimmerSyntaxError(
            `An unquoted attribute value must be a string or a mustache, ` +
              `preceeded by whitespace or a '=' character, and ` +
              `followed by whitespace, a '>' character, or '/>' (on line ${offsets.start.line})`,
            offsets
          );
        }
      }
    } else {
      return parts.length > 0 ? parts[0] : b.text({ chars: '', loc: offsets });
    }
  }
}

function formatEndTagInfo(tag: Tag<'StartTag' | 'EndTag'>) {
  return '`' + tag.name + '` (on line ' + tag.loc.end.line + ')';
}

/**
  ASTPlugins can make changes to the Glimmer template AST before
  compilation begins.
*/
export interface ASTPluginBuilder {
  (env: ASTPluginEnvironment): ASTPlugin;
}

export interface ASTPlugin {
  name: string;
  visitor: NodeVisitor;
}

export interface ASTPluginEnvironment {
  meta?: object;
  syntax: Syntax;
}

interface HandlebarsParseOptions {
  srcName?: string;
  ignoreStandalone?: boolean;
}

export interface PreprocessOptions {
  meta?: object;
  plugins?: {
    ast?: ASTPluginBuilder[];
  };
  parseOptions?: HandlebarsParseOptions;

  /**
    Useful for specifying a group of options together.

    When `'codemod'` we disable all whitespace control in handlebars
    (to preserve as much as possible) and we also avoid any
    escaping/unescaping of HTML entity codes.
   */
  mode?: 'codemod' | 'precompile';
}

export interface Syntax {
  parse: typeof preprocess;
  builders: typeof v1Builders;
  print: typeof print;
  traverse: typeof traverse;
  Walker: typeof Walker;
}

const syntax: Syntax = {
  parse: preprocess,
  builders: v1Builders,
  print,
  traverse,
  Walker,
};

export function preprocess(html: string, options: PreprocessOptions = {}): AST.Template {
  let mode = options.mode || 'precompile';

  let ast: HBS.Program;
  if (typeof html === 'object') {
    ast = html;
  } else if (mode === 'codemod') {
    ast = handlebars.parseWithoutProcessing(html, options.parseOptions) as HBS.Program;
  } else {
    ast = handlebars.parse(html, options.parseOptions) as HBS.Program;
  }

  let entityParser = undefined;
  if (mode === 'codemod') {
    entityParser = new EntityParser({});
  }

  let off = concrete(new Source(html), 0, html.length);
  ast.loc = {
    source: '(program)',
    start: off.start,
    end: off.end,
  };

  let program = new TokenizerEventHandlers(html, entityParser).acceptTemplate(ast);

  if (options && options.plugins && options.plugins.ast) {
    for (let i = 0, l = options.plugins.ast.length; i < l; i++) {
      let transform = options.plugins.ast[i];
      let env: ASTPluginEnvironment = assign({}, options, { syntax }, { plugins: undefined });

      let pluginResult = transform(env);

      traverse(program, pluginResult.visitor);
    }
  }

  return program;
}
