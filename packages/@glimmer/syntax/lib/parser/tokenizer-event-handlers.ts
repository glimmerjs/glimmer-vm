import { Option } from '@glimmer/interfaces';
import { assertPresent, assign } from '@glimmer/util';
import { parse, parseWithoutProcessing } from '@handlebars/parser';
import { EntityParser } from 'simple-html-tokenizer';

import {
  appendChild,
  ASTv1,
  b as publicBuilder,
  charSpan,
  GlimmerSyntaxError,
  HBS,
  NodeVisitor,
  parseElementBlockParams,
  Source,
  SourceOffset,
  SourceSpan,
  strictBuilder as b,
  Tag,
  traverse,
  voidMap,
  Walker,
} from '../-internal';
import { HandlebarsNodeVisitors } from './-internal';

export class TokenizerEventHandlers extends HandlebarsNodeVisitors {
  private tagOpenLine = 0;
  private tagOpenColumn = 0;

  reset(): void {
    this.currentNode = null;
  }

  // Comment

  beginComment(): void {
    this.currentNode = b.comment(
      '',
      this.source.offsetFor({ line: this.tagOpenLine, column: this.tagOpenColumn })
    );
  }

  appendToCommentData(char: string): void {
    this.currentComment.value += char;
  }

  finishComment(): void {
    appendChild(this.currentElement(), this.finish(this.currentComment));
  }

  // Data

  beginData(): void {
    this.currentNode = b.text({
      chars: '',
      loc: this.offset().collapsed(),
    });
  }

  appendToData(char: string): void {
    this.currentData.chars += char;
  }

  finishData(): void {
    this.currentData.loc = this.currentData.loc.withEnd(this.offset());

    appendChild(this.currentElement(), this.currentData);
  }

  // Tags - basic

  tagOpen(): void {
    this.tagOpenLine = this.tokenizer.line;
    this.tagOpenColumn = this.tokenizer.column;
  }

