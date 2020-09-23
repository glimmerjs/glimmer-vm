import { Dict, Optional, PresentArray } from '@glimmer/interfaces';
import { assert } from '@glimmer/util';
import { Builder } from '../parser';
import type { SourceOffset, SourceOffsets } from '../source/offsets/abstract';
import * as AST from '../types/api';

const DEFAULT_STRIP = {
  close: false,
  open: false,
};

/**
 * The Parser Builder differentiates from the public builder API by:
 *
 * 1. Offering fewer different ways to instantiate nodes
 * 2. Mandating source locations
 */
class Builders {
  pos(line: number, column: number) {
    return {
      line,
      column,
    };
  }

  blockItself({
    body,
    blockParams,
    chained = false,
    loc,
  }: {
    body?: AST.Statement[];
    blockParams?: string[];
    chained?: boolean;
    loc: SourceOffsets;
  }): AST.Block {
    return {
      type: 'Block',
      body: body || [],
      blockParams: blockParams || [],
      chained,
      loc,
    };
  }

  template({
    body,
    blockParams,
    loc,
  }: {
    body?: AST.Statement[];
    blockParams?: string[];
    loc: SourceOffsets;
  }): AST.Template {
    return {
      type: 'Template',
      body: body || [],
      blockParams: blockParams || [],
      loc,
    };
  }

  mustache({
    path,
    params,
    hash,
    trusting,
    loc,
    strip = DEFAULT_STRIP,
  }: {
    path: AST.Expression;
    params: AST.Expression[];
    hash: AST.Hash;
    trusting: boolean;
    loc: SourceOffsets;
    strip: AST.StripFlags;
  }): AST.MustacheStatement {
    return {
      type: 'MustacheStatement',
      path,
      params,
      hash,
      escaped: !trusting,
      trusting,
      loc,
      strip: strip || { open: false, close: false },
    };
  }

  block({
    path,
    params,
    hash,
    defaultBlock,
    elseBlock = null,
    loc,
    openStrip = DEFAULT_STRIP,
    inverseStrip = DEFAULT_STRIP,
    closeStrip = DEFAULT_STRIP,
  }: {
    path: AST.PathExpression;
    params: AST.Expression[];
    hash: AST.Hash;
    defaultBlock: AST.Block;
    elseBlock?: Optional<AST.Block>;
    loc: SourceOffsets;
    openStrip: AST.StripFlags;
    inverseStrip: AST.StripFlags;
    closeStrip: AST.StripFlags;
  }): AST.BlockStatement {
    return {
      type: 'BlockStatement',
      path: path,
      params,
      hash,
      program: defaultBlock,
      inverse: elseBlock,
      loc: loc,
      openStrip: openStrip,
      inverseStrip: inverseStrip,
      closeStrip: closeStrip,
    };
  }

  comment(value: string, loc: SourceOffset): Builder<AST.CommentStatement> {
    return {
      type: 'CommentStatement',
      value: value,
      loc,
    };
  }

  mustacheComment(value: string, loc: SourceOffsets): AST.MustacheCommentStatement {
    return {
      type: 'MustacheCommentStatement',
      value: value,
      loc,
    };
  }

  concat(
    parts: PresentArray<AST.TextNode | AST.MustacheStatement>,
    loc: SourceOffsets
  ): AST.ConcatStatement {
    return {
      type: 'ConcatStatement',
      parts,
      loc,
    };
  }

  element({
    tag,
    selfClosing,
    attrs,
    blockParams,
    modifiers,
    comments,
    children,
    loc,
  }: BuildElementOptions): AST.ElementNode {
    return {
      type: 'ElementNode',
      tag,
      selfClosing: selfClosing,
      attributes: attrs || [],
      blockParams: blockParams || [],
      modifiers: modifiers || [],
      comments: (comments as AST.MustacheCommentStatement[]) || [],
      children: children || [],
      loc,
    };
  }

  elementModifier({
    path,
    params,
    hash,
    loc,
  }: {
    path: AST.PathExpression | AST.SubExpression;
    params: AST.Expression[];
    hash: AST.Hash;
    loc: SourceOffsets;
  }): AST.ElementModifierStatement {
    return {
      type: 'ElementModifierStatement',
      path,
      params,
      hash,
      loc,
    };
  }

