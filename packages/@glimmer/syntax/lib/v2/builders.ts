import type { PresentArray } from '@glimmer/interfaces';
import { assert, assertPresent, assign } from '@glimmer/util';
import { SourceOffsetList } from '../source/offsets';
import type { SourceOffsets } from '../source/offsets/abstract';
import { SourceSlice } from '../source/slice';
import type { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from '../symbol-table';
import type * as ASTv2 from './nodes-v2';
import {
  AppendContent,
  ArgReference,
  Args,
  Block,
  CallExpression,
  ComponentArg,
  ExpressionNode,
  FreeVarReference,
  FreeVarResolution,
  HtmlAttr,
  InterpolateExpression,
  InvokeBlock,
  InvokeComponent,
  LiteralExpression,
  LocalVarReference,
  Named,
  NamedBlock,
  NamedBlocks,
  NamedEntry,
  PathExpression,
  Positional,
  SimpleElement,
  Template,
  ThisReference,
} from './objects';
import { ElementModifier, SplatAttr } from './objects/attr-block';

export interface CallParts {
  callee: ASTv2.Expression;
  args: ASTv2.Args;
}

export class Builder {
  // TEMPLATE //

  template(
    symbols: ProgramSymbolTable,
    body: ASTv2.ContentNode[],
    loc: SourceOffsets
  ): ASTv2.Template {
    return new Template({
      table: symbols,
      body,
      loc,
    });
  }

  // INTERNAL (these nodes cannot be reached when doing general-purpose visiting) //

  block(symbols: BlockSymbolTable, body: ASTv2.ContentNode[], loc: SourceOffsets): ASTv2.Block {
    return new Block({
      table: symbols,
      body,
      loc,
    });
  }

  namedBlock(name: SourceSlice, block: ASTv2.Block, loc: SourceOffsets): ASTv2.NamedBlock {
    return new NamedBlock({
      name,
      block,
      attrs: [],
      componentArgs: [],
      modifiers: [],
      loc,
    });
  }

  simpleNamedBlock(name: SourceSlice, block: ASTv2.Block, loc: SourceOffsets): ASTv2.NamedBlock {
    return new BuildElement({
      selfClosing: false,
      attrs: [],
      componentArgs: [],
      modifiers: [],
      comments: [],
    }).named(name, block, loc);
  }

  slice(chars: string, loc: SourceOffsets): SourceSlice {
    return new SourceSlice({
      loc,
      chars,
    });
  }

  args(positional: ASTv2.Positional, named: ASTv2.Named, loc: SourceOffsets): ASTv2.Args {
    return new Args({
      loc,
      positional,
      named,
    });
  }

  positional(exprs: ASTv2.Expression[], loc: SourceOffsets): ASTv2.Positional {
    return new Positional({
      loc,
      exprs,
    });
  }

  namedEntry(key: SourceSlice, value: ExpressionNode): ASTv2.NamedEntry {
    return new NamedEntry({
      name: key,
      value,
    });
  }

  named(entries: ASTv2.NamedEntry[], loc: SourceOffsets): ASTv2.Named {
    return new Named({
      loc,
      entries,
    });
  }

  attr(
    { name, value, trusting }: { name: SourceSlice; value: ASTv2.Expression; trusting: boolean },
    loc: SourceOffsets
  ): ASTv2.HtmlAttr {
    return new HtmlAttr({
      loc,
      name,
      value,
      trusting,
    });
  }

  splatAttr(loc: SourceOffsets): ASTv2.SplatAttr {
    return new SplatAttr({
      loc,
    });
  }

  arg(
    { name, value, trusting }: { name: SourceSlice; value: ASTv2.Expression; trusting: boolean },
    loc: SourceOffsets
  ): ASTv2.ComponentArg {
    return new ComponentArg({
      name,
      value,
      trusting,
      loc,
    });
  }

  // EXPRESSIONS //

  path(
    head: ASTv2.VariableReference,
    tail: SourceSlice[],
    loc: SourceOffsets
  ): ASTv2.PathExpression {
    return new PathExpression({
      loc,
      ref: head,
      tail,
    });
  }

  self(loc: SourceOffsets): ASTv2.VariableReference {
    return new ThisReference({
      loc,
    });
  }

  at(name: string, loc: SourceOffsets): ASTv2.VariableReference {
    // the `@` should be included so we have a complete source range
    assert(name[0] === '@', `call builders.at() with a string that starts with '@'`);

    return new ArgReference({
      loc,
      name: new SourceSlice({ loc, chars: name }),
    });
  }

  freeVar(name: string, context: FreeVarResolution, loc: SourceOffsets): ASTv2.VariableReference {
    assert(
      name !== 'this',
      `You called builders.freeVar() with 'this'. Call builders.this instead`
    );
    assert(
      name[0] !== '@',
      `You called builders.freeVar() with '${name}'. Call builders.at('${name}') instead`
    );

    return new FreeVarReference({
      name,
      resolution: context,
      loc,
    });
  }

  localVar(name: string, loc: SourceOffsets): ASTv2.VariableReference {
    assert(name !== 'this', `You called builders.var() with 'this'. Call builders.this instead`);
    assert(
      name[0] !== '@',
      `You called builders.var() with '${name}'. Call builders.at('${name}') instead`
    );

    return new LocalVarReference({
      loc,
      name,
    });
  }

  sexp(parts: CallParts, loc: SourceOffsets): ASTv2.CallExpression {
    return new CallExpression({
      loc,
      callee: parts.callee,
      args: parts.args,
    });
  }

  interpolate(parts: ASTv2.Expression[], loc: SourceOffsets): ASTv2.InterpolateExpression {
    assertPresent(parts);

    return new InterpolateExpression({
      loc,
      parts,
    });
  }

  literal(value: string, loc: SourceOffsets): ASTv2.LiteralExpression & { value: string };
  literal(value: number, loc: SourceOffsets): ASTv2.LiteralExpression & { value: number };
  literal(value: boolean, loc: SourceOffsets): ASTv2.LiteralExpression & { value: boolean };
  literal(value: null, loc: SourceOffsets): ASTv2.LiteralExpression & { value: null };
  literal(value: undefined, loc: SourceOffsets): ASTv2.LiteralExpression & { value: undefined };
  literal(
    value: string | number | boolean | null | undefined,
    loc: SourceOffsets
  ): ASTv2.LiteralExpression;
  literal(
    value: string | number | boolean | null | undefined,
    loc: SourceOffsets
  ): ASTv2.LiteralExpression {
    return new LiteralExpression({
      loc,
      value,
    });
  }

  // STATEMENTS //

  append(
    { table, trusting, value }: { table: SymbolTable; trusting: boolean; value: ASTv2.Expression },
    loc: SourceOffsets
  ): ASTv2.AppendContent {
    return new AppendContent({
      table,
      trusting,
      value,
      loc,
    });
  }

  modifier({ callee, args }: CallParts, loc: SourceOffsets): ASTv2.ElementModifier {
    return new ElementModifier({
      loc,
      callee,
      args,
    });
  }

  namedBlocks(blocks: NamedBlock[], loc: SourceOffsets): ASTv2.NamedBlocks {
    return new NamedBlocks({
      loc,
      blocks,
    });
  }

  blockStatement(
    {
      symbols,
      program,
      inverse = null,
      ...call
    }: {
      symbols: SymbolTable;
      program: ASTv2.Block;
      inverse?: ASTv2.Block | null;
    } & CallParts,
    loc: SourceOffsets
  ): ASTv2.InvokeBlock {
    let blocksLoc = program.loc;
    let blocks: PresentArray<ASTv2.NamedBlock> = [
      this.namedBlock(SourceSlice.synthetic('default'), program, program.loc),
    ];
    if (inverse) {
      blocksLoc = blocksLoc.extend(inverse.loc);
      blocks.push(this.namedBlock(SourceSlice.synthetic('else'), inverse, inverse.loc));
    }

    return new InvokeBlock({
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
}

export class BuildElement {
  readonly builder: Builder;
  constructor(readonly base: BuildBaseElement) {
    this.builder = new Builder();
  }

  simple(tag: SourceSlice, body: ASTv2.ContentNode[], loc: SourceOffsets): ASTv2.SimpleElement {
    return new SimpleElement(
      assign(
        {
          tag,
          body,
          componentArgs: [],
          loc,
        },
        this.base
      )
    );
  }

  named(name: SourceSlice, block: ASTv2.Block, loc: SourceOffsets): ASTv2.NamedBlock {
    return new NamedBlock(
      assign(
        {
          name,
          block,
          componentArgs: [],
          loc,
        },
        this.base
      )
    );
  }

  selfClosingComponent(callee: ASTv2.Expression, loc: SourceOffsets): ASTv2.InvokeComponent {
    return new InvokeComponent(
      assign(
        {
          loc,
          callee,
          // point the empty named blocks at the `/` self-closing tag
          blocks: new NamedBlocks({ blocks: [], loc: loc.sliceTo({ skipEnd: 1, chars: 1 }) }),
        },
        this.base
      )
    );
  }

  componentWithDefaultBlock(
    callee: ASTv2.Expression,
    children: ASTv2.ContentNode[],
    symbols: BlockSymbolTable,
    loc: SourceOffsets
  ): ASTv2.InvokeComponent {
    let block = this.builder.block(symbols, children, loc);
    let namedBlock = this.builder.namedBlock(SourceSlice.synthetic('default'), block, loc); // BUILDER.simpleNamedBlock('default', children, symbols, loc);

    return new InvokeComponent(
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
    callee: ASTv2.Expression,
    blocks: PresentArray<ASTv2.NamedBlock>,
    loc: SourceOffsets
  ): ASTv2.InvokeComponent {
    return new InvokeComponent(
      assign(
        {
          loc,
          callee,
          blocks: this.builder.namedBlocks(blocks, SourceOffsetList.range(blocks)),
        },
        this.base
      )
    );
  }
}
