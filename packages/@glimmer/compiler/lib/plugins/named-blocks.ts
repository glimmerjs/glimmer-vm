import { AST, ASTPlugin, NodeVisitor, Syntax, traverse } from '@glimmer/syntax';

export default function NamedBlocksPluginBuilder(): ASTPlugin {
  return new NamedBlocksPlugin();
}

const ELSE_BLOCK_ISSUE_URL =
  'http://github.com/ember-polyfills/ember-named-blocks-polyfill/issues/1';

interface SimplePathExpression extends AST.PathExpression {
  data: false;
  this: false;
  parts: [string];
}

type HasBlockParams = AST.Node & { blockParams: string[] };

type NodeCallback<T> = (node: T) => T | void;

class NamedBlocksPlugin implements ASTPlugin {
  private scope = new LexicalScope();

  private skipList: WeakSet<AST.Node> = new WeakSet();

  private get builders(): Syntax['builders'] {
    throw new Error(`nope`);
  }

  private EnterTemplate(node: AST.Template): void {
    assert(this.scope.isRoot, 'Invalid nesting: not in root scope');

    // BUG?
    check(
      node.blockParams.length === 0,
      `Template cannot have block params, found ${node.blockParams.join(',')}`,
      node
    );
  }

  private ExitTemplate(node: AST.Template): void {
    assert(this.scope.isRoot, 'Invalid nesting: not in root scope');

    // BUG?
    check(
      node.blockParams.length === 0,
      `Template cannot have block params, found ${node.blockParams.join(',')}`,
      node
    );
  }

  private EnterBlock(node: AST.Block): void {
    this.scope.push(node);
  }

  private ExitBlock(node: AST.Block): void {
    let actual = this.scope.pop();

    assert(
      JSON.stringify(node) === JSON.stringify(actual),
      () => `Invalid nesting: expecting block ${JSON.stringify(node)} got ${JSON.stringify(actual)}`
    );
  }

  private EnterElementNode(node: AST.ElementNode): AST.ElementNode | void {
    // Are these really syntax errors, or are they just bugs?
    if (node.selfClosing) {
      check(
        node.blockParams.length === 0,
        `Self closing tag <${node.tag} /> cannot have block params`,
        node
      );

      check(
        node.children.length === 0,
        `Self closing tag <${node.tag} /> cannot have children`,
        node
      );

      return;
    }

    check(!isNamedBlock(node), `Unexpected named block <${node.tag}>`, node);

    let isComponent = this.isComponent(node);
    let namedBlocks = this.namedBlocksFor(node);

    if (isComponent && namedBlocks.length > 0) {
      check(
        node.blockParams.length === 0,
        `Unexpected block params list on <${node.tag}> component invocation: ` +
          `when passing named blocks, the invocation tag cannot take block params`,
        node.loc
      );

      return this.transformNamedBlocks(node, namedBlocks);
    } else if (isComponent) {
      this.scope.push(node);
    } else {
      check(
        node.blockParams.length === 0,
        `Unexpected block params on <${node.tag}> HTML element`,
        node
      );

      check(
        namedBlocks.length === 0,
        () => `Unexpected named block <${namedBlocks[0].tag}> inside <${node.tag}> HTML element`,
        namedBlocks[0]
      );
    }
  }

  private ExitElementNode(node: AST.ElementNode): void {
    if (!node.selfClosing && this.isComponent(node, true)) {
      let actual = this.scope.pop();

      assert(
        JSON.stringify(node) === JSON.stringify(actual),
        `Invalid nesting: expecting component invocation ${JSON.stringify(
          node
        )} got ${JSON.stringify(actual)}`
      );
    }
  }

  private MustacheStatement(node: AST.MustacheStatement): AST.MustacheStatement | void {
    if (isPath(node.path)) {
      switch (node.path.original) {
        case 'yield':
          return this.transformYield(node);
        case 'hasBlock':
        case 'has-block':
          return this.transformHasBlock(node);
        case 'hasBlockParams':
        case 'has-block-params':
          return this.transformHasBlock(node, true);
      }
    }
  }

  private SubExpression(node: AST.SubExpression): AST.SubExpression | void {
    if (isPath(node.path)) {
      switch (node.path.original) {
        case 'hasBlock':
        case 'has-block':
          return this.transformHasBlock(node);
        case 'hasBlockParams':
        case 'has-block-params':
          return this.transformHasBlock(node, true);
      }
    }
  }