  attr({
    name,
    value,
    loc,
  }: {
    name: string;
    value: AST.AttrNode['value'];
    loc: SourceOffsets;
  }): AST.AttrNode {
    return {
      type: 'AttrNode',
      name: name,
      value: value,
      loc,
    };
  }

  text({ chars, loc }: { chars: string; loc: SourceOffsets }): AST.TextNode {
    return {
      type: 'TextNode',
      chars,
      loc,
    };
  }

  sexpr({
    path,
    params,
    hash,
    loc,
  }: {
    path: AST.PathExpression;
    params: AST.Expression[];
    hash: AST.Hash;
    loc: SourceOffsets;
  }): AST.SubExpression {
    return {
      type: 'SubExpression',
      path,
      params,
      hash,
      loc,
    };
  }

  path({
    head,
    tail,
    loc,
  }: {
    head: AST.PathHead;
    tail: string[];
    loc: SourceOffsets;
  }): AST.PathExpression {
    let { original: originalHead, parts: headParts } = headToString(head);
    let parts = [...headParts, ...tail];
    let original = [...originalHead, ...parts].join('.');

    return {
      type: 'PathExpression',
      head,
      tail,
      original,
      parts,
      loc,
    };
  }

  head(head: string, loc: SourceOffsets): AST.PathHead {
    if (head[0] === '@') {
      return this.atName(head, loc);
    } else if (head === 'this') {
      return this.this(loc);
    } else {
      return this.var(head, loc);
    }
  }

  this(loc: SourceOffsets): AST.PathHead {
    return {
      type: 'ThisHead',
      loc,
    };
  }

  atName(name: string, loc: SourceOffsets): AST.PathHead {
    // the `@` should be included so we have a complete source range
    assert(name[0] === '@', `call builders.at() with a string that starts with '@'`);

    return {
      type: 'AtHead',
      name,
      loc,
    };
  }

  var(name: string, loc: SourceOffsets): AST.PathHead {
    assert(name !== 'this', `You called builders.var() with 'this'. Call builders.this instead`);
    assert(
      name[0] !== '@',
      `You called builders.var() with '${name}'. Call builders.at('${name}') instead`
    );

    return {
      type: 'VarHead',
      name,
      loc,
    };
  }

  hash(pairs: AST.HashPair[], loc: SourceOffsets): AST.Hash {
    return {
      type: 'Hash',
      pairs: pairs || [],
      loc,
    };
  }

  pair({
    key,
    value,
    loc,
  }: {
    key: string;
    value: AST.Expression;
    loc: SourceOffsets;
  }): AST.HashPair {
    return {
      type: 'HashPair',
      key: key,
      value,
      loc,
    };
  }

  literal<T extends AST.Literal>({
    type,
    value,
    loc,
  }: {
    type: T['type'];
    value: T['value'];
    loc?: AST.SourceLocation;
  }): T {
    return {
      type,
      value,
      original: value,
      loc,
    } as T;
  }

  undefined(): AST.UndefinedLiteral {
    return this.literal({ type: 'UndefinedLiteral', value: undefined });
  }

  null(): AST.NullLiteral {
    return this.literal({ type: 'NullLiteral', value: null });
  }

  string(value: string, loc: SourceOffsets): AST.StringLiteral {
    return this.literal({ type: 'StringLiteral', value, loc });
  }

  boolean(value: boolean, loc: SourceOffsets): AST.BooleanLiteral {
    return this.literal({ type: 'BooleanLiteral', value, loc });
  }

  number(value: number, loc: SourceOffsets): AST.NumberLiteral {
    return this.literal({ type: 'NumberLiteral', value, loc });
  }
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
  tag: string;
  selfClosing: boolean;
  attrs: AST.AttrNode[];
  modifiers: AST.ElementModifierStatement[];
  children: AST.Statement[];
  comments: ElementComment[];
  blockParams: string[];
  loc: SourceOffsets;
}

// Expressions

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

export default new Builders();
