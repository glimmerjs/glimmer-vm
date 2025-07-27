import type { Nullable } from '@glimmer/interfaces';
import type { TokenizerState } from 'simple-html-tokenizer';
import {
  asPresentArray,
  assertPresentArray,
  getFirst,
  getLast,
  isPresentArray,
  localAssert,
} from '@glimmer/debug-util';
import { assign } from '@glimmer/util';
import { parse, parseWithoutProcessing } from '@handlebars/parser';
import { EntityParser } from 'simple-html-tokenizer';

import type { EndTag, StartTag } from '../parser';
import type { NodeVisitor } from '../traversal/visitor';
import type * as ASTv1 from '../v1/api';
import type * as HBS from '../v1/handlebars-ast';

import print from '../generation/print';
import { voidMap } from '../generation/printer';
import * as src from '../source/api';
import { generateSyntaxError, GlimmerSyntaxError } from '../syntax-error';
import traverse from '../traversal/traverse';
import Walker from '../traversal/walker';
import { appendChild, appendChildren } from '../utils';
import b from '../v1/parser-builders';
import publicBuilder from '../v1/public-builders';
import { HandlebarsNodeVisitors } from './handlebars-node-visitors';

// vendored from simple-html-tokenizer because it's unexported
function isSpace(char: string): boolean {
  return /[\t\n\f ]/u.test(char);
}

export class TokenizerEventHandlers extends HandlebarsNodeVisitors {
  private tagOpenLine = 0;
  private tagOpenColumn = 0;

  reset(): void {
    this.currentNode = null;
  }

  // Comment