  /**
   * Checks if a `PathExpression` is a simple path.
   */
  private isSimplePath(node: AST.PathExpression): node is SimplePathExpression {
    let { parts } = node;

    if (node.data || node.this || this.scope.isLocal(parts[0]) || parts.length > 1) {
      return false;
    } else {
      check(
        node.original === parts[0],
        `Invalid path: expecting \`${node.original}\`, got \`${parts[0]}\``,
        node
      );

      return true;
    }
  }

  /**
   * Check if an `ElementNode` is a component invocation.
   */
  private isComponent(node: AST.ElementNode, ignoreTop = false): boolean {
    let [head, ...rest] = node.tag.split('.');

    return (
      rest.length > 0 ||
      head.startsWith('@') ||
      /^[A-Z]/.test(head) ||
      this.scope.isLocal(head, ignoreTop)
    );
  }

  /**
   * Return the named blocks for an `ElementNode`, if any.
   */
  private namedBlocksFor(node: AST.ElementNode): AST.ElementNode[] {
    let names: string[] = [];
    let namedBlocks: AST.ElementNode[] = [];
    let nonNamedBlocks: AST.Statement[] = [];

    for (let statement of node.children) {
      if (isComment(statement) || (isTextNode(statement) && isWhitespace(statement))) {
        continue;
      } else if (isElementNode(statement) && isNamedBlock(statement)) {
        check(
          nonNamedBlocks.length === 0,
          `Unexpected content inside <${node.tag}> component invocation: ` +
            'when using named blocks, the tag cannot contain other content',
          nonNamedBlocks[0]
        );

        let name = statement.tag.slice(1);

        check(
          names.indexOf(name) === -1,
          `Cannot pass named block <${name}> twice in the same invocation`,
          statement
        );

        if (name === 'else') {
          check(
            names.indexOf('inverse') === -1,
            `Cannot pass named blocks <:else> and <:inverse> in the same invocation`,
            statement
          );

          // TODO
          check(
            false,
            `Cannot pass named block <:else>, this is not currently supported by ` +
              `ember-named-blocks-polyfill, see: ${ELSE_BLOCK_ISSUE_URL}`,
            statement
          );

          // name = 'inverse';
          // statement.tag = ':inverse';
        } else if (name === 'inverse') {
          // TODO
          check(
            false,
            `Cannot pass named block <:inverse>, this is not currently supported by ` +
              `ember-named-blocks-polyfill, see: ${ELSE_BLOCK_ISSUE_URL}`,
            statement
          );
        }

        names.push(name);
        namedBlocks.push(statement as AST.ElementNode);
      } else {
        check(
          namedBlocks.length === 0,
          `Unexpected content inside <${node.tag}> component invocation: ` +
            `when using named blocks, the tag cannot contain other content`,
          statement
        );

        nonNamedBlocks.push(statement as AST.ElementNode);
      }
    }

    return namedBlocks;
  }

  /**
   * Transform:
   *
   * ```hbs
   * <MyComponent @some="args">
   *   <:default as |foo|>
   *     {{!-- default block --}}
   *   </:default>
   *   <:another as |bar baz|>
   *     {{!-- another block --}}
   *   </:another>
   *   <:yetAnother>
   *     {{!-- yet another block --}}
   *   </:yetAnother>
   * </MyComponent>
   * ```
   *
   * Into:
   *
   * ```hbs
   * <MyComponent @some="args" @namedBlocksInfo={{hash default=1 another=2 yetAnother=0}} as |__arg0 __arg1 __arg2|>
   *   {{#if (-is-named-block-invocation __arg0 "default")}}
   *     {{#let __arg0 as |foo|}}
   *       {{!-- default block --}}
   *     {{/let}}
   *   {{else if (-is-named-block-invocation __arg0 "another")}}
   *     {{#let __arg1 __arg2 as |bar baz|}}
   *       {{!-- another block --}}
   *     {{/let}}
   *   {{else if (-is-named-block-invocation __arg0 "yetAnother")}}
   *     {{!-- yet another block --}}
   *   {{/if}}
   * </MyComponent>
   * ```
   */
  private transformNamedBlocks(
    node: AST.ElementNode,
    namedBlocks: AST.ElementNode[]
  ): AST.ElementNode {
    let b = this.builders;

    if (namedBlocks.length === 1 && namedBlocks[0].tag === ':default') {
      return b.element(
        node.tag,
        node.attributes,
        node.modifiers,
        namedBlocks[0].children,
        undefined,
        namedBlocks[0].blockParams,
        node.loc
      );
    }

    let metadata = b.attr(
      '@namedBlocksInfo',
      b.mustache(
        b.path('hash'),
        [],
        b.hash(
          namedBlocks.map(block => b.pair(block.tag.slice(1), b.number(block.blockParams.length)))
        )
      )
    );

    let blocks = this.chainBlocks(namedBlocks.map(block => this.transformNamedBlock(block)));

    let numBlockParams = Math.max(
      ...namedBlocks.map(block => {
        if (block.tag === ':default') {
          return block.blockParams.length;
        } else {
          return block.blockParams.length + 1;
        }
      })
    );

    let blockParams = [];

    for (let i = 0; i < numBlockParams; i++) {
      blockParams.push(`__arg${i}`);
    }

    return b.element(
      node.tag,
      [...node.attributes, metadata],
      node.modifiers,
      [blocks],
      undefined,
      blockParams,
      node.loc
    );
  }

