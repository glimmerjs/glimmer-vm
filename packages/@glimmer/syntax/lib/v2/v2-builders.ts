import { assert, assertPresent, assign } from '@glimmer/util';
import { VariableResolution, PresentArray } from '@glimmer/interfaces';
import { SourceLocation } from '../types/nodes-v1';
import * as ASTv2 from './nodes-v2';
import { SYNTHETIC } from '../v1-builders';
import { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from '../symbol-table';

export interface CallParts {
  func: ASTv2.Expression;
  params: ASTv2.InternalExpression[];
  hash: ASTv2.Hash;
}

class Builder {
  // TEMPLATE //

  template(
    symbols: ProgramSymbolTable,
    body: ASTv2.Statement[],
    loc?: SourceLocation
  ): ASTv2.Template {
    return {
      type: 'Template',
      symbols,
      body,
      loc: this.loc(loc),
    };
  }

  // INTERNAL (these nodes cannot be reached when doing general-purpose visiting) //

  block(symbols: BlockSymbolTable, body: ASTv2.Statement[], loc?: SourceLocation): ASTv2.Block {
    return {
      type: 'Block',
      symbols,
      body,
      loc: this.loc(loc),
    };
  }

  simpleNamedBlock(
    name: string,
    children: ASTv2.Statement[],
    symbols: BlockSymbolTable,
    loc?: SourceLocation
  ): ASTv2.NamedBlockNode {
    return new BuildElement({
      selfClosing: false,
      attributes: [],
      modifiers: [],
      comments: [],
    }).named(name, children, symbols, loc);
  }

  blockName(name: string, loc?: ASTv2.SourceLocation): ASTv2.NamedBlockName {
    return {
      type: 'NamedBlockName',
      name,
      loc: this.loc(loc),
    };
  }

  pair(key: string, value: ASTv2.InternalExpression, loc?: ASTv2.SourceLocation): ASTv2.HashPair {
    return {
      type: 'HashPair',
      key,
      value,
      loc: this.loc(loc),
    };
  }

  hash(pairs: ASTv2.HashPair[], loc?: ASTv2.SourceLocation): ASTv2.Hash {
    return {
      type: 'Hash',
      pairs,
      loc: this.loc(loc),
    };
  }

  head(
    original: string,
    context: VariableResolution,
    loc?: ASTv2.SourceLocation
  ): { head: ASTv2.PathHead; tail: string[] } {
    let [head, ...tail] = original.split('.');
    let headNode: ASTv2.PathHead;

    if (head === 'this') {
      headNode = this.this(loc);
    } else if (head[0] === '@') {
      headNode = this.at(head, loc);
    } else if (head[0] === '^') {
      headNode = this.freeVar(head.slice(1), context, loc);
    } else {
      headNode = this.localVar(head, loc);
    }

    return {
      head: headNode,
      tail,
    };
  }

  attr(
    { name, value, trusting }: { name: string; value: ASTv2.InternalExpression; trusting: boolean },
    loc?: SourceLocation
  ): ASTv2.AttrNode {
    return {
      type: 'AttrNode',
      name,
      value,
      trusting,
      loc: this.loc(loc),
    };
  }

  // EXPRESSIONS //

  path(head: ASTv2.PathHead, tail: string[], loc?: ASTv2.SourceLocation): ASTv2.PathExpression {
    return {
      type: 'PathExpression',
      head,
      tail,
      loc: this.loc(loc),
    };
  }

  this(loc?: ASTv2.SourceLocation): ASTv2.PathHead {
    return {
      type: 'ThisHead',
      loc: this.loc(loc),
    };
  }

  at(name: string, loc?: ASTv2.SourceLocation): ASTv2.PathHead {
    // the `@` should be included so we have a complete source range
    assert(name[0] === '@', `call builders.at() with a string that starts with '@'`);

    return {
      type: 'AtHead',
      name,
      loc: this.loc(loc),
    };
  }

  freeVar(name: string, context: VariableResolution, loc?: ASTv2.SourceLocation): ASTv2.PathHead {
    assert(
      name !== 'this',
      `You called builders.freeVar() with 'this'. Call builders.this instead`
    );
    assert(
      name[0] !== '@',
      `You called builders.freeVar() with '${name}'. Call builders.at('${name}') instead`
    );

    return {
      type: 'FreeVarHead',
      name,
      context,
      loc: this.loc(loc),
    };
  }

  localVar(name: string, loc?: ASTv2.SourceLocation): ASTv2.PathHead {
    assert(name !== 'this', `You called builders.var() with 'this'. Call builders.this instead`);
    assert(
      name[0] !== '@',
      `You called builders.var() with '${name}'. Call builders.at('${name}') instead`
    );

    return {
      type: 'LocalVarHead',
      name,
      loc: this.loc(loc),
    };
  }

  sexp(parts: CallParts, loc?: SourceLocation): ASTv2.SubExpression {
    return assign(
      {
        type: 'SubExpression',
        loc: this.loc(loc),
      } as const,
      parts
    );
  }

  interpolate(parts: ASTv2.InternalExpression[], loc?: SourceLocation): ASTv2.Interpolate {
    return {
      type: 'Interpolate',
      parts: assertPresent(parts),
      loc: this.loc(loc),
    };
  }

  literal(value: string, loc?: SourceLocation): ASTv2.Literal<'string'>;
  literal(value: number, loc?: SourceLocation): ASTv2.Literal<'number'>;
  literal(value: boolean, loc?: SourceLocation): ASTv2.Literal<'boolean'>;
  literal(value: null, loc?: SourceLocation): ASTv2.Literal<'null'>;
  literal(value: undefined, loc?: SourceLocation): ASTv2.Literal<'undefined'>;
  literal(value: string | number | boolean | null | undefined, loc?: SourceLocation): ASTv2.Literal;
  literal(
    value: string | number | boolean | null | undefined,
    loc?: SourceLocation
  ): ASTv2.Literal {
    if (value === null) {
      return {
        type: 'Literal',
        kind: 'null',
        value: null,
        loc: this.loc(loc),
      };
    }

    switch (typeof value) {
      case 'string':
        return {
          type: 'Literal',
          kind: 'string',
          value,
          loc: loc || SYNTHETIC,
        };

      case 'number':
        return {
          type: 'Literal',
          kind: 'number',
          value,
          loc: loc || SYNTHETIC,
        };

      case 'boolean':
        return {
          type: 'Literal',
          kind: 'boolean',
          value,
          loc: loc || SYNTHETIC,
        };

      case 'undefined':
        return {
          type: 'Literal',
          kind: 'undefined',
          value: undefined,
          loc: loc || SYNTHETIC,
        };
    }
  }

  // STATEMENTS //

  append(
    {
      symbols,
      trusting,
      value,
    }: { symbols: SymbolTable; trusting: boolean; value: ASTv2.Expression },
    loc?: SourceLocation
  ): ASTv2.AppendStatement {
    return {
      type: 'AppendStatement',
      symbols,
      trusting,
      value,
      loc: this.loc(loc),
    } as const;
  }

  modifier(call: CallParts, loc?: SourceLocation): ASTv2.ElementModifierStatement {
    return assign(
      {
        type: 'ElementModifierStatement',
        loc: this.loc(loc),
      } as const,
      call
    );
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
  ): ASTv2.BlockStatement {
    return assign(
      {
        type: 'BlockStatement',
        symbols,
        program,
        inverse,
        loc: this.loc(loc),
      } as const,
      call
    );
  }

  element(options: BuildBaseElement): BuildElement {
    return new BuildElement(options);
  }

  // LOCATION //

  loc(...args: any[]): ASTv2.SourceLocation {
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
  attributes: ASTv2.AttrNode[];
  modifiers: ASTv2.ElementModifierStatement[];
  comments: ASTv2.MustacheCommentStatement[];
}

class BuildElement {
  constructor(private options: BuildBaseElement) {}

  simple(
    tag: string,
    children: ASTv2.Statement[],
    symbols: BlockSymbolTable,
    loc?: SourceLocation
  ): ASTv2.SimpleElementNode {
    return assign(
      {
        type: 'SimpleElement',
        symbols,
        tag,
        children,
        loc: BUILDER.loc(loc),
      } as const,
      this.options
    );
  }

  named(
    name: string,
    children: ASTv2.Statement[],
    symbols: BlockSymbolTable,
    loc?: SourceLocation
  ): ASTv2.NamedBlockNode {
    return assign(
      {
        type: 'NamedBlock',
        blockName: BUILDER.blockName(name),
        children,
        symbols,
        loc: BUILDER.loc(loc),
      } as const,
      this.options
    );
  }

  selfClosingComponent(head: ASTv2.InternalExpression, loc?: SourceLocation): ASTv2.ComponentNode {
    return assign(
      {
        type: 'Component',
        head,
        blocks: null,
        loc: BUILDER.loc(loc),
      } as const,
      this.options
    );
  }

  componentWithDefaultBlock(
    head: ASTv2.InternalExpression,
    children: ASTv2.Statement[],
    symbols: BlockSymbolTable,
    loc?: SourceLocation
  ): ASTv2.ComponentNode {
    let block = BUILDER.simpleNamedBlock('default', children, symbols, loc);

    return assign(
      {
        type: 'Component',
        head,
        blocks: block,
        loc: BUILDER.loc(loc),
      } as const,
      this.options
    );
  }

  componentWithNamedBlocks(
    head: ASTv2.InternalExpression,
    blocks: PresentArray<ASTv2.NamedBlockNode>,
    loc?: SourceLocation
  ): ASTv2.ComponentNode {
    return assign(
      {
        type: 'Component',
        head,
        blocks,
        loc: BUILDER.loc(loc),
      } as const,
      this.options
    );
  }
}

const BUILDER = new Builder();
export default BUILDER;