  beginComment(): void {
    this.currentNode = {
      type: 'CommentStatement',
      value: '',
      start: this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn),
    };
  }

  appendToCommentData(char: string): void {
    this.currentComment.value += char;
  }

  finishComment(): void {
    this.#append(this.currentComment, (comment) => b.comment(this.finish(comment)));
  }

  #append<N extends { errors?: ASTv1.AttachedErrors<string> }>(
    node: N,
    build: (node: N) => ASTv1.Statement
  ): void {
    if (node.errors) {
      for (const errors of Object.values(node.errors)) {
        if (errors) appendChildren(this.currentElement(), ...errors);
      }
    } else {
      appendChild(this.currentElement(), build(node));
    }
  }

  // Data

  beginData(): void {
    this.currentNode = {
      type: 'TextNode',
      chars: '',
      start: this.offset(),
    };
  }

  appendToData(char: string): void {
    this.currentData.chars += char;
  }

  finishData(): void {
    this.#append(this.currentData, (text) => b.text(this.finish(text)));
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
      nameStart: null,
      nameEnd: null,
      paramsStart: null,
      paramsEnd: null,
      attributes: [],
      modifiers: [],
      comments: [],
      params: [],
      selfClosing: false,
      start: this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn),
    };
  }

  beginEndTag(): void {
    this.currentNode = {
      type: 'EndTag',
      name: '',
      start: this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn),
    };
  }

  finishTag(): void {
    let tag = this.finish<StartTag | EndTag>(this.currentTag);

    if (tag.type === 'StartTag') {
      this.finishStartTag();

      if (tag.name === ':') {
        throw generateSyntaxError(
          'Invalid named block named detected, you may have created a named block without a name, or you may have began your name with a number. Named blocks must have names that are at least one character long, and begin with a lower case letter',
          this.currentTag.start.until(this.offset()).highlight('block name')
        );
      }

      if (voidMap.has(tag.name) || tag.selfClosing) {
        this.finishEndTag(true);
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- exhaustive
      localAssert(tag.type === 'EndTag', `Invalid tag type ${tag.type}`);
      this.finishEndTag(false);
    }
  }

  finishStartTag(): void {
    let { name, nameStart, nameEnd, errors } = this.currentStartTag;

    // <> should probably be a syntax error, but s-h-t is currently broken for that case
    localAssert(name !== '', 'tag name cannot be empty');
    localAssert(nameStart !== null, 'nameStart unexpectedly null');
    localAssert(nameEnd !== null, 'nameEnd unexpectedly null');

    let nameLoc = nameStart.until(nameEnd);
    let [head, ...tail] = asPresentArray(name.split('.'));
    let path = b.path({
      head: b.head({ original: head, loc: nameLoc.sliceStartChars({ chars: head.length }) }),
      tail,
      loc: nameLoc,
    });

    let { attributes, modifiers, comments, params, paramsStart, paramsEnd, selfClosing, loc } =
      this.finish(this.currentStartTag);

    const paramsLoc =
      paramsStart && paramsEnd ? paramsStart.until(paramsEnd) : loc.getEnd().move(-1).collapsed();

    let element = b.element({
      path,
      selfClosing,
      attributes,
      modifiers,
      comments,
      params,
      paramsLoc,
      children: [],
      openTag: loc,
      closeTag: selfClosing ? null : src.SourceSpan.broken(),
      errors,
      loc,
    });
    this.elementStack.push(element);
  }

  finishEndTag(isVoid: boolean): void {
    let { start: closeTagStart, errors } = this.currentTag;
    let tag = this.finish<StartTag | EndTag>(this.currentTag);

    let element = this.elementStack.pop() as ASTv1.ParentNode;

    this.validateEndTag(tag, element, isVoid);
    let parent = this.currentElement();

    if (isVoid) {
      element.closeTag = null;
    } else if (element.selfClosing) {
      localAssert(element.closeTag === null, 'element.closeTag unexpectedly present');
    } else {
      element.closeTag = closeTagStart.until(this.offset());
    }

    element.loc = element.loc.withEnd(this.offset());
    if (errors && Object.keys(errors).length > 0) {
      element.errors = { ...element.errors, ...errors };
    }

    appendChild(parent, element);
  }

  markTagAsSelfClosing(): void {
    let tag = this.currentTag;

    if (tag.type === 'StartTag') {
      tag.selfClosing = true;
    } else {
      throw generateSyntaxError(
        `Invalid end tag: closing tag must not be self-closing`,
        tag.start.until(this.offset()).highlight('closing tag')
      );
    }
  }

  // Tags - name

  appendToTagName(char: string): void {
    let tag = this.currentTag;
    tag.name += char;

    if (tag.type === 'StartTag') {
      let offset = this.offset();

      if (tag.nameStart === null) {
        localAssert(tag.nameEnd === null, 'nameStart and nameEnd must both be null');

        // Note that the tokenizer already consumed the token here
        tag.nameStart = offset.move(-1);
      }

      tag.nameEnd = offset;
    }
  }

  // Tags - attributes

  beginAttribute(): void {
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

    // The block params parsing code can actually handle peek=non-space just
    // fine, but this check was added as an optimization, as there is a little
    // bit of setup overhead for the parsing logic just to immediately bail
    if (this.currentAttr.name === 'as') {
      this.parsePossibleBlockParams(this.currentAttr.start);
      this.currentStartTag.paramsEnd = this.offset();
    }
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
      let loc: src.SourceOffset = this.offset();

      // the tokenizer line/column have already been advanced, correct location info
      if (char === '\n') {
        loc = lastPart ? lastPart.loc.getEnd() : this.currentAttr.valueSpan.getStart();
      } else {
        loc = loc.move(-1);
      }

      this.currentAttr.currentPart = b.text({ chars: char, loc: loc.collapsed() });
    }
  }

  finishAttributeValue(): void {
    this.finalizeTextPart();

    let tag = this.currentTag;
    let tokenizerPos = this.offset();
    let { name, parts, start, isQuoted, isDynamic, valueSpan } = this.currentAttr;
    const attrLoc = start.until(tokenizerPos);

    if (tag.type === 'EndTag') {
      throw GlimmerSyntaxError.highlight(
        `Invalid end tag: closing tag must not have attributes`,
        attrLoc.highlight('invalid attribute')
      );
    }

    // Just trying to be helpful with `<Hello |foo|>` rather than letting it through as an attribute
    if (name.startsWith('|') && parts.length === 0 && !isQuoted && !isDynamic) {
      this.currentStartTag.params.push(
        b.error(
          'Invalid block parameters syntax: block parameters must be preceded by the `as` keyword',
          attrLoc
            .highlight()
            .withPrimary(start.until(start.move(name.length)).highlight('missing `as`'))
        )
      );
      this.currentStartTag.paramsEnd = tokenizerPos;
      return;
    }

    let value = this.assembleAttributeValue(
      parts,
      isQuoted,
      isDynamic,
      valueSpan.withEnd(tokenizerPos),
      start.until(tokenizerPos)
    );
    value.loc = valueSpan.withEnd(tokenizerPos);

    let attribute = b.attr({ name, value, loc: start.until(tokenizerPos) });

    this.currentStartTag.attributes.push(attribute);

    if (this.pending?.attrName) {
      this.currentStartTag.params.push(this.pending.attrName(start.next(name.length)));
      this.currentStartTag.paramsEnd = tokenizerPos;
      this.pending = null;
    }
  }

  private parsePossibleBlockParams(asNode: src.SourceOffset) {
    // const enums that we can't use directly
    const BEFORE_ATTRIBUTE_NAME = 'beforeAttributeName' as TokenizerState.beforeAttributeName;
    const ATTRIBUTE_NAME = 'attributeName' as TokenizerState.attributeName;
    const AFTER_ATTRIBUTE_NAME = 'afterAttributeName' as TokenizerState.afterAttributeName;

    // Regex to validate the identifier for block parameters.
    // Based on the ID validation regex in Handlebars.

    const ID_INVERSE_PATTERN = /[!"#%&'()*+./;<=>@[\\\]^`{|}~]/u;

    const ParseError = (next: string, after: (offset: src.SourceOffset) => ASTv1.ErrorNode) => {
      if (next !== '' && next !== '/' && next !== '>' && !isSpace(next)) {
        // Slurp up the next "token" for the error span
        this.tokenizer.consume();
      }

      const error = after(this.offset());
      element.params.push(error);
      return error;
    };

    type States = {
      PossibleAs: { state: 'PossibleAs' };
      BeforeStartPipe: { state: 'BeforeStartPipe' };
      BeforeBlockParamName: { state: 'BeforeBlockParamName'; offset: src.SourceOffset };
      BlockParamName: {
        state: 'BlockParamName';
        name: string;
        start: src.SourceOffset;
      };
      AfterEndPipe: { state: 'AfterEndPipe' };
      ParseError: {
        state: 'ParseError';
        error: ASTv1.ErrorNode;
      };
      Done: { state: 'Done' };
    };

    type State = States[keyof States];

    type Handler = (next: string) => void;

    localAssert(this.tokenizer.state === ATTRIBUTE_NAME, 'must be in TokenizerState.attributeName');

    const element = this.currentStartTag;
    const as = this.currentAttr;

    let state = { state: 'PossibleAs' } as State;
    element.paramsStart = as.start;

    const handlers = {
      PossibleAs: (next: string) => {
        localAssert(state.state === 'PossibleAs', 'bug in block params parser');

        if (isSpace(next)) {
          // " as ..."
          state = { state: 'BeforeStartPipe' };
          this.tokenizer.transitionTo(AFTER_ATTRIBUTE_NAME);
          this.tokenizer.consume();
        } else if (next === '|') {
          // " as|..."
          // Following Handlebars and require a space between "as" and the pipe
          state = { state: 'Done' };
          this.pending = {
            attrName: (attrName) =>
              b.error(
                `Invalid block parameters syntax: expecting at least one space character between "as" and "|"`,
                attrName
                  .highlight()
                  .withPrimary({ loc: asNode.move(1).next(2), label: 'missing space' })
              ),
          };
        } else {
          // " as{{...", " async...", " as=...", " as>...", " as/>..."
          // Don't consume, let the normal tokenizer code handle the next steps
          state = { state: 'Done' };
        }
      },

      BeforeStartPipe: (next: string) => {
        localAssert(state.state === 'BeforeStartPipe', 'bug in block params parser');

        if (isSpace(next)) {
          this.tokenizer.consume();
        } else if (next === '|') {
          state = { state: 'BeforeBlockParamName', offset: this.offset() };
          this.tokenizer.transitionTo(BEFORE_ATTRIBUTE_NAME);
          this.tokenizer.consume();
        } else {
          // " as {{...", " as bs...", " as =...", " as ...", " as/>..."
          // Don't consume, let the normal tokenizer code handle the next steps
          state = { state: 'Done' };
        }
      },

      BeforeBlockParamName: (next: string) => {
        localAssert(state.state === 'BeforeBlockParamName', 'bug in block params parser');

        if (isSpace(next)) {
          this.tokenizer.consume();
        } else if (next === '') {
          // The HTML tokenizer ran out of characters, so we are either
          // encountering mustache or <EOF>
          state = { state: 'Done' };
          this.pending = {
            mustache(mustache: src.SourceSpan, next: string) {
              return ParseError(next, (end) => {
                return b.error(
                  `Invalid block parameters syntax: mustaches cannot be used inside block params`,
                  as.start
                    .until(end)
                    .highlight()
                    .withPrimary(mustache.highlight('invalid mustache'))
                );
              });
            },
            eof: (loc: src.SourceOffset) => {
              return ParseError(next, () =>
                b.error(
                  `Invalid block parameters syntax: template ended before block params were closed`,
                  as.start
                    .until(loc)
                    .highlight('block params')
                    .withPrimary({ loc: loc.last(1), label: 'end of template' })
                )
              );
            },
          };
        } else if (next === '|') {
          if (element.params.length === 0) {
            // Following Handlebars and treat empty block params a syntax error
            const end = this.offset().move(1);
            state = {
              state: 'ParseError',
              error: b.error(
                `Invalid block parameters syntax: empty block params, expecting at least one identifier`,
                asNode
                  .until(end)
                  .highlight()
                  .withPrimary(state.offset.until(end).highlight('empty block params'))
              ),
            };
            this.tokenizer.consume();
          } else {
            state = { state: 'AfterEndPipe' };
            this.tokenizer.consume();
          }
        } else if (next === '>' || next === '/') {
          throw GlimmerSyntaxError.highlight(
            `Invalid block parameters syntax: incomplete block params, expecting "|" but the tag was closed prematurely`,
            element.start
              .until(this.offset())
              .highlight()
              .withPrimary(
                as.start.until(this.offset().move(1)).highlight('incomplete block params')
              )
          );
        } else {
          // slurp up anything else into the name, validate later
          state = {
            state: 'BlockParamName',
            name: next,
            start: this.offset(),
          };
          this.tokenizer.consume();
        }
      },

      BlockParamName: (next: string) => {
        localAssert(state.state === 'BlockParamName', 'bug in block params parser');

        if (next === '') {
          // The HTML tokenizer ran out of characters, so we are either
          // encountering mustache or <EOF>, HBS side will attach the error
          // to the next span
          state = { state: 'Done' };
          this.pending = {
            mustache: (mustache: src.SourceSpan, next: string) => {
              return ParseError(next, (end) =>
                b.error(
                  `Invalid block parameters syntax: mustaches cannot be used inside block params`,
                  as.start
                    .until(end)
                    .highlight()
                    .withPrimary(mustache.highlight('invalid mustache'))
                )
              );
            },
            eof: (loc: src.SourceOffset) => {
              return ParseError(next, () =>
                b.error(
                  `Invalid block parameters syntax: template ended before block params were closed`,
                  as.start
                    .until(loc)
                    .highlight('block params')
                    .withPrimary({ loc: loc.last(1), label: 'end of template' })
                )
              );
            },
          };
        } else if (next === '|' || isSpace(next)) {
          let loc = state.start.until(this.offset());

          if (state.name === 'this' || ID_INVERSE_PATTERN.test(state.name)) {
            this.tokenizer.consume();
            state = {
              state: 'ParseError',
              error: b.error(
                `Invalid block parameters syntax: invalid identifier name \`${state.name}\``,
                asNode
                  .until(this.offset())
                  .highlight('block params')
                  .withPrimary(loc.highlight('invalid identifier'))
              ),
            };
          } else {
            element.params.push(b.var({ name: state.name, loc }));
            state =
              next === '|'
                ? { state: 'AfterEndPipe' }
                : { state: 'BeforeBlockParamName', offset: this.offset() };
            this.tokenizer.consume();
          }
        } else if (next === '>' || next === '/') {
          const here = this.offset();
          const end = here.move(1);

          throw GlimmerSyntaxError.highlight(
            `Invalid block parameters syntax: expecting "|" but the tag was closed prematurely`,
            {
              full: element.start.until(end),
              primary: here.until(end).highlight('unexpected closing tag'),
              expanded: as.start.until(end).highlight('block params'),
            }
          );
        } else {
          // slurp up anything else into the name, validate later
          state.name += next;
          this.tokenizer.consume();
        }
      },

      AfterEndPipe: (next: string) => {
        localAssert(state.state === 'AfterEndPipe', 'bug in block params parser');

        if (isSpace(next)) {
          this.tokenizer.consume();
        } else if (next === '') {
          // The HTML tokenizer ran out of characters, so we are either
          // encountering mustache or <EOF>, HBS side will attach the error
          // to the next span
          state = { state: 'Done' };
          this.pending = {
            mustache: (loc: src.SourceSpan) => {
              throw GlimmerSyntaxError.highlight(
                `Invalid block parameters syntax: modifiers cannot follow block params`,
                loc.highlight('invalid modifier').expand(element.paramsStart?.until(this.offset()))
              );
            },
            eof: (loc: src.SourceOffset) => {
              return ParseError(next, () =>
                b.error(
                  `Template unexpectedly ended before tag was closed`,
                  loc.last(1).highlight('end of template')
                )
              );
            },
          };
        } else if (next === '>' || next === '/') {
          // Don't consume, let the normal tokenizer code handle the next steps
          state = { state: 'Done' };
        } else {
          state = { state: 'Done' };
          // Slurp up the next "token" for the error span
          this.pending = {
            attrName: (nameSpan) =>
              b.error(
                'Invalid attribute after block params',
                asNode
                  .until(nameSpan.getEnd())
                  .highlight('block params')
                  .withPrimary(nameSpan.highlight('invalid attribute'))
              ),
          };
        }
      },

      ParseError: () => {
        localAssert(state.state === 'ParseError', 'bug in block params parser');
        element.params.push(state.error);
      },

      Done: () => {
        localAssert(false, 'This should never be called');
      },
    } as const satisfies {
      [S in keyof States]: Handler;
    };

    let next: string;

    do {
      if (state.state === 'ParseError') {
        element.params.push(state.error);
        return;
      }

      next = this.tokenizer.peek();

      handlers[state.state](next);
    } while (state.state !== 'Done' && next !== '');

    localAssert(state.state === 'Done', 'bug in block params parser');
  }

  reportSyntaxError(message: string): void {
    const error = b.error(message, this.offset().next(1).highlight('invalid character'));
    if (this.currentNode) {
      addError(this.currentNode, error);
    } else {
      this.error = error;
    }
  }

  assembleConcatenatedValue(
    parts: (ASTv1.MustacheStatement | ASTv1.TextNode)[]
  ): ASTv1.ConcatStatement {
    assertPresentArray(parts, `the concatenation parts of an element should not be empty`);

    let first = getFirst(parts);
    let last = getLast(parts);

    return b.concat({
      parts,
      loc: this.source.spanFor(first.loc).extend(this.source.spanFor(last.loc)),
    });
  }

  validateEndTag(
    tag: StartTag | EndTag,
    element: ASTv1.ParentNode,
    selfClosing: boolean
  ): asserts element is ASTv1.ElementNode {
    if (voidMap.has(tag.name) && !selfClosing) {
      // EngTag is also called by StartTag for void and self-closing tags (i.e.
      // <input> or <br />, so we need to check for that here. Otherwise, we would
      // throw an error for those cases.
      throw generateSyntaxError(
        `<${tag.name}> elements do not need end tags. You should remove it`,
        tag.loc.highlight('void element')
      );
    } else if (element.type !== 'ElementNode') {
      throw generateSyntaxError(
        `Closing tag </${tag.name}> without an open tag`,
        tag.loc.highlight('closing tag')
      );
    } else if (element.tag !== tag.name) {
      throw generateSyntaxError(
        `Closing tag </${tag.name}> did not match last open tag <${element.tag}> (on line ${element.loc.startPosition.line})`,
        tag.loc.highlight('closing tag')
      );
    }
  }

  assembleAttributeValue(
    parts: ASTv1.AttrPart[],
    isQuoted: boolean,
    isDynamic: boolean,
    valueSpan: src.SourceSpan,
    span: src.SourceSpan
  ): ASTv1.AttrValue {
    if (isDynamic) {
      if (isQuoted) {
        return this.assembleConcatenatedValue(parts);
      } else {
        assertPresentArray(parts);

        const [head, a] = parts;
        if (a === undefined || (a.type === 'TextNode' && a.chars === '/')) {
          return head;
        } else {
          throw GlimmerSyntaxError.highlight(
            `Invalid dynamic value in an unquoted attribute`,
            valueSpan.lastSelectedLine
              .highlight('missing quotes')
              .withPrimary(
                (head.type === 'MustacheStatement' ? head : a).loc.highlight(
                  'invalid dynamic value'
                )
              )
          );
        }
      }
    } else if (isPresentArray(parts)) {
      return parts[0];
    } else {
      return b.text({ chars: '', loc: span });
    }
  }
}

