import { Dict, Optional } from '@glimmer/interfaces';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { assert, assign, deprecate, isPresent } from '@glimmer/util';
import { SYNTHETIC_LOCATION } from '../source/location';
import type { SourceOffsets } from '../source/offsets/abstract';
import { BROKEN } from '../source/offsets/invisible';
import { LazySourceOffsets } from '../source/offsets/lazy';
import { Source } from '../source/source';
import * as AST from '../types/api';

const SOURCE = new Source('', '(tests)');

// Statements

export type BuilderHead = string | AST.PathExpression;
export type TagDescriptor = string | { name: string; selfClosing: boolean };

function buildMustache(
  path: BuilderHead | AST.Literal,
  params?: AST.Expression[],
  hash?: AST.Hash,
  raw?: boolean,
  loc?: AST.SourceLocation,
  strip?: AST.StripFlags
): AST.MustacheStatement {
  if (typeof path === 'string') {
    path = buildPath(path);
  }

  return {
    type: 'MustacheStatement',
    path,
    params: params || [],
    hash: hash || buildHash([]),
    escaped: !raw,
    trusting: !!raw,
    loc: buildLoc(loc || null),
    strip: strip || { open: false, close: false },
  };
}

function buildBlock(
  path: BuilderHead,
  params: Optional<AST.Expression[]>,
  hash: Optional<AST.Hash>,
  _defaultBlock: AST.PossiblyDeprecatedBlock,
  _elseBlock?: Optional<AST.PossiblyDeprecatedBlock>,
  loc?: AST.SourceLocation,
  openStrip?: AST.StripFlags,
  inverseStrip?: AST.StripFlags,
  closeStrip?: AST.StripFlags
): AST.BlockStatement {
  let defaultBlock: AST.Block;
  let elseBlock: Optional<AST.Block> | undefined;

  if (_defaultBlock.type === 'Template') {
    if (LOCAL_DEBUG) {
      deprecate(`b.program is deprecated. Use b.blockItself instead.`);
    }

    defaultBlock = (assign({}, _defaultBlock, { type: 'Block' }) as unknown) as AST.Block;
  } else {
    defaultBlock = _defaultBlock;
  }

  if (_elseBlock !== undefined && _elseBlock !== null && _elseBlock.type === 'Template') {
    if (LOCAL_DEBUG) {
      deprecate(`b.program is deprecated. Use b.blockItself instead.`);
    }

    elseBlock = (assign({}, _elseBlock, { type: 'Block' }) as unknown) as AST.Block;
  } else {
    elseBlock = _elseBlock;
  }

  return {
    type: 'BlockStatement',
    path: buildPath(path),
    params: params || [],
    hash: hash || buildHash([]),
    program: defaultBlock || null,
    inverse: elseBlock || null,
    loc: buildLoc(loc || null),
    openStrip: openStrip || { open: false, close: false },
    inverseStrip: inverseStrip || { open: false, close: false },
    closeStrip: closeStrip || { open: false, close: false },
  };
}

function buildElementModifier(
  path: BuilderHead | AST.Expression,
  params?: AST.Expression[],
  hash?: AST.Hash,
  loc?: Optional<AST.SourceLocation>
): AST.ElementModifierStatement {
  return {
    type: 'ElementModifierStatement',
    path: buildPath(path),
    params: params || [],
    hash: hash || buildHash([]),
    loc: buildLoc(loc || null),
  };
}

function buildPartial(
  name: AST.PathExpression,
  params?: AST.Expression[],
  hash?: AST.Hash,
  indent?: string,
  loc?: AST.SourceLocation
): AST.PartialStatement {
  return {
    type: 'PartialStatement',
    name: name,
    params: params || [],
    hash: hash || buildHash([]),
    indent: indent || '',
    strip: { open: false, close: false },
    loc: buildLoc(loc || null),
  };
}