  /**
   * Transform:
   *
   * ```hbs
   * <:default as |foo|>
   *   {{!-- default block --}}
   * </:default>
   * ```
   *
   * Into:
   *
   * ```hbs
   * {{#if (-is-named-block-invocation __arg0 "default")}}
   *   {{#let __arg0 as |foo|}}
   *     {{!-- default block --}}
   *   {{/let}}
   * {{/if}}
   * ```
   *
   * And:
   *
   * ```hbs
   * <:another as |bar baz|>
   *   {{!-- another block --}}
   * </:another>
   * ```
   *
   * Into:
   *
   * ```hbs
   * {{#if (-is-named-block-invocation __arg0 "another")}}
   *   {{#let __arg1 __arg2 as |bar baz|}}
   *     {{!-- another block --}}
   *   {{/let}}
   * {{/if}}
   * ```
   */
  private transformNamedBlock({
    tag,
    children,
    blockParams,
    loc,
  }: AST.ElementNode): AST.BlockStatement {
    let b = this.builders;
    let name = tag.slice(1);

    let block = b.blockItself(children, blockParams, false, loc);

    if (blockParams.length > 0) {
      // Wrap in {{#let}}
      let params = blockParams.map((_, i) => {
        if (name === 'default') {
          return b.path(`__arg${i}`);
        } else {
          return b.path(`__arg${i + 1}`);
        }
      });

      block = b.blockItself(
        [b.block(b.path('let'), params, null, block, null, loc)],
        [],
        false,
        loc
      );
    }

    let params = [
      b.sexpr(b.path('-is-named-block-invocation'), [b.path('__arg0'), b.string(name)]),
    ];

    return b.block(b.path('if'), params, null, block, null, loc);
  }

  /**
   * Transforms:
   *
   * ```hbs
   * {{yield this.foo to="bar"}}
   * ```
   *
   * Into:
   *
   * ```hbs
   * {{yield (-named-block-invocation "bar") this.foo}}
   * ```
   *
   * @private
   * @param {MustacheStatement} node
   * @returns {MustacheStatement | void}
   */
  private transformYield(node: AST.MustacheStatement): AST.MustacheStatement | void {
    let b = this.builders;
    let { path, params, hash, escaped, loc } = node;

    check(
      isPath(path) && this.isSimplePath(path),
      `Invalid {{yield}} invocation: expecting a simple path`,
      loc
    );

    if (hash.pairs.length === 0) {
      return;
    }

    check(
      hash.pairs.length === 1 && hash.pairs[0].key === 'to',
      () => `Cannot pass ${hash.pairs[0].key} named argument to {{yield}}`,
      loc
    );

    let to = hash.pairs[0].value;

    check(
      isStringLiteral(to),
      '{{yield}} can only accept a string literal for the `to` argument',
      to
    );

    if (to.value === 'default') {
      hash = b.hash();
    } else if (to.value === 'else' || to.value === 'inverse') {
      hash = b.hash([b.pair('to', b.string('inverse'))], hash.loc);
    } else {
      let invocation = b.sexpr(b.path('-named-block-invocation'), [to], undefined, to.loc);

      params = [invocation, ...params];
      hash = b.hash();
    }

    return b.mustache(path, params, hash, !escaped, loc);
  }

