import { PresentArray } from '@glimmer/interfaces';
import { assert, assertPresent, assign } from '@glimmer/util';
import { SourceLocation, SYNTHETIC } from '../source/location';
import { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from '../symbol-table';
import * as ASTv2 from './nodes-v2';
import { FreeVarResolution, LiteralExpression } from './objects';
import { Args, Named, NamedEntry, Positional } from './objects/args';
import { InvokeBlock, InvokeComponent, SimpleElement } from './objects/content';
import {
  PathExpression,
  ExpressionNode,
  InterpolateExpression,
  CallExpression,
} from './objects/expr';
import { NamedBlock, NamedBlocks, SourceSlice } from './objects/internal';
import { ArgReference, LocalVarReference, ThisReference } from './objects/refs';

export interface CallParts {
  callee: ASTv2.Expression;
  args: ASTv2.Args;
}

class Builder {
  // TEMPLATE //

  template(
    symbols: ProgramSymbolTable,
    body: ASTv2.ContentNode[],
    loc?: SourceLocation
  ): ASTv2.Template {
    return {
      type: 'Template',
      table: symbols,
      body,
      loc: this.loc(loc),
    };
  }

  // INTERNAL (these nodes cannot be reached when doing general-purpose visiting) //

  block(symbols: BlockSymbolTable, body: ASTv2.ContentNode[], loc?: SourceLocation): ASTv2.Block {
    return {
      type: 'Block',
      table: symbols,
      body,
      loc: this.loc(loc),
    };
  }

  namedBlock(name: SourceSlice, block: ASTv2.Block, loc?: SourceLocation): ASTv2.NamedBlock {
    return {
      type: 'NamedBlock',
      name,
      block,
      attrs: [],
      args: [],
      modifiers: [],
      loc: this.loc(loc),
    };
  }

  simpleNamedBlock(name: SourceSlice, block: ASTv2.Block, loc?: SourceLocation): ASTv2.NamedBlock {
    return new BuildElement({
      selfClosing: false,
      attrs: [],
      args: [],
      modifiers: [],
      comments: [],
    }).named(name, block, loc);
  }

  slice(chars: string, loc?: SourceLocation): SourceSlice {
    return new SourceSlice({
      loc: this.loc(loc),
      chars,
    });
  }

  args(positional: ASTv2.Positional, named: ASTv2.Named, loc?: SourceLocation): ASTv2.Args {
    return new Args({
      loc: this.loc(loc),
      positional,
      named,
    });
  }

  positional(exprs: ASTv2.Expression[], loc?: SourceLocation): ASTv2.Positional {
    return new Positional({
      loc: this.loc(loc),
      exprs,
    });
  }

  namedEntry(key: SourceSlice, value: ExpressionNode, loc?: SourceLocation): ASTv2.NamedEntry {
    return new NamedEntry({
      loc: this.loc(loc),
      name: key,
      value,
    });
  }

  named(entries: ASTv2.NamedEntry[], loc?: SourceLocation): ASTv2.Named {
    return new Named({
      loc: this.loc(loc),
      entries,
    });
  }

  head(
    original: string,
    context: FreeVarResolution,
    loc?: SourceLocation
  ): { head: ASTv2.VariableReference; tail: string[] } {
    let [head, ...tail] = original.split('.');
    let headNode: ASTv2.VariableReference;

    if (head === 'this') {
      headNode = this.self(loc);
    } else if (head[0] === '@') {
      headNode = this.at(head, loc);
    } else if (head[0] === '^') {
      headNode = this.freeVar(this.slice(head.slice(1)), context, loc);
    } else {
      headNode = this.localVar(head, loc);
    }

    return {
      head: headNode,
      tail,
    };
  }

  attr(
    { name, value, trusting }: { name: SourceSlice; value: ASTv2.Expression; trusting: boolean },
    loc?: SourceLocation
  ): ASTv2.HtmlAttr {
    return {
      type: 'HtmlAttr',
      name,
      value,
      trusting,
      loc: this.loc(loc),
    };
  }

  arg(
    { name, value, trusting }: { name: SourceSlice; value: ASTv2.Expression; trusting: boolean },
    loc?: SourceLocation
  ): ASTv2.Arg {
    return {
      type: 'Arg',
      name,
      value,
      trusting,
      loc: this.loc(loc),
    };
  }

  // EXPRESSIONS //

  path(
    head: ASTv2.VariableReference,
    tail: SourceSlice[],
    loc?: SourceLocation
  ): ASTv2.PathExpression {
    return new PathExpression({
      loc: this.loc(loc),
      ref: head,
      tail,
    });
  }

  self(loc?: SourceLocation): ASTv2.VariableReference {
    return new ThisReference({
      loc: this.loc(loc),
    });
  }

  at(name: string, loc?: SourceLocation): ASTv2.VariableReference {
    // the `@` should be included so we have a complete source range
    assert(name[0] === '@', `call builders.at() with a string that starts with '@'`);

    return new ArgReference({
      loc: this.loc(loc),
      name: new SourceSlice({ loc: this.loc(loc), chars: name }),
    });
  }

  freeVar(
    name: SourceSlice,
    context: FreeVarResolution,
    loc?: SourceLocation
  ): ASTv2.VariableReference {
    assert(
      name.chars !== 'this',
      `You called builders.freeVar() with 'this'. Call builders.this instead`
    );
    assert(
      name.chars[0] !== '@',
      `You called builders.freeVar() with '${name}'. Call builders.at('${name}') instead`
    );

    return {
      type: 'FreeVarReference',
      name,
      resolution: context,
      loc: this.loc(loc),
    };
  }

  localVar(name: string, loc?: SourceLocation): ASTv2.VariableReference {
    assert(name !== 'this', `You called builders.var() with 'this'. Call builders.this instead`);
    assert(
      name[0] !== '@',
      `You called builders.var() with '${name}'. Call builders.at('${name}') instead`
    );

    return new LocalVarReference({
      loc: this.loc(loc),
      name,
    });
  }

  sexp(parts: CallParts, loc?: SourceLocation): ASTv2.CallExpression {
    return new CallExpression({
      loc: this.loc(loc),
      callee: parts.callee,
      args: parts.args,
    });
  }

  interpolate(parts: ASTv2.Expression[], loc?: SourceLocation): ASTv2.InterpolateExpression {
    return new InterpolateExpression({
      loc: this.loc(loc),
      parts: assertPresent(parts),
    });
  }

  literal(value: string, loc?: SourceLocation): ASTv2.LiteralExpression<'string'>;
  literal(value: number, loc?: SourceLocation): ASTv2.LiteralExpression<'number'>;
  literal(value: boolean, loc?: SourceLocation): ASTv2.LiteralExpression<'boolean'>;
  literal(value: null, loc?: SourceLocation): ASTv2.LiteralExpression<'null'>;
  literal(value: undefined, loc?: SourceLocation): ASTv2.LiteralExpression<'undefined'>;
  literal(
    value: string | number | boolean | null | undefined,
    loc?: SourceLocation
  ): ASTv2.LiteralExpression;
  literal(
    value: string | number | boolean | null | undefined,
    loc?: SourceLocation
  ): ASTv2.LiteralExpression {
    return new LiteralExpression({
      loc: this.loc(loc),
      value,
    });
  }

  // STATEMENTS //

  append(
    { table, trusting, value }: { table: SymbolTable; trusting: boolean; value: ASTv2.Expression },
    loc?: SourceLocation
  ): ASTv2.AppendContent {
    return {
      type: 'AppendContent',
      table,
      trusting,
      value,
      loc: this.loc(loc),
    } as const;
  }

  modifier(call: CallParts, loc?: SourceLocation): ASTv2.ElementModifier {
    return assign(
      {
        type: 'ElementModifier',
        loc: this.loc(loc),
      } as const,
      call
    );
  }

  namedBlocks(blocks: NamedBlock[], loc?: SourceLocation): ASTv2.NamedBlocks {
    return new NamedBlocks({
      loc: this.loc(loc),
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
    loc?: SourceLocation
  ): ASTv2.InvokeBlock {
    let blocks: PresentArray<ASTv2.NamedBlock> = [this.namedBlock(this.slice('default'), program)];
    if (inverse) {
      blocks.push(this.namedBlock(this.slice('else'), inverse));
    }

    return new InvokeBlock({
      loc: this.loc(loc),
      blocks: this.namedBlocks(blocks),
      callee: call.callee,
      args: call.args,
    });
  }

  element(options: BuildBaseElement): BuildElement {
    return new BuildElement(options);
  }

  // LOCATION //

  loc(...args: any[]): SourceLocation {
    if (args.length === 1) {
      let loc = args[0];

      if (loc && typeof loc === 'object') {
        return {
          source: loc.source || null,
          start: this.position(loc.start.line, loc.start.column),
          end: this.position(loc.end.line, loc.end.column),
        };
      } else {
        return SYNTHETIC;
      }
    } else {
      let [startLine, startColumn, endLine, endColumn, source] = args;
      return {
        source: source || null,
        start: this.position(startLine, startColumn),
        end: this.position(endLine, endColumn),
      };
    }
  }

  position(line: number, column: number) {
    return {
      line,
      column,
    };
  }
}

export interface BuildBaseElement {
  selfClosing: boolean;
  attrs: ASTv2.HtmlAttr[];
  args: ASTv2.Arg[];
  modifiers: ASTv2.ElementModifier[];
  comments: ASTv2.GlimmerComment[];
}

export class BuildElement {
  constructor(readonly base: BuildBaseElement) {}

  simple(tag: string, body: ASTv2.ContentNode[], loc?: SourceLocation): ASTv2.SimpleElement {
    return new SimpleElement(
      assign(
        {
          tag: new SourceSlice({
            chars: tag,
            loc: SYNTHETIC,
          }),
          body,
          args: [],
          loc: BUILDER.loc(loc),
        },
        this.base
      )
    );
  }

  named(name: SourceSlice, block: ASTv2.Block, loc?: SourceLocation): ASTv2.NamedBlock {
    return new NamedBlock(
      assign(
        {
          name,
          block,
          args: [],
          loc: BUILDER.loc(loc),
        },
        this.base
      )
    );
  }

  selfClosingComponent(callee: ASTv2.Expression, loc?: SourceLocation): ASTv2.InvokeComponent {
    return new InvokeComponent(
      assign(
        {
          loc: BUILDER.loc(loc),
          callee,
          blocks: [],
        },
        this.base
      )
    );
  }

  componentWithDefaultBlock(
    callee: ASTv2.Expression,
    children: ASTv2.ContentNode[],
    symbols: BlockSymbolTable,
    loc?: SourceLocation
  ): ASTv2.InvokeComponent {
    let block = BUILDER.block(symbols, children, loc);
    let namedBlock = BUILDER.namedBlock(
      new SourceSlice({
        loc: SYNTHETIC,
        chars: 'default',
      }),
      block,
      loc
    ); // BUILDER.simpleNamedBlock('default', children, symbols, loc);

    return new InvokeComponent(
      assign(
        {
          loc: BUILDER.loc(loc),
          callee,
          blocks: [namedBlock],
        },
        this.base
      )
    );
  }

  componentWithNamedBlocks(
    callee: ASTv2.Expression,
    blocks: PresentArray<ASTv2.NamedBlock>,
    loc?: SourceLocation
  ): ASTv2.InvokeComponent {
    return new InvokeComponent(
      assign(
        {
          loc: BUILDER.loc(loc),
          callee,
          blocks,
        },
        this.base
      )
    );
  }
}

const BUILDER = new Builder();
export default BUILDER;