function buildComment(value: string, loc?: AST.SourceLocation): AST.CommentStatement {
  return {
    type: 'CommentStatement',
    value: value,
    loc: buildLoc(loc || null),
  };
}

function buildMustacheComment(
  value: string,
  loc?: AST.SourceLocation
): AST.MustacheCommentStatement {
  return {
    type: 'MustacheCommentStatement',
    value: value,
    loc: buildLoc(loc || null),
  };
}

function buildConcat(
  parts: (AST.TextNode | AST.MustacheStatement)[],
  loc?: AST.SourceLocation
): AST.ConcatStatement {
  if (!isPresent(parts)) {
    throw new Error(`b.concat requires at least one part`);
  }

  return {
    type: 'ConcatStatement',
    parts: parts || [],
    loc: buildLoc(loc || null),
  };
}

// Nodes

export type ElementParts =
  | ['attrs', ...AttrSexp[]]
  | ['modifiers', ...ModifierSexp[]]
  | ['body', ...AST.Statement[]]
  | ['comments', ...ElementComment[]]
  | ['as', ...string[]]
  | ['loc', AST.SourceLocation];

export type PathSexp = string | ['path', string, LocSexp?];

export type ModifierSexp =
  | string
  | [PathSexp, LocSexp?]
  | [PathSexp, AST.Expression[], LocSexp?]
  | [PathSexp, AST.Expression[], Dict<AST.Expression>, LocSexp?];

export type AttrSexp = [string, AST.AttrNode['value'] | string, LocSexp?];

export type LocSexp = ['loc', AST.SourceLocation];

export type ElementComment = AST.MustacheCommentStatement | AST.SourceLocation | string;

export type SexpValue =
  | string
  | AST.Expression[]
  | Dict<AST.Expression>
  | LocSexp
  | PathSexp
  | undefined;

export interface BuildElementOptions {
  attrs?: AST.AttrNode[];
  modifiers?: AST.ElementModifierStatement[];
  children?: AST.Statement[];
  comments?: ElementComment[];
  blockParams?: string[];
  loc: SourceOffsets;
}

function buildElement(tag: TagDescriptor, options: BuildElementOptions): AST.ElementNode {
  let { attrs, blockParams, modifiers, comments, children, loc } = options;

  let tagName: string;

  // this is used for backwards compat, prior to `selfClosing` being part of the ElementNode AST
  let selfClosing = false;
  if (typeof tag === 'object') {
    selfClosing = tag.selfClosing;
    tagName = tag.name;
  } else if (tag.slice(-1) === '/') {
    tagName = tag.slice(0, -1);
    selfClosing = true;
  } else {
    tagName = tag;
  }

  return {
    type: 'ElementNode',
    tag: tagName,
    selfClosing: selfClosing,
    attributes: attrs || [],
    blockParams: blockParams || [],
    modifiers: modifiers || [],
    comments: (comments as AST.MustacheCommentStatement[]) || [],
    children: children || [],
    loc,
  };
}

function buildAttr(
  name: string,
  value: AST.AttrNode['value'],
  loc?: AST.SourceLocation
): AST.AttrNode {
  return {
    type: 'AttrNode',
    name: name,
    value: value,
    loc: buildLoc(loc || null),
  };
}

function buildText(chars?: string, loc?: AST.SourceLocation): AST.TextNode {
  return {
    type: 'TextNode',
    chars: chars || '',
    loc: buildLoc(loc || null),
  };
}

// Expressions

function buildSexpr(
  path: BuilderHead,
  params?: AST.Expression[],
  hash?: AST.Hash,
  loc?: AST.SourceLocation
): AST.SubExpression {
  return {
    type: 'SubExpression',
    path: buildPath(path),
    params: params || [],
    hash: hash || buildHash([]),
    loc: buildLoc(loc || null),
  };
}

function headToString(head: AST.PathHead): { original: string; parts: string[] } {
  switch (head.type) {
    case 'AtHead':
      return { original: head.name, parts: [head.name] };
    case 'ThisHead':
      return { original: `this`, parts: [] };
    case 'VarHead':
      return { original: head.name, parts: [head.name] };
  }
}

