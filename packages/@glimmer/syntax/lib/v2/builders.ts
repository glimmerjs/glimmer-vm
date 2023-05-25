import type { PresentArray } from '@glimmer/interfaces';
import { assert, assertPresentArray, assign } from '@glimmer/util';

import { SourceSlice } from '../source/slice';
import type { SourceSpan } from '../source/span';
import { SpanList } from '../source/span-list';
import type { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from '../symbol-table';
import * as ASTv2 from './api';

export interface CallParts {
  callee: ASTv2.ExpressionNode;
  args: ASTv2.Args;
}

export class Builder {
  // TEMPLATE //

  template(
    symbols: ProgramSymbolTable,
    body: ASTv2.ContentNode[],
    loc: SourceSpan
  ): ASTv2.Template {
    return ASTv2.Template.of({
      table: symbols,
      body,
      loc,
    });
  }

  // INTERNAL (these nodes cannot be reached when doing general-purpose visiting) //

  block(symbols: BlockSymbolTable, body: ASTv2.ContentNode[], loc: SourceSpan): ASTv2.Block {
    return ASTv2.Block.of({
      scope: symbols,
      body,
      loc,
    });
  }

  namedBlock(name: SourceSlice, block: ASTv2.Block, loc: SourceSpan): ASTv2.NamedBlock {
    return ASTv2.NamedBlock.of({
      name,
      block,
      attrs: [],
      componentArgs: [],
      modifiers: [],
      loc,
    });
  }

  simpleNamedBlock(name: SourceSlice, block: ASTv2.Block, span: SourceSpan): ASTv2.NamedBlock {
    return new BuildElement({
      selfClosing: false,
      attrs: [],
      componentArgs: [],
      modifiers: [],
      comments: [],
      span,
    }).named(name, block);
  }

  slice(chars: string, loc: SourceSpan): SourceSlice {
    return new SourceSlice({
      loc,
      chars,
    });
  }

  args(
    positional: ASTv2.PositionalArguments,
    named: ASTv2.NamedArguments,
    loc: SourceSpan
  ): ASTv2.Args {
    return ASTv2.Args.of({
      loc,
      positional,
      named,
    });
  }

  positional(exprs: ASTv2.ExpressionNode[], loc: SourceSpan): ASTv2.PositionalArguments {
    return ASTv2.PositionalArguments.of({
      loc,
      exprs,
    });
  }

  namedArgument(key: SourceSlice, value: ASTv2.ExpressionNode): ASTv2.NamedArgument {
    return ASTv2.NamedArgument.of({
      name: key,
      value,
      loc: key.loc.extend(value.loc),
    });
  }

  named(entries: ASTv2.NamedArgument[], loc: SourceSpan): ASTv2.NamedArguments {
    return ASTv2.NamedArguments.of({
      loc,
      entries,
    });
  }

  attr(
    {
      name,
      value,
      trusting,
      strict,
    }: { name: SourceSlice; value: ASTv2.ExpressionNode; trusting: boolean; strict: boolean },
    loc: SourceSpan
  ): ASTv2.HtmlAttr {
    return ASTv2.HtmlAttr.of({
      loc,
      name,
      value,
      trusting,
      strict,
    });
  }

  splatAttr(symbol: number, loc: SourceSpan): ASTv2.SplatAttr {
    return ASTv2.SplatAttr.of({
      symbol,
      loc,
    });
  }

  arg(
    {
      name,
      value,
      trusting,
    }: { name: SourceSlice; value: ASTv2.ExpressionNode; trusting: boolean },
    loc: SourceSpan
  ): ASTv2.ComponentArg {
    return ASTv2.ComponentArg.of({
      name,
      value,
      trusting,
      loc,
    });
  }

  // EXPRESSIONS //

  path(head: ASTv2.VariableReference, tail: SourceSlice[], loc: SourceSpan): ASTv2.PathExpression {
    return ASTv2.PathExpression.of({
      loc,
      ref: head,
      tail,
    });
  }

  self(loc: SourceSpan): ASTv2.VariableReference {
    return ASTv2.ThisReference.of({
      loc,
    });
  }

  keyword(name: string, loc: SourceSpan): ASTv2.KeywordReference {
    return ASTv2.KeywordReference.of({
      name,
      loc,
    });
  }

  at(name: string, symbol: number, loc: SourceSpan): ASTv2.VariableReference {
    // the `@` should be included so we have a complete source range
    assert(name[0] === '@', `call builders.at() with a string that starts with '@'`);

    return ASTv2.ArgReference.of({
      loc,
      name: new SourceSlice({ loc, chars: name }),
      symbol,
    });
  }

  freeVar({
    name,
    context,
    symbol,
    loc,
  }: {
    name: string;
    context: ASTv2.FreeVarResolution;
    symbol: number;
    loc: SourceSpan;
  }): ASTv2.FreeVarReference {
    assert(
      name !== 'this',
      `You called builders.freeVar() with 'this'. Call builders.this instead`
    );
    assert(
      name[0] !== '@',
      `You called builders.freeVar() with '${name}'. Call builders.at('${name}') instead`
    );

    return ASTv2.FreeVarReference.of({
      name,
      resolution: context,
      symbol,
      loc,
    });
  }

  localVar(
    name: string,
    symbol: number,
    isTemplateLocal: boolean,
    loc: SourceSpan
  ): ASTv2.VariableReference {
    assert(name !== 'this', `You called builders.var() with 'this'. Call builders.this instead`);
    assert(
      name[0] !== '@',
      `You called builders.var() with '${name}'. Call builders.at('${name}') instead`
    );

    return ASTv2.LocalVarReference.of({
      loc,
      name,
      isTemplateLocal,
      symbol,
    });
  }

  sexp(parts: CallParts, loc: SourceSpan): ASTv2.CallExpression {
    return ASTv2.CallExpression.of({
      loc,
      callee: parts.callee,
      args: parts.args,
    });
  }

  deprecatedCall(
    argument: SourceSlice,
    callee: ASTv2.FreeVarReference,
    loc: SourceSpan
  ): ASTv2.DeprecatedCallExpression {
    return ASTv2.DeprecatedCallExpression.of({
      loc,
      arg: argument,
      callee,
    });
  }

  interpolate(parts: ASTv2.ExpressionNode[], loc: SourceSpan): ASTv2.InterpolateExpression {
    assertPresentArray(parts);

    return ASTv2.InterpolateExpression.of({
      loc,
      parts,
    });
  }

  literal(value: string, loc: SourceSpan): ASTv2.LiteralExpression & { value: string };
  literal(value: number, loc: SourceSpan): ASTv2.LiteralExpression & { value: number };
  literal(value: boolean, loc: SourceSpan): ASTv2.LiteralExpression & { value: boolean };
  literal(value: null, loc: SourceSpan): ASTv2.LiteralExpression & { value: null };
  literal(value: undefined, loc: SourceSpan): ASTv2.LiteralExpression & { value: undefined };
  literal(
    value: string | number | boolean | null | undefined,
    loc: SourceSpan
  ): ASTv2.LiteralExpression;
  literal(
    value: string | number | boolean | null | undefined,
    loc: SourceSpan
  ): ASTv2.LiteralExpression {
    return ASTv2.LiteralExpression.of({
      loc,
      value,
    });
  }

  // STATEMENTS //

  append(
    {
      table,
      trusting,
      value,
    }: { table: SymbolTable; trusting: boolean; value: ASTv2.ExpressionNode },
    loc: SourceSpan
  ): ASTv2.AppendContent {
    return ASTv2.AppendContent.of({
      table,
      trusting,
      value,
      loc,
    });
  }

  modifier({ callee, args }: CallParts, loc: SourceSpan): ASTv2.ElementModifier {
    return ASTv2.ElementModifier.of({
      loc,
      callee,
      args,
    });
  }

  namedBlocks(blocks: ASTv2.NamedBlock[], loc: SourceSpan): ASTv2.NamedBlocks {
    return ASTv2.NamedBlocks.of({
      loc,
      blocks,
    });
  }

  blockStatement(
    {
      program,
      inverse = null,
      ...call
    }: {
      symbols: SymbolTable;
      program: ASTv2.Block;
      inverse?: ASTv2.Block | null;
    } & CallParts,
    loc: SourceSpan
  ): ASTv2.InvokeBlock {
    let blocksLoc = program.loc;
    let blocks: PresentArray<ASTv2.NamedBlock> = [
      this.namedBlock(SourceSlice.synthetic('default'), program, program.loc),
    ];
    if (inverse) {
      blocksLoc = blocksLoc.extend(inverse.loc);
      blocks.push(this.namedBlock(SourceSlice.synthetic('else'), inverse, inverse.loc));
    }

    return ASTv2.InvokeBlock.of({
      loc,
      blocks: this.namedBlocks(blocks, blocksLoc),
      callee: call.callee,
      args: call.args,
    });
  }

  element(options: BuildBaseElement): BuildElement {
    return new BuildElement(options);
  }
}

export interface BuildBaseElement {
  selfClosing: boolean;
  attrs: ASTv2.HtmlOrSplatAttr[];
  componentArgs: ASTv2.ComponentArg[];
  modifiers: ASTv2.ElementModifier[];
  comments: ASTv2.GlimmerComment[];
  span: SourceSpan;
}

export class BuildElement {
  readonly builder: Builder;
  constructor(readonly base: BuildBaseElement) {
    this.builder = new Builder();
  }

  simple(tag: SourceSlice, body: ASTv2.ContentNode[], loc: SourceSpan): ASTv2.SimpleElement {
    return ASTv2.SimpleElement.of({
      tag,
      body,
      loc,
      ...this.base,
    });
  }

  named(name: SourceSlice, block: ASTv2.Block): ASTv2.NamedBlock {
    return ASTv2.NamedBlock.of(
      assign(
        {
          name,
          block,
          componentArgs: [],
          loc: this.base.span,
        },
        this.base
      )
    );
  }

  selfClosingComponent(callee: ASTv2.ExpressionNode): ASTv2.InvokeComponent {
    let span = this.base.span;
    return ASTv2.InvokeComponent.of(
      assign(
        {
          loc: span,
          callee,
          // point the empty named blocks at the `/` self-closing tag
          blocks: ASTv2.NamedBlocks.of({
            blocks: [],
            loc: span.sliceEndChars({ skipEnd: 1, chars: 1 }),
          }),
        },
        this.base
      )
    );
  }

  componentWithDefaultBlock(
    callee: ASTv2.ExpressionNode,
    children: ASTv2.ContentNode[],
    symbols: BlockSymbolTable,
    loc: SourceSpan
  ): ASTv2.InvokeComponent {
    let block = this.builder.block(symbols, children, loc);
    let namedBlock = this.builder.namedBlock(SourceSlice.synthetic('default'), block, loc);

    return ASTv2.InvokeComponent.of(
      assign(
        {
          loc,
          callee,
          blocks: this.builder.namedBlocks([namedBlock], namedBlock.loc),
        },
        this.base
      )
    );
  }

  componentWithNamedBlocks(
    callee: ASTv2.ExpressionNode,
    blocks: PresentArray<ASTv2.NamedBlock>,
    loc: SourceSpan
  ): ASTv2.InvokeComponent {
    return ASTv2.InvokeComponent.of(
      assign(
        {
          loc,
          callee,
          blocks: this.builder.namedBlocks(blocks, SpanList.range(blocks)),
        },
        this.base
      )
    );
  }
}