  /**
   * Transforms:
   *
   * ```hbs
   * {{has-block "foo"}}
   * ```
   *
   * Into:
   *
   * ```hbs
   * {{-has-block @namedBlocksInfo "foo"}}
   * ```
   *
   * And:
   *
   * ```hbs
   * {{has-block-params "foo"}}
   * ```
   *
   * Into:
   *
   * ```hbs
   * {{-has-block-params @namedBlocksInfo "foo"}}
   * ```
   */
  private transformHasBlock<T extends AST.MustacheStatement | AST.SubExpression>(
    node: T,
    hasBlockParams = false
  ): T | void {
    let b = this.builders;
    let { path, params, hash, loc } = node;

    let display = isMustache(node) ? `{{${node.path.original}}}` : `(${node.path.original})`;

    check(
      isPath(path) && this.isSimplePath(path),
      `Invalid ${display} invocation: expecting a simple path`,
      loc
    );

    check(
      hash.pairs.length === 0,
      () => `Cannot pass ${hash.pairs[0].key} named argument to ${display}`,
      loc
    );

    /**
     * @type {string}
     */
    let block;

    if (params.length === 0) {
      block = 'default';
    } else {
      check(params.length === 1, `${display} only takes a single argument`, params[1]);

      check(
        isStringLiteral(params[0]),
        `${display} can only accept a string literal argument`,
        params[0]
      );

      block = params[0].value;
    }

    if (block === 'else') {
      block = 'inverse';
    }

    /**
     * @type {SubExpression | Literal}
     */
    let fallback;

    if (block === 'default') {
      // Avoid visiting this node again and trigger an infinite loop
      fallback = this.skip(b.sexpr(path, undefined, undefined, loc));
    } else if (block === 'inverse') {
      // Avoid visiting this node again and trigger an infinite loop
      fallback = this.skip(b.sexpr(path, [b.string('inverse')], undefined, loc));
    } else {
      fallback = b.boolean(false);
    }

    path = hasBlockParams ? b.path('-has-block-params', path.loc) : b.path('-has-block', path.loc);
    params = [b.path('@namedBlocksInfo'), b.string(block), fallback];

    if (isMustache(node)) {
      // @ts-ignore
      return b.mustache(path, params, undefined, !node.escaped, loc);
    } else {
      // @ts-ignore
      return b.sexpr(path, params, undefined, loc);
    }
  }

  /**
   * Chain an array of `{{#if ...}}...{{/if}}` blocks into
   * `{{#if ...}}...{{else if ...}}...{{/if}}`.
   *
   * @param {BlockStatement[]} blocks
   * @returns {BlockStatement}
   */
  private chainBlocks(blocks: AST.BlockStatement[]): AST.BlockStatement {
    let b = this.builders;

    blocks.reduce((parent, block) => {
      assert(!parent.inverse, 'Parent block already has an inverse block');

      assert(
        this.isSimplePath(block.path) && block.path.original == 'if',
        `Expecting {{#if}}, got {{#${block.path.original}}}`
      );

      parent.inverse = b.blockItself([block], [], true, block.loc);

      return block;
    });

    return blocks[0];
  }

  /**
   * Add a node to the skip list so don't visit it again.
   */
  private skip<T extends AST.Node>(node: T): T {
    traverse(node, {
      All: node => {
        this.skipList.add(node);
      },
    });

    return node;
  }

  /**
   * Guard the callback with the skip list, also binds it to this.
   */
  private guard<T extends AST.Node>(callback: NodeCallback<T>): NodeCallback<T> {
    return node => {
      if (!this.skipList.has(node)) {
        return callback.call(this, node);
      }
    };
  }

  get name(): string {
    return 'named-blocks';
  }

  get visitor(): NodeVisitor {
    return {
      Template: {
        enter: this.guard(this.EnterTemplate),
        exit: this.guard(this.ExitTemplate),
      },
      Block: {
        enter: this.guard(this.EnterBlock),
        exit: this.guard(this.ExitBlock),
      },
      ElementNode: {
        enter: this.guard(this.EnterElementNode),
        exit: this.guard(this.ExitElementNode),
      },
      MustacheStatement: this.guard(this.MustacheStatement),
      SubExpression: this.guard(this.SubExpression),
    };
  }
}

class LexicalScope {
  private stack: Array<HasBlockParams> = [];

  /**
   * Checks if _name_ is a local variable.
   *
   * @param name An identifier.
   * @param ignoreTop Whether to ignore the current block.
   * @returns Whether _name_ is a local variable.
   */
  isLocal(name: string, ignoreTop = false): boolean {
    let { stack } = this;

    if (ignoreTop) {
      stack = stack.slice(0, -1);
    }

    return stack.some(b => b.blockParams.indexOf(name) !== -1);
  }

  get depth(): number {
    return this.stack.length;
  }

  /**
   * Check if we are currently at the root scope.
   */
  get isRoot(): boolean {
    return this.depth === 0;
  }