/**
  ASTPlugins can make changes to the Glimmer template AST before
  compilation begins.
*/
export interface ASTPluginBuilder<TEnv extends ASTPluginEnvironment = ASTPluginEnvironment> {
  (env: TEnv): ASTPlugin;
}

export interface ASTPlugin {
  name: string;
  visitor: NodeVisitor;
}

export interface ASTPluginEnvironment {
  meta?: object | undefined;
  syntax: Syntax;
}

interface HandlebarsParseOptions {
  srcName?: string;
  ignoreStandalone?: boolean;
}

export interface TemplateIdFn {
  (src: string): Nullable<string>;
}

export interface PrecompileOptions extends PreprocessOptions {
  id?: TemplateIdFn;

  /**
   * Additional non-native keywords.
   *
   * Local variables (block params or lexical scope) always takes precedence,
   * but otherwise, suitable free variable candidates (e.g. those are not part
   * of a path) are matched against this list and turned into keywords.
   *
   * In strict mode compilation, keywords suppresses the undefined reference
   * error and will be resolved by the runtime environment.
   *
   * In loose mode, keywords are currently ignored and since all free variables
   * are already resolved by the runtime environment.
   */
  keywords?: readonly string[];

  /**
   * In loose mode, this hook allows embedding environments to customize the name of an
   * angle-bracket component. In practice, this means that `<HelloWorld />` in Ember is
   * compiled by Glimmer as an invocation of a component named `hello-world`.
   *
   * It's a little weird that this is needed in addition to the resolver, but it's a
   * classic-only feature and it seems fine to leave it alone for classic consumers.
   */
  customizeComponentName?: ((input: string) => string) | undefined;
}

