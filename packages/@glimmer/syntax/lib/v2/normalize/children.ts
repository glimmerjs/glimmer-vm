import type { PresentArray } from '@glimmer/interfaces';
import { isPresentArray } from '@glimmer/util';

import type { PrecompileOptions } from '../../parser/tokenizer-event-handlers';
import type { SourceLocation } from '../../source/location';
import { SourceSlice } from '../../source/slice';
import type { Source } from '../../source/source';
import type { SourceSpan } from '../../source/span';
import { SpanList } from '../../source/span-list';
import type { SymbolTable, BlockSymbolTable, ProgramSymbolTable } from '../../symbol-table';
import { generateSyntaxError } from '../../syntax-error';
import { isLowerCase } from '../../utils';
import type * as ASTv1 from '../../v1/api';
import * as ASTv2 from '../api';
import { type BuildElement, Builder } from '../builders';
import type { Resolution } from '../loose-resolution';
import { printHead, printPath } from './utils';

/**
 * A `BlockContext` represents the block that a particular AST node is contained inside of.
 *
 * `BlockContext` is aware of template-wide options (such as strict mode), as well as the bindings
 * that are in-scope within that block.
 *
 * Concretely, it has the `PrecompileOptions` and current `SymbolTable`, and provides
 * facilities for working with those options.
 *
 * `BlockContext` is stateless.
 */
export class BlockContext<Table extends SymbolTable = SymbolTable> {
  readonly builder: Builder;
  readonly #options: PrecompileOptions;
  constructor(readonly source: Source, options: PrecompileOptions, readonly table: Table) {
    this.builder = new Builder();
    this.#options = options;
  }

  /**
   * Requires all variable resolution to be lexically scoped. In strict resolution mode, no AST node
   * that assumes runtime resolution will be created.
   */
  get strictResolution(): boolean {
    let strictMode = this.#options.strictMode;
    if (strictMode && typeof strictMode === 'object') {
      return strictMode.variables ?? false;
    }

    return strictMode ?? false;
  }

  /**
   * Assumes that all attributes are actually attributes and not properties.
   *
   * In loose attributes mode, attributes are converted into modifiers that use the classic behavior.
   */
  get strictAttributes(): boolean {
    let strictMode = this.#options.strictMode;
    if (strictMode && typeof strictMode === 'object') {
      return strictMode.attributes ?? false;
    }

    return false;
  }

  span(loc: SourceLocation): SourceSpan {
    return this.source.spanFor(loc);
  }

  resolutionFor<N extends ASTv1.CallNode | ASTv1.PathExpression>(
    node: N,
    resolution: Resolution<N>
  ): { result: ASTv2.FreeVarResolution } | { result: 'error'; path: string; head: string } {
    if (this.strictResolution) {
      return { result: ASTv2.STRICT_RESOLUTION };
    }

    if (this.#isFreeVar(node)) {
      let r = resolution(node);

      if (r === null) {
        return {
          result: 'error',
          path: printPath(node),
          head: printHead(node),
        };
      }

      return { result: r };
    } else {
      return { result: ASTv2.STRICT_RESOLUTION };
    }
  }

  isLexicalVar(variable: string): boolean {
    return this.table.hasLexical(variable);
  }

  #isFreeVar(callee: ASTv1.CallNode | ASTv1.PathExpression): boolean {
    if (callee.type === 'PathExpression') {
      if (callee.head.type !== 'VarHead') {
        return false;
      }

      return !this.table.has(callee.head.name);
    } else if (callee.path.type === 'PathExpression') {
      return this.#isFreeVar(callee.path);
    } else {
      return false;
    }
  }

  hasBinding(name: string): boolean {
    return this.table.has(name) || this.table.hasLexical(name);
  }

  child(blockParameters: string[]): BlockContext<BlockSymbolTable> {
    return new BlockContext(this.source, this.#options, this.table.child(blockParameters));
  }

  customizeComponentName(input: string): string {
    return this.#options.customizeComponentName
      ? this.#options.customizeComponentName(input)
      : input;
  }
}

