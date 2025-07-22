import type { Optional, PresentArray } from '@glimmer/interfaces';
import { assertPresentArray, localAssert } from '@glimmer/debug-util';

import type { SourceSpan } from '../source/span';
import type { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from '../symbol-table';
import type * as ASTv1 from '../v1/api';

import { SourceSlice } from '../source/slice';
import { SpanList } from '../source/span-list';
import * as ASTv2 from './api';

export interface CallParts {
  callee: ASTv2.DynamicCallee;
  args: ASTv2.CurlyArgs;
}

export class Builder {
  // TEMPLATE //

  template(
    symbols: ProgramSymbolTable,
    body: ASTv2.ContentNode[],
    loc: SourceSpan,
    error?: Optional<{ eof?: Optional<ASTv1.ErrorNode> }>
  ): ASTv2.Template {
    return new ASTv2.Template({
      table: symbols,
      body,
      error: error?.eof ? { eof: error.eof } : undefined,
      loc,
    });
  }

  // INTERNAL (these nodes cannot be reached when doing general-purpose visiting) //

  block(symbols: BlockSymbolTable, body: ASTv2.ContentNode[], loc: SourceSpan): ASTv2.Block {
    return new ASTv2.Block({
      scope: symbols,
      body,
      loc,
    });
  }

  namedBlock(name: SourceSlice, block: ASTv2.Block, loc: SourceSpan): ASTv2.NamedBlock {
    return new ASTv2.NamedBlock({
      name,
      block,
      attrs: [],
      componentArgs: [],
      modifiers: [],
      loc,
    });
  }

  simpleNamedBlock(name: SourceSlice, block: ASTv2.Block, loc: SourceSpan): ASTv2.NamedBlock {
    return new BuildElement({
      selfClosing: false,
      attrs: [],
      componentArgs: [],
      modifiers: [],
      comments: [],
    }).named(name, block, loc);
  }

  slice(chars: string, loc: SourceSpan): SourceSlice {
    return new SourceSlice({
      loc,
      chars,
    });
  }

  positional(exprs: ASTv2.ExpressionValueNode[], loc: SourceSpan): ASTv2.PositionalArguments {
    return new ASTv2.PositionalArguments({
      loc,
      exprs,
    });
  }

  namedArgument(key: SourceSlice, value: ASTv2.ExpressionValueNode): ASTv2.CurlyArgument {
    return new ASTv2.CurlyArgument({
      name: key,
      value,
    });
  }

  named(entries: ASTv2.CurlyArgument[], loc: SourceSpan): ASTv2.CurlyNamedArguments {
    return ASTv2.CurlyNamedArguments(loc, entries);
  }

  attr(
    { name, value, trusting }: { name: SourceSlice; value: ASTv2.AttrValueNode; trusting: boolean },
    loc: SourceSpan
  ): ASTv2.HtmlAttr {
    return new ASTv2.HtmlAttr({
      loc,
      name,
      value,
      trusting,
    });
  }

  splatAttr(symbol: number, loc: SourceSpan): ASTv2.SplatAttr {
    return new ASTv2.SplatAttr({
      symbol,
      loc,
    });
  }

  // @todo make it possible to return `Result` from @glimmer/syntax and handle {{{}}} in attr value
  // position as a syntax error
  arg(
    { name, value, trusting }: { name: SourceSlice; value: ASTv2.AttrValueNode; trusting: boolean },
    loc: SourceSpan
  ): ASTv2.ComponentArg {
    return new ASTv2.ComponentArg({
      name,
      value,
      trusting,
      loc,
    });
  }

  // EXPRESSIONS //

  path(
    head: ASTv2.VariableReference | ASTv2.UnresolvedBinding,
    tail: SourceSlice[],
    loc: SourceSpan
  ): ASTv2.PathExpression {
    return new ASTv2.PathExpression({
      loc,
      ref: head,
      tail,
    });
  }

  keyword(name: string, symbol: number, loc: SourceSpan): ASTv2.KeywordExpression {
    return new ASTv2.KeywordExpression({
      loc,
      name,
      symbol,
    });
  }

  self(loc: SourceSpan): ASTv2.ThisReference {
    return new ASTv2.ThisReference({
      loc,
    });
  }

  at(name: string, symbol: number, loc: SourceSpan): ASTv2.ArgReference {
    // the `@` should be included so we have a complete source range
    localAssert(name[0] === '@', `call builders.at() with a string that starts with '@'`);

    return new ASTv2.ArgReference({
      loc,
      name: new SourceSlice({ loc, chars: name }),
      symbol,
    });
  }

  localVar(
    name: string,
    symbol: number,
    isLexical: boolean,
    loc: SourceSpan
  ): ASTv2.LocalVarReference | ASTv2.LexicalVarReference {
    localAssert(
      name[0] !== '@',
      `You called builders.var() with '${name}'. Call builders.at('${name}') instead`
    );

    if (isLexical) {
      return new ASTv2.LexicalVarReference({
        loc,
        name,
        symbol,
      });
    } else {
      return new ASTv2.LocalVarReference({
        loc,
        name,
        symbol,
      });
    }
  }

  sexp(parts: CallParts, loc: SourceSpan): ASTv2.CallExpression {
    return new ASTv2.CallExpression({
      loc,
      callee: parts.callee,
      args: parts.args,
    });
  }

  interpolate(parts: ASTv2.InterpolatePartNode[], loc: SourceSpan): ASTv2.InterpolateExpression {
    assertPresentArray(parts);

    return new ASTv2.InterpolateExpression({
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
    return new ASTv2.LiteralExpression({
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
    }: {
      table: SymbolTable;
      trusting: boolean;
      value: ASTv2.DynamicCallee;
    },
    loc: SourceSpan
  ): ASTv2.AppendContent | ASTv2.AppendStaticContent {
    return new ASTv2.AppendContent({
      table,
      trusting,
      value,
      loc,
    });
  }

  modifier({ callee, args }: CallParts, loc: SourceSpan): ASTv2.ElementModifier {
    return new ASTv2.ElementModifier({
      loc,
      callee,
      args,
    });
  }

  namedBlocks(
    blocks: PresentArray<ASTv2.NamedBlock | ASTv1.ErrorNode>,
    loc: SourceSpan
  ): ASTv2.NamedBlocks {
    return new ASTv2.NamedBlocks({
      loc,
      blocks,
    });
  }

  blockStatement(
    {
      program,
      inverse = null,
      callee,
      ...call
    }: {
      symbols: SymbolTable;
      program: ASTv2.Block;
      inverse?: ASTv2.Block | null;
      callee: ASTv2.BlockCallee | ASTv2.ResolvedName | ASTv2.UnresolvedBinding;
      args: ASTv2.CurlyArgs;
    },
    loc: SourceSpan
  ): ASTv2.InvokeBlock | ASTv2.InvokeResolvedBlock {
    let blocksLoc = program.loc;
    let blocks: PresentArray<ASTv2.NamedBlock> = [
      this.namedBlock(SourceSlice.synthetic('default'), program, program.loc),
    ];

    if (inverse) {
      blocksLoc = blocksLoc.extend(inverse.loc);
      blocks.push(this.namedBlock(SourceSlice.synthetic('else'), inverse, inverse.loc));
    }

    if (callee.type === 'ResolvedName') {
      return new ASTv2.InvokeResolvedBlock({
        loc,
        blocks: this.namedBlocks(blocks, blocksLoc),
        resolved: callee,
        args: call.args,
      });
    } else {
      return new ASTv2.InvokeBlock({
        loc,
        blocks: this.namedBlocks(blocks, blocksLoc),
        callee,
        args: call.args,
      });
    }
  }

  element(options: BuildBaseElement): BuildElement {
    return new BuildElement(options);
  }
}

export interface BuildBaseElement {
  selfClosing: boolean;
  attrs: ASTv2.HtmlOrSplatAttr[];
  componentArgs: ASTv2.ComponentArg[];
  modifiers: (ASTv2.ElementModifier | ASTv2.ResolvedElementModifier)[];
  comments: ASTv2.GlimmerComment[];
}

export class BuildElement {
  readonly builder: Builder;
  constructor(readonly base: BuildBaseElement) {
    this.builder = new Builder();
  }

  simple(tag: SourceSlice, body: ASTv2.ContentNode[], loc: SourceSpan): ASTv2.SimpleElementNode {
    return new ASTv2.SimpleElementNode({
      ...this.base,
      tag,
      body,
      loc,
    });
  }

  named(name: SourceSlice, block: ASTv2.Block, loc: SourceSpan): ASTv2.NamedBlock {
    return new ASTv2.NamedBlock({
      ...this.base,
      name,
      block,
      loc,
    });
  }

  selfClosingComponent(
    callee: ASTv2.PathExpression | ASTv2.ResolvedName,
    loc: SourceSpan
  ): ASTv2.InvokeAngleBracketComponent | ASTv2.InvokeResolvedAngleBracketComponent {
    if (callee.type === 'ResolvedName') {
      return new ASTv2.InvokeResolvedAngleBracketComponent({
        ...this.base,
        loc,
        callee,
        // point the empty named blocks at the `/` self-closing tag
        blocks: new ASTv2.NamedBlocks({
          blocks: [],
          loc: loc.sliceEndChars({ skipEnd: 1, chars: 1 }),
        }),
      });
    } else {
      return new ASTv2.InvokeAngleBracketComponent({
        ...this.base,
        loc,
        callee,
        // point the empty named blocks at the `/` self-closing tag
        blocks: new ASTv2.NamedBlocks({
          blocks: [],
          loc: loc.sliceEndChars({ skipEnd: 1, chars: 1 }),
        }),
      });
    }
  }

  componentWithDefaultBlock(
    callee: ASTv2.PathExpression | ASTv2.ResolvedName,
    children: ASTv2.ContentNode[],
    symbols: BlockSymbolTable,
    loc: SourceSpan
  ): ASTv2.InvokeAngleBracketComponent | ASTv2.InvokeResolvedAngleBracketComponent {
    let block = this.builder.block(symbols, children, loc);
    let namedBlock = this.builder.namedBlock(SourceSlice.synthetic('default'), block, loc); // BUILDER.simpleNamedBlock('default', children, symbols, loc);

    if (callee.type === 'ResolvedName') {
      return new ASTv2.InvokeResolvedAngleBracketComponent({
        ...this.base,
        loc,
        callee,
        blocks: this.builder.namedBlocks([namedBlock], namedBlock.loc),
      });
    } else {
      return new ASTv2.InvokeAngleBracketComponent({
        ...this.base,
        loc,
        callee,
        blocks: this.builder.namedBlocks([namedBlock], namedBlock.loc),
      });
    }
  }

  componentWithNamedBlocks(
    callee: ASTv2.PathExpression | ASTv2.ResolvedName,
    blocks: PresentArray<ASTv2.NamedBlock | ASTv1.ErrorNode>,
    loc: SourceSpan
  ): ASTv2.InvokeAngleBracketComponent | ASTv2.InvokeResolvedAngleBracketComponent {
    if (callee.type === 'ResolvedName') {
      return new ASTv2.InvokeResolvedAngleBracketComponent({
        ...this.base,
        loc,
        callee,
        blocks: this.builder.namedBlocks(blocks, SpanList.range(blocks)),
      });
    } else {
      return new ASTv2.InvokeAngleBracketComponent({
        ...this.base,
        loc,
        callee,
        blocks: this.builder.namedBlocks(blocks, SpanList.range(blocks)),
      });
    }
  }
}