function buildHead(
  original: string,
  loc: AST.SourceLocation
): { head: AST.PathHead; tail: string[] } {
  let [head, ...tail] = original.split('.');
  let headNode: AST.PathHead;

  if (head === 'this') {
    headNode = {
      type: 'ThisHead',
      loc: buildLoc(loc || null),
    };
  } else if (head[0] === '@') {
    headNode = {
      type: 'AtHead',
      name: head,
      loc: buildLoc(loc || null),
    };
  } else {
    headNode = {
      type: 'VarHead',
      name: head,
      loc: buildLoc(loc || null),
    };
  }

  return {
    head: headNode,
    tail,
  };
}

function buildThis(loc: AST.SourceLocation): AST.PathHead {
  return {
    type: 'ThisHead',
    loc: buildLoc(loc || null),
  };
}

function buildAtName(name: string, loc: AST.SourceLocation): AST.PathHead {
  // the `@` should be included so we have a complete source range
  assert(name[0] === '@', `call builders.at() with a string that starts with '@'`);

  return {
    type: 'AtHead',
    name,
    loc: buildLoc(loc || null),
  };
}

function buildVar(name: string, loc: AST.SourceLocation): AST.PathHead {
  assert(name !== 'this', `You called builders.var() with 'this'. Call builders.this instead`);
  assert(
    name[0] !== '@',
    `You called builders.var() with '${name}'. Call builders.at('${name}') instead`
  );

  return {
    type: 'VarHead',
    name,
    loc: buildLoc(loc || null),
  };
}

function buildHeadFromString(head: string, loc: AST.SourceLocation): AST.PathHead {
  if (head[0] === '@') {
    return buildAtName(head, loc);
  } else if (head === 'this') {
    return buildThis(loc);
  } else {
    return buildVar(head, loc);
  }
}

function buildNamedBlockName(name: string, loc?: AST.SourceLocation): AST.NamedBlockName {
  return {
    type: 'NamedBlockName',
    name,
    loc: buildLoc(loc || null),
  };
}

function buildCleanPath(
  head: AST.PathHead,
  tail: string[],
  loc: AST.SourceLocation
): AST.PathExpression {
  let { original: originalHead, parts: headParts } = headToString(head);
  let parts = [...headParts, ...tail];
  let original = [...originalHead, ...parts].join('.');

  return {
    type: 'PathExpression',
    head,
    tail,
    original,
    parts,
    loc: buildLoc(loc || null),
  };
}

function buildPath(
  path: AST.PathExpression | string | { head: string; tail: string[] },
  loc?: AST.SourceLocation
): AST.PathExpression;
function buildPath(path: AST.Expression, loc?: AST.SourceLocation): AST.Expression;
function buildPath(path: BuilderHead | AST.Expression, loc?: AST.SourceLocation): AST.Expression;
function buildPath(
  path: BuilderHead | AST.Expression | { head: string; tail: string[] },
  loc?: AST.SourceLocation
): AST.Expression {
  if (typeof path !== 'string') {
    if ('type' in path) {
      return path;
    } else {
      let { head, tail } = buildHead(path.head, BROKEN());

      assert(
        tail.length === 0,
        `builder.path({ head, tail }) should not be called with a head with dots in it`
      );

      let { original: originalHead, parts: headParts } = headToString(head);

      return {
        type: 'PathExpression',
        original: [originalHead, ...tail].join('.'),
        head,
        tail,
        parts: [...headParts, ...tail],
        loc: buildLoc(loc || null),
      };
    }
  }

  let { head, tail } = buildHead(path, BROKEN());
  let { parts: headParts } = headToString(head);

  return {
    type: 'PathExpression',
    original: path,
    head,
    tail,
    parts: [...headParts, ...tail],
    loc: buildLoc(loc || null),
  };
}