export class HasBlockContext<Table extends SymbolTable = SymbolTable> {
  readonly block: BlockContext<Table>;

  constructor(block: BlockContext<Table>) {
    this.block = block;
  }

  get strict() {
    return {
      attributes: this.block.strictAttributes,
      resolution: this.block.strictResolution,
    };
  }

  get table() {
    return this.block.table;
  }

  get b() {
    return this.block.builder;
  }

  resolutionFor = <N extends ASTv1.CallNode | ASTv1.PathExpression>(
    node: N,
    resolution: Resolution<N>
  ): { result: ASTv2.FreeVarResolution } | { result: 'error'; path: string; head: string } => {
    return this.block.resolutionFor(node, resolution);
  };

  loc = (node: SourceLocation | ASTv1.Node) => {
    return 'type' in node ? this.block.span(node.loc) : this.block.span(node);
  };
}

class Children<Table extends SymbolTable> extends HasBlockContext<Table> {
  readonly namedBlocks: ASTv2.NamedBlock[];
  readonly hasSemanticContent: boolean;
  readonly nonBlockChildren: ASTv2.ContentNode[];

  constructor(
    readonly span: SourceSpan,
    readonly children: (ASTv2.ContentNode | ASTv2.NamedBlock)[],
    block: BlockContext<Table>
  ) {
    super(block);
    this.namedBlocks = children.filter((c): c is ASTv2.NamedBlock => c instanceof ASTv2.NamedBlock);
    this.hasSemanticContent = children.some((c): c is ASTv2.ContentNode => {
      if (c instanceof ASTv2.NamedBlock) {
        return false;
      }
      switch (c.type) {
        case 'GlimmerComment':
        case 'HtmlComment':
          return false;
        case 'HtmlText':
          return !/^\s*$/u.test(c.chars);
        default:
          return true;
      }
    });
    this.nonBlockChildren = children.filter(
      (c): c is ASTv2.ContentNode => !(c instanceof ASTv2.NamedBlock)
    );
  }
}

export class TemplateChildren extends Children<ProgramSymbolTable> {
  assertTemplate(table: ProgramSymbolTable): ASTv2.Template {
    if (isPresentArray(this.namedBlocks)) {
      throw generateSyntaxError(`Unexpected named block at the top-level of a template`, this.span);
    }

    return this.b.template(table, this.nonBlockChildren, this.loc(this.span));
  }
}

export class BlockChildren extends Children<BlockSymbolTable> {
  intoBlock(): ASTv2.Block {
    if (isPresentArray(this.namedBlocks)) {
      throw generateSyntaxError(`Unexpected named block nested in a normal block`, this.span);
    }

    return this.b.block(this.block.table, this.nonBlockChildren, this.span);
  }
}

export class ElementChildren extends Children<BlockSymbolTable> {
  readonly #element: BuildElement;

  constructor(
    element: BuildElement,
    children: (ASTv2.ContentNode | ASTv2.NamedBlock)[],
    block: BlockContext<BlockSymbolTable>
  ) {
    super(element.base.span, children, block);
    this.#element = element;
  }

  _finalize_(path: ASTv2.ExpressionNode | 'ElementHead', tagSpan: SourceSpan) {
    return path === 'ElementHead'
      ? this.#finalizeElement(tagSpan, this.block.table)
      : this.#finalizeComponent(path, tagSpan);
  }

