import { assert, assign } from '@glimmer/util';
import { ExpressionContext, PresentArray } from '@glimmer/interfaces';
import { SourceLocation } from './types/nodes-v1';
import * as ASTv2 from './types/nodes-v2';
import { SYNTHETIC } from './v1-builders';
import { BlockSymbolTable } from './symbol-table';

export function buildHead(
  original: string,
  context: ExpressionContext,
  loc?: ASTv2.SourceLocation
): { head: ASTv2.PathHead; tail: string[] } {
  let [head, ...tail] = original.split('.');
  let headNode: ASTv2.PathHead;

  if (head === 'this') {
    headNode = buildThis(loc);
  } else if (head[0] === '@') {
    headNode = buildAtName(head, loc);
  } else if (head[0] === '^') {
    headNode = buildFreeVar(head.slice(1), context, loc);
  } else {
    headNode = buildLocalVar(head, loc);
  }

  return {
    head: headNode,
    tail,
  };
}

function buildThis(loc?: ASTv2.SourceLocation): ASTv2.PathHead {
  return {
    type: 'ThisHead',
    loc: buildLoc(loc || null),
  };
}

function buildAtName(name: string, loc?: ASTv2.SourceLocation): ASTv2.PathHead {
  // the `@` should be included so we have a complete source range
  assert(name[0] === '@', `call builders.at() with a string that starts with '@'`);

  return {
    type: 'AtHead',
    name,
    loc: buildLoc(loc || null),
  };
}

function buildFreeVar(
  name: string,
  context: ExpressionContext,
  loc?: ASTv2.SourceLocation
): ASTv2.PathHead {
  assert(name !== 'this', `You called builders.freeVar() with 'this'. Call builders.this instead`);
  assert(
    name[0] !== '@',
    `You called builders.freeVar() with '${name}'. Call builders.at('${name}') instead`
  );

  return {
    type: 'FreeVarHead',
    name,
    context,
    loc: buildLoc(loc || null),
  };
}

function buildLocalVar(name: string, loc?: ASTv2.SourceLocation): ASTv2.PathHead {
  assert(name !== 'this', `You called builders.var() with 'this'. Call builders.this instead`);
  assert(
    name[0] !== '@',
    `You called builders.var() with '${name}'. Call builders.at('${name}') instead`
  );

  return {
    type: 'LocalVarHead',
    name,
    loc: buildLoc(loc || null),
  };
}

function buildBlockName(name: string, loc?: ASTv2.SourceLocation): ASTv2.NamedBlockName {
  return {
    type: 'NamedBlockName',
    name,
    loc: buildLoc(loc || null),
  };
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
        loc: buildLoc(loc),
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
        blockName: buildBlockName(name),
        children,
        symbols,
        loc: buildLoc(loc),
      } as const,
      this.options
    );
  }

  componentWithDefaultBlock(
    head: ASTv2.Expression,
    children: ASTv2.Statement[],
    symbols: BlockSymbolTable,
    loc?: SourceLocation
  ): ASTv2.ComponentNode {
    let block =
      children.length === 0 ? null : buildSimpleNamedBlock('default', children, symbols, loc);

    return assign(
      {
        type: 'Component',
        head,
        blocks: block,
        loc: buildLoc(loc),
      } as const,
      this.options
    );
  }

  componentWithNamedBlocks(
    head: ASTv2.Expression,
    blocks: PresentArray<ASTv2.NamedBlockNode>,
    loc?: SourceLocation
  ): ASTv2.ComponentNode {
    return assign(
      {
        type: 'Component',
        head,
        blocks,
        loc: buildLoc(loc),
      } as const,
      this.options
    );
  }
}

function buildElement(options: BuildBaseElement): BuildElement {
  return new BuildElement(options);
}

function buildSimpleNamedBlock(
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

function buildPath(
  head: ASTv2.PathHead,
  tail: string[],
  loc?: ASTv2.SourceLocation
): ASTv2.PathExpression {
  return {
    type: 'PathExpression',
    head,
    tail,
    loc: buildLoc(loc || null),
  };
}

function buildLoc(...args: any[]): ASTv2.SourceLocation {
  if (args.length === 1) {
    let loc = args[0];

    if (loc && typeof loc === 'object') {
      return {
        source: loc.source || null,
        start: buildPosition(loc.start.line, loc.start.column),
        end: buildPosition(loc.end.line, loc.end.column),
      };
    } else {
      return SYNTHETIC;
    }
  } else {
    let [startLine, startColumn, endLine, endColumn, source] = args;
    return {
      source: source || null,
      start: buildPosition(startLine, startColumn),
      end: buildPosition(endLine, endColumn),
    };
  }
}

function buildLiteral(value: string, loc?: SourceLocation): ASTv2.Literal<'string'>;
function buildLiteral(value: number, loc?: SourceLocation): ASTv2.Literal<'number'>;
function buildLiteral(value: boolean, loc?: SourceLocation): ASTv2.Literal<'boolean'>;
function buildLiteral(value: null, loc?: SourceLocation): ASTv2.Literal<'null'>;
function buildLiteral(value: undefined, loc?: SourceLocation): ASTv2.Literal<'undefined'>;
function buildLiteral(
  value: string | number | boolean | null | undefined,
  loc?: SourceLocation
): ASTv2.Literal {
  if (value === null) {
    return {
      type: 'Literal',
      kind: 'null',
      value: null,
      loc: buildLoc(loc),
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

function buildPosition(line: number, column: number) {
  return {
    line,
    column,
  };
}

export default {
  head: buildHead,
  localVar: buildLocalVar,
  freeVar: buildFreeVar,
  this: buildThis,
  at: buildAtName,
  path: buildPath,
  blockName: buildBlockName,
  literal: buildLiteral,
  element: buildElement,
};