function buildLiteral<T extends AST.Literal>(
  type: T['type'],
  value: T['value'],
  loc?: AST.SourceLocation
): T {
  return {
    type,
    value,
    original: value,
    loc: buildLoc(loc || null),
  } as T;
}

// Miscellaneous

function buildHash(pairs?: AST.HashPair[], loc?: AST.SourceLocation): AST.Hash {
  return {
    type: 'Hash',
    pairs: pairs || [],
    loc: buildLoc(loc || null),
  };
}

function buildPair(key: string, value: AST.Expression, loc?: AST.SourceLocation): AST.HashPair {
  return {
    type: 'HashPair',
    key: key,
    value,
    loc: buildLoc(loc || null),
  };
}

function buildProgram(
  body?: AST.Statement[],
  blockParams?: string[],
  loc?: AST.SourceLocation
): AST.Template {
  return {
    type: 'Template',
    body: body || [],
    blockParams: blockParams || [],
    loc: buildLoc(loc || null),
  };
}

function buildBlockItself(
  body?: AST.Statement[],
  blockParams?: string[],
  chained = false,
  loc?: AST.SourceLocation
): AST.Block {
  return {
    type: 'Block',
    body: body || [],
    blockParams: blockParams || [],
    chained,
    loc: buildLoc(loc || null),
  };
}

function buildTemplate(
  body?: AST.Statement[],
  blockParams?: string[],
  loc?: AST.SourceLocation
): AST.Template {
  return {
    type: 'Template',
    body: body || [],
    blockParams: blockParams || [],
    loc: buildLoc(loc || null),
  };
}

function buildPosition(line: number, column: number) {
  return {
    line,
    column,
  };
}

function buildLoc(loc: Optional<AST.SourceLocation>): SourceOffsets;
function buildLoc(
  startLine: number,
  startColumn: number,
  endLine?: number,
  endColumn?: number
): SourceOffsets;

function buildLoc(...args: any[]): SourceOffsets {
  if (args.length === 1) {
    let loc = args[0];

    if (loc && typeof loc === 'object') {
      return new LazySourceOffsets(SOURCE, loc);
    } else {
      return new LazySourceOffsets(SOURCE, SYNTHETIC_LOCATION);
    }
  } else {
    let [startLine, startColumn, endLine, endColumn] = args;
    return new LazySourceOffsets(SOURCE, {
      start: {
        line: startLine,
        column: startColumn,
      },
      end: {
        line: endLine,
        column: endColumn,
      },
    });
  }
}

export default {
  mustache: buildMustache,
  block: buildBlock,
  partial: buildPartial,
  comment: buildComment,
  mustacheComment: buildMustacheComment,
  element: buildElement,
  elementModifier: buildElementModifier,
  attr: buildAttr,
  text: buildText,
  sexpr: buildSexpr,

  concat: buildConcat,
  hash: buildHash,
  pair: buildPair,
  literal: buildLiteral,
  program: buildProgram,
  blockItself: buildBlockItself,
  template: buildTemplate,
  loc: buildLoc,
  pos: buildPosition,

  path: buildPath,

  fullPath: buildCleanPath,
  head: buildHeadFromString,
  at: buildAtName,
  var: buildVar,
  this: buildThis,
  blockName: buildNamedBlockName,

  string: literal('StringLiteral') as (value: string) => AST.StringLiteral,
  boolean: literal('BooleanLiteral') as (value: boolean) => AST.BooleanLiteral,
  number: literal('NumberLiteral') as (value: number) => AST.NumberLiteral,
  undefined() {
    return buildLiteral('UndefinedLiteral', undefined);
  },
  null() {
    return buildLiteral('NullLiteral', null);
  },
};

type BuildLiteral<T extends AST.Literal> = (value: T['value']) => T;

function literal<T extends AST.Literal>(type: T['type']): BuildLiteral<T> {
  return function (value: T['value'], loc?: AST.SourceLocation): T {
    return buildLiteral(type, value, loc);
  };
}