  #finalizeComponent(path: ASTv2.ExpressionNode, tagSpan: SourceSpan) {
    if (this.#element.base.selfClosing) {
      return this.#element.selfClosingComponent(path);
    } else {
      let blocks = this.#assertComponent(tagSpan.asString(), this.block.table);
      return this.#element.componentWithNamedBlocks(path, blocks, this.span);
    }
  }

  #finalizeElement(
    tagSpan: SourceSpan,
    table: BlockSymbolTable
  ): ASTv2.SimpleElement | ASTv2.NamedBlock {
    return tagSpan.asString()[0] === ':'
      ? this.#assertNamedBlock(tagSpan.slice({ skipStart: 1 }).toSlice(), table)
      : this.#assertElement(tagSpan.toSlice(), table.hasBlockParams);
  }

  #assertNamedBlock(name: SourceSlice, table: BlockSymbolTable): ASTv2.NamedBlock {
    if (this.#element.base.selfClosing) {
      throw generateSyntaxError(
        `<:${name.chars}/> is not a valid named block: named blocks cannot be self-closing`,
        this.span
      );
    }

    if (isPresentArray(this.namedBlocks)) {
      throw generateSyntaxError(
        `Unexpected named block inside <:${name.chars}> named block: named blocks cannot contain nested named blocks`,
        this.span
      );
    }

    if (!isLowerCase(name.chars)) {
      throw generateSyntaxError(
        `<:${name.chars}> is not a valid named block, and named blocks must begin with a lowercase letter`,
        this.span
      );
    }

    if (
      this.#element.base.attrs.length > 0 ||
      this.#element.base.componentArgs.length > 0 ||
      this.#element.base.modifiers.length > 0
    ) {
      throw generateSyntaxError(
        `named block <:${name.chars}> cannot have attributes, arguments, or modifiers`,
        this.span
      );
    }

    let offsets = SpanList.range(this.nonBlockChildren, this.span);

    return this.b.namedBlock(name, this.b.block(table, this.nonBlockChildren, offsets), this.span);
  }

  #assertElement(name: SourceSlice, hasBlockParameters: boolean): ASTv2.SimpleElement {
    if (hasBlockParameters) {
      throw generateSyntaxError(
        `Unexpected block params in <${name}>: simple elements cannot have block params`,
        this.span
      );
    }

    if (isPresentArray(this.namedBlocks)) {
      let names = this.namedBlocks.map((b) => b.name);

      if (names.length === 1) {
        throw generateSyntaxError(
          `Unexpected named block <:foo> inside <${name.chars}> HTML element`,
          this.span
        );
      } else {
        let printedNames = names.map((n) => `<:${n.chars}>`).join(', ');
        throw generateSyntaxError(
          `Unexpected named blocks inside <${name.chars}> HTML element (${printedNames})`,
          this.span
        );
      }
    }

    return this.#element.simple(name, this.nonBlockChildren, this.span);
  }

  #assertComponent(name: string, table: BlockSymbolTable): PresentArray<ASTv2.NamedBlock> {
    if (isPresentArray(this.namedBlocks) && this.hasSemanticContent) {
      throw generateSyntaxError(
        `Unexpected content inside <${name}> component invocation: when using named blocks, the tag cannot contain other content`,
        this.span
      );
    }

    if (isPresentArray(this.namedBlocks)) {
      if (table.hasBlockParams) {
        throw generateSyntaxError(
          `Unexpected block params list on <${name}> component invocation: when passing named blocks, the invocation tag cannot take block params`,
          this.span
        );
      }

      let seenNames = new Set<string>();

      for (let block of this.namedBlocks) {
        let name = block.name.chars;

        if (seenNames.has(name)) {
          throw generateSyntaxError(
            `Component had two named blocks with the same name, \`<:${name}>\`. Only one block with a given name may be passed`,
            this.span
          );
        }

        if (
          (name === 'inverse' && seenNames.has('else')) ||
          (name === 'else' && seenNames.has('inverse'))
        ) {
          throw generateSyntaxError(
            `Component has both <:else> and <:inverse> block. <:inverse> is an alias for <:else>`,
            this.span
          );
        }

        seenNames.add(name);
      }

      return this.namedBlocks;
    } else {
      return [
        this.b.namedBlock(
          SourceSlice.synthetic('default'),
          this.b.block(table, this.nonBlockChildren, this.span),
          this.span
        ),
      ];
    }
  }
}