export interface PrecompileOptionsWithLexicalScope extends PrecompileOptions {
  lexicalScope: (variable: string) => boolean;

  /**
   * If `emit.debugSymbols` is set to `true`, the name of lexical local variables
   * will be included in the wire format.
   */
  emit?:
    | {
        debugSymbols?: boolean;
      }
    | undefined;
}

export interface PreprocessOptions {
  strictMode?: boolean | undefined;
  locals?: string[] | undefined;
  meta?:
    | {
        moduleName?: string | undefined;
      }
    | undefined;
  plugins?:
    | {
        ast?: ASTPluginBuilder[] | undefined;
      }
    | undefined;
  parseOptions?: HandlebarsParseOptions | undefined;
  customizeComponentName?: ((input: string) => string) | undefined;

  /**
    Useful for specifying a group of options together.

    When `'codemod'` we disable all whitespace control in handlebars
    (to preserve as much as possible) and we also avoid any
    escaping/unescaping of HTML entity codes.
   */
  mode?: 'codemod' | 'precompile' | undefined;
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

class CodemodEntityParser extends EntityParser {
  // match upstream types, but never match an entity
  constructor() {
    super({});
  }

  override parse(): string | undefined {
    return undefined;
  }
}

export function preprocess(
  input: string | src.Source | HBS.Program,
  options: PreprocessOptions = {}
): ASTv1.Template {
  let mode = options.mode || 'precompile';

  let source: src.Source;
  let ast: HBS.Program;
  if (typeof input === 'string') {
    source = new src.Source(input, options.meta?.moduleName);

    if (mode === 'codemod') {
      ast = parseWithoutProcessing(input, options.parseOptions) as HBS.Program;
    } else {
      ast = parse(input, options.parseOptions) as HBS.Program;
    }
  } else if (input instanceof src.Source) {
    source = input;

    if (mode === 'codemod') {
      ast = parseWithoutProcessing(input.source, options.parseOptions) as HBS.Program;
    } else {
      ast = parse(input.source, options.parseOptions) as HBS.Program;
    }
  } else {
    source = new src.Source('', options.meta?.moduleName);
    ast = input;
  }

  let entityParser = undefined;
  if (mode === 'codemod') {
    entityParser = new CodemodEntityParser();
  }

  let offsets = src.SourceSpan.forCharPositions(source, 0, source.source.length);
  ast.loc = {
    source: '(program)',
    start: offsets.startPosition,
    end: offsets.endPosition,
  };

  let template = new TokenizerEventHandlers(source, entityParser, mode).parse(
    ast,
    options.locals ?? []
  );

  if (options.plugins?.ast) {
    for (const transform of options.plugins.ast) {
      let env: ASTPluginEnvironment = assign({}, options, { syntax }, { plugins: undefined });

      let pluginResult = transform(env);

      traverse(template, pluginResult.visitor);
    }
  }

  return template;
}

function addError<T extends { errors?: ASTv1.TokenizerErrors }>(node: T, error: ASTv1.ErrorNode) {
  node.errors ??= {};
  const errors = (node.errors.tokenizer ??= []);
  errors.push(error);
}