  beginStartTag(): void {
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

  beginEndTag(): void {
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

  finishTag(): void {
    let tag = this.finish(this.currentTag);

    if (tag.type === 'StartTag') {
      this.finishStartTag();

      if (voidMap[tag.name] || tag.selfClosing) {
        this.finishEndTag(true);
      }
    } else if (tag.type === 'EndTag') {
      this.finishEndTag(false);
    }
  }

  finishStartTag(): void {
    let { name, attributes: attrs, modifiers, comments, selfClosing, loc } = this.finish(
      this.currentStartTag
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

  finishEndTag(isVoid: boolean): void {
    let tag = this.finish(this.currentTag);

    let element = this.elementStack.pop() as ASTv1.ElementNode;
    let parent = this.currentElement();

    this.validateEndTag(tag, element, isVoid);

    element.loc = element.loc.withEnd(this.offset());
    parseElementBlockParams(element);
    appendChild(parent, element);
  }

  markTagAsSelfClosing(): void {
    this.currentTag.selfClosing = true;
  }

  // Tags - name

  appendToTagName(char: string): void {
    this.currentTag.name += char;
  }

  // Tags - attributes

  beginAttribute(): void {
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
      valueSpan: offset.collapsed(),
    };
  }

  appendToAttributeName(char: string): void {
    this.currentAttr.name += char;
  }

  beginAttributeValue(isQuoted: boolean): void {
    this.currentAttr.isQuoted = isQuoted;
    this.startTextPart();
    this.currentAttr.valueSpan = this.offset().collapsed();
  }

  appendToAttributeValue(char: string): void {
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
        loc = lastPart ? lastPart.loc.endOffset : this.currentAttr.valueSpan.startOffset;
      } else {
        loc = loc.move(-1);
      }

      this.currentAttr.currentPart = b.text({ chars: char, loc: loc.collapsed() });
    }
  }

  finishAttributeValue(): void {
    this.finalizeTextPart();
    let { name, parts, start, isQuoted, isDynamic, valueSpan } = this.currentAttr;
    let tokenizerPos = this.offset();
    let value = this.assembleAttributeValue(parts, isQuoted, isDynamic, valueSpan);
    value.loc = valueSpan.withEnd(tokenizerPos);

    let attribute = b.attr({ name, value, loc: start.withEnd(tokenizerPos) });

    this.currentStartTag.attributes.push(attribute);
  }

  reportSyntaxError(message: string): void {
    throw new GlimmerSyntaxError(
      `Syntax error at line ${this.tokenizer.line} col ${this.tokenizer.column}: ${message}`,
      this.offset().collapsed()
    );
  }

  assembleConcatenatedValue(
    parts: (ASTv1.MustacheStatement | ASTv1.TextNode)[]
  ): ASTv1.ConcatStatement {
    for (let i = 0; i < parts.length; i++) {
      let part: ASTv1.BaseNode = parts[i];

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

    return b.concat(parts, this.source.spanFor(first.loc).extend(this.source.spanFor(last.loc)));
  }

  validateEndTag(
    tag: Tag<'StartTag' | 'EndTag'>,
    element: ASTv1.ElementNode,
    selfClosing: boolean
  ): void {
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
        element.loc.startPosition.line +
        ').';
    }

    if (error) {
      throw new GlimmerSyntaxError(error, element.loc);
    }
  }

  assembleAttributeValue(
    parts: (ASTv1.MustacheStatement | ASTv1.TextNode)[],
    isQuoted: boolean,
    isDynamic: boolean,
    span: SourceSpan
  ): ASTv1.ConcatStatement | ASTv1.MustacheStatement | ASTv1.TextNode {
    if (isDynamic) {
      if (isQuoted) {
        return this.assembleConcatenatedValue(parts);
      } else {
        if (
          parts.length === 1 ||
          (parts.length === 2 &&
            parts[1].type === 'TextNode' &&
            (parts[1] as ASTv1.TextNode).chars === '/')
        ) {
          return parts[0];
        } else {
          throw new GlimmerSyntaxError(
            `An unquoted attribute value must be a string or a mustache, ` +
              `preceded by whitespace or a '=' character, and ` +
              `followed by whitespace, a '>' character, or '/>' (on line ${span.startPosition.line})`,
            span
          );
        }
      }
    } else {
      return parts.length > 0 ? parts[0] : b.text({ chars: '', loc: span });
    }
  }
}

function formatEndTagInfo(tag: Tag<'StartTag' | 'EndTag'>): string {
  return '`' + tag.name + '` (on line ' + tag.loc.endPosition.line + ')';
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

export interface TemplateIdFn {
  (src: string): Option<string>;
}

export interface PrecompileOptions extends PreprocessOptions {
  id?: TemplateIdFn;
  meta?: object;
  customizeComponentName?(input: string): string;
}

export interface PreprocessOptions {
  meta?: object;
  plugins?: {
    ast?: ASTPluginBuilder[];
  };
  parseOptions?: HandlebarsParseOptions;
  customizeComponentName?(input: string): string;

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
  builders: typeof publicBuilder;
  print: typeof print;
  traverse: typeof traverse;
  Walker: typeof Walker;
}

const syntax: Syntax = {
  parse: preprocess,
  builders: publicBuilder,
  print,
  traverse,
  Walker,
};

export function preprocess(html: string, options: PreprocessOptions = {}): ASTv1.Template {
  let mode = options.mode || 'precompile';

  let ast: HBS.Program;
  if (typeof html === 'object') {
    ast = html;
  } else if (mode === 'codemod') {
    ast = parseWithoutProcessing(html, options.parseOptions) as HBS.Program;
  } else {
    ast = parse(html, options.parseOptions) as HBS.Program;
  }

  let entityParser = undefined;
  if (mode === 'codemod') {
    entityParser = new EntityParser({});
  }

  let off = charSpan(new Source(html), 0, html.length);
  ast.loc = {
    source: '(program)',
    start: off.startPosition,
    end: off.endPosition,
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