  /**
   * Push a new level of lexical scope.
   */
  push(block: HasBlockParams): void {
    assert(block && Array.isArray(block.blockParams), 'not a block');
    this.stack.push(block);
  }

  /**
   * Pops the top most level of lexical scope.
   */
  pop(): HasBlockParams {
    assert(!this.isRoot, 'Cannot pop root scope');
    let block = this.stack.pop();
    assert(block && Array.isArray(block.blockParams), 'not a block');
    return block as HasBlockParams;
  }
}

/**
 * Check if _value_ is a `Node`.
 */
function isNode(value: unknown): value is AST.Node {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'type') === 'string'
  );
}

/**
 * Check if _node_ is a `StringLiteral`.
 */
function isStringLiteral(node: AST.Node): node is AST.StringLiteral {
  return node.type === 'StringLiteral';
}

/**
 * Check if _node_ is a `PathExpression`.
 */
function isPath(node: AST.Node): node is AST.PathExpression {
  return node.type === 'PathExpression';
}

/**
 * Check if _node_ is a `MustacheStatement`.
 */
function isMustache(node: AST.Node): node is AST.MustacheStatement {
  return node.type === 'MustacheStatement';
}

/**
 * Check if _node_ is a `MustacheCommentStatement`.
 */
function isComment(node: AST.Statement): node is AST.MustacheCommentStatement {
  return node.type === 'MustacheCommentStatement';
}

/**
 * Check if _node_ is an `ElementNode`.
 */
function isElementNode(node: AST.Node): node is AST.ElementNode {
  return node.type === 'ElementNode';
}

/**
 * Check if _node_ is a `TextNode`.
 */
function isTextNode(node: AST.Statement): node is AST.TextNode {
  return node.type === 'TextNode';
}

/**
 * Check if _node_ is an whitespace-only `TextNode`.
 */
function isWhitespace(node: AST.TextNode): boolean {
  return isTextNode(node) && node.chars.trim() === '';
}

/**
 * Check if _node_ is a named block.
 */
function isNamedBlock(node: AST.ElementNode): boolean {
  if (isElementNode(node) && node.tag.startsWith(':')) {
    let id = node.tag.slice(1);

    check(
      isValidBlockName(id),
      `<${node.tag}> is not a valid named block: ` + `\`${id}\` is not a valid block name`,
      node.loc
    );

    check(
      !node.selfClosing,
      `<${node.tag} /> is not a valid named block: ` + `named blocks cannot be self-closing`,
      node.loc
    );

    check(
      node.attributes.length === 0,
      `Named block <${node.tag}> cannot have attributes or arguments`,
      node.loc
    );

    check(node.modifiers.length === 0, `Named block <${node.tag}> cannot have modifiers`, node.loc);

    return true;
  } else {
    return false;
  }
}

/**
 * Check if _id_ is a valid identifier.
 */
function isValidBlockName(id: string): boolean {
  // TODO: what is the actual "identifier" regex?
  return id.indexOf('.') === -1 && /^[a-z]/.test(id);
}

type MessageCallback = () => string;
type Message = MessageCallback | string;

function messageFor(message: Message): string {
  if (typeof message === 'function') {
    return message();
  } else {
    return message;
  }
}

type MessageLocationCallback = () => AST.SourceLocation | void;
type MessageLocation = AST.Node | AST.SourceLocation | MessageLocationCallback | undefined;

function locFor(loc: MessageLocation): string | undefined {
  /**
   * @type {SourceLocation | undefined}
   */
  let location;

  if (typeof loc === 'function') {
    location = loc();
  } else if (isNode(loc)) {
    location = loc.loc;
  } else {
    location = loc;
  }

  if (location && location.source) {
    return ` (at ${location.source} on line ${location.start.line} column ${location.start.column})`;
  } else if (location) {
    return ` (on line ${location.start.line} column ${location.start.column})`;
  }
}

function assert(condition: unknown, message: Message = 'Assertion failed'): asserts condition {
  if (!condition) {
    throw new Error(
      `[BUG] ${messageFor(message)}\n` +
        'This is likely a bug in the ember-named-blocks-polyfill addon. ' +
        'Please file a bug at http://github.com/ember-polyfills/ember-named-blocks-polyfill'
    );
  }
}

function check(condition: unknown, message: Message, loc: MessageLocation): asserts condition {
  if (!condition) {
    throw new Error(`Syntax Error: ${messageFor(message)}${locFor(loc)}`);
  }
}
