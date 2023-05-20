import type { Dict, DictValue, Nullable, PresentArray } from '@glimmer/interfaces';
import { assertNever, dict, expect, isPresentArray } from '@glimmer/util';

export type BuilderParameters = BuilderExpression[];
export type BuilderHash = Nullable<Dict<BuilderExpression>>;
export type BuilderBlockHash = BuilderHash | { as: string | string[] };
export type BuilderBlocks = Dict<BuilderBlock>;
export type BuilderAttributes = Dict<BuilderAttribute>;

export type NormalizedParameters = NormalizedExpression[];
export type NormalizedHash = Dict<NormalizedExpression>;
export type NormalizedBlock = NormalizedStatement[];
export type NormalizedBlocks = Dict<NormalizedBlock>;
export type NormalizedAttributes = Dict<NormalizedAttribute>;
export type NormalizedAttribute = HeadKind.Splat | NormalizedExpression;

export interface NormalizedElement {
  name: string;
  attrs: Nullable<NormalizedAttributes>;
  block: Nullable<NormalizedBlock>;
}

export interface NormalizedAngleInvocation {
  head: NormalizedExpression;
  attrs: Nullable<NormalizedAttributes>;
  block: Nullable<NormalizedBlock>;
}

export enum HeadKind {
  Block = 'Block',
  Call = 'Call',
  Element = 'Element',
  AppendPath = 'AppendPath',
  AppendExpr = 'AppendExpr',
  Literal = 'Literal',
  Modifier = 'Modifier',
  DynamicComponent = 'DynamicComponent',
  Comment = 'Comment',
  Splat = 'Splat',
  Keyword = 'Keyword',
}

export enum VariableKind {
  Local = 'Local',
  Free = 'Free',
  Argument = 'Arg',
  Block = 'Block',
  This = 'This',
}

export interface Variable {
  kind: VariableKind;
  name: string;
  /**
   * Differences:
   *
   * - strict mode variables always refer to in-scope variables
   * - loose mode variables use this algorithm:
   *   1. otherwise, fall back to `this.<name>`
   */
  mode: 'loose' | 'strict';
}

export interface Path {
  head: Variable;
  tail: PresentArray<string>;
}

export interface AppendExpr {
  kind: HeadKind.AppendExpr;
  expr: NormalizedExpression;
  trusted: boolean;
}

export interface AppendPath {
  kind: HeadKind.AppendPath;
  path: NormalizedPath;
  trusted: boolean;
}

export interface NormalizedKeywordStatement {
  kind: HeadKind.Keyword;
  name: string;
  params: Nullable<NormalizedParameters>;
  hash: Nullable<NormalizedHash>;
  blockParams: Nullable<string[]>;
  blocks: NormalizedBlocks;
}

export type NormalizedStatement =
  | {
      kind: HeadKind.Call;
      head: NormalizedHead;
      params: Nullable<NormalizedParameters>;
      hash: Nullable<NormalizedHash>;
      trusted: boolean;
    }
  | {
      kind: HeadKind.Block;
      head: NormalizedHead;
      params: Nullable<NormalizedParameters>;
      hash: Nullable<NormalizedHash>;
      blockParams: Nullable<string[]>;
      blocks: NormalizedBlocks;
    }
  | NormalizedKeywordStatement
  | {
      kind: HeadKind.Element;
      name: string;
      attrs: NormalizedAttributes;
      block: NormalizedBlock;
    }
  | { kind: HeadKind.Comment; value: string }
  | { kind: HeadKind.Literal; value: string }
  | AppendPath
  | AppendExpr
  | { kind: HeadKind.Modifier; params: NormalizedParameters; hash: Nullable<NormalizedHash> }
  | {
      kind: HeadKind.DynamicComponent;
      expr: NormalizedExpression;
      hash: Nullable<NormalizedHash>;
      block: NormalizedBlock;
    };

export function normalizeStatement(statement: BuilderStatement): NormalizedStatement {
  if (Array.isArray(statement)) {
    if (statementIsExpression(statement)) {
      return normalizeAppendExpression(statement);
    } else if (isSugaryArrayStatement(statement)) {
      return normalizeSugaryArrayStatement(statement);
    } else {
      return normalizeVerboseStatement(statement);
    }
  } else if (typeof statement === 'string') {
    return normalizeAppendHead(normalizeDottedPath(statement), false);
  } else {
    throw assertNever(statement);
  }
}

export function normalizeAppendHead(
  head: NormalizedHead,
  trusted: boolean
): AppendExpr | AppendPath {
  return head.type === ExpressionKind.GetPath
    ? {
        kind: HeadKind.AppendPath,
        path: head,
        trusted,
      }
    : {
        kind: HeadKind.AppendExpr,
        expr: head,
        trusted,
      };
}

function isSugaryArrayStatement(statement: BuilderStatement): statement is SugaryArrayStatement {
  if (Array.isArray(statement) && typeof statement[0] === 'string') {
    switch (statement[0][0]) {
      case '(':
      case '#':
      case '<':
      case '!':
        return true;
      default:
        return false;
    }
  }

  return false;
}

export type SugaryArrayStatement = BuilderCallExpression | BuilderElement | BuilderBlockStatement;

export function normalizeSugaryArrayStatement(
  statement: SugaryArrayStatement
): NormalizedStatement {
  let name = statement[0];

  switch (name[0]) {
    case '(': {
      let parameters: Nullable<NormalizedParameters> = null;
      let hash: Nullable<NormalizedHash> = null;

      if (statement.length === 3) {
        parameters = normalizeParams(statement[1] as Parameters);
        hash = normalizeHash(statement[2] as Hash);
      } else if (statement.length === 2) {
        if (Array.isArray(statement[1])) {
          parameters = normalizeParams(statement[1] as Parameters);
        } else {
          hash = normalizeHash(statement[1] as Hash);
        }
      }

      return {
        kind: HeadKind.Call,
        head: normalizeCallHead(name),
        params: parameters,
        hash,
        trusted: false,
      };
    }

    case '#': {
      let {
        head: path,
        params,
        hash,
        blocks,
        blockParams,
      } = normalizeBuilderBlockStatement(statement as BuilderBlockStatement);

      return {
        kind: HeadKind.Block,
        head: path,
        params,
        hash,
        blocks,
        blockParams,
      };
    }

    case '!': {
      let name = statement[0].slice(1);
      let { params, hash, blocks, blockParams } = normalizeBuilderBlockStatement(
        statement as BuilderBlockStatement
      );

      return {
        kind: HeadKind.Keyword,
        name,
        params,
        hash,
        blocks,
        blockParams,
      };
    }

    case '<': {
      let attributes: NormalizedAttributes = dict();
      let block: NormalizedBlock = [];

      if (statement.length === 3) {
        attributes = normalizeAttributes(statement[1] as BuilderAttributes);
        block = normalizeBlock(statement[2] as BuilderBlock);
      } else if (statement.length === 2) {
        if (Array.isArray(statement[1])) {
          block = normalizeBlock(statement[1] as BuilderBlock);
        } else {
          attributes = normalizeAttributes(statement[1] as BuilderAttributes);
        }
      }

      return {
        kind: HeadKind.Element,
        name: expect(extractElement(name), `BUG: expected ${name} to look like a tag name`),
        attrs: attributes,
        block,
      };
    }

    default:
      throw new Error(`Unreachable ${JSON.stringify(statement)} in normalizeSugaryArrayStatement`);
  }
}

function normalizeVerboseStatement(statement: VerboseStatement): NormalizedStatement {
  switch (statement[0]) {
    case Builder.Literal:
      return {
        kind: HeadKind.Literal,
        value: statement[1],
      };

    case Builder.Append:
      return normalizeAppendExpression(statement[1], statement[2]);

    case Builder.Modifier:
      return {
        kind: HeadKind.Modifier,
        params: normalizeParams(statement[1]),
        hash: normalizeHash(statement[2]),
      };

    case Builder.DynamicComponent:
      return {
        kind: HeadKind.DynamicComponent,
        expr: normalizeExpression(statement[1]),
        hash: normalizeHash(statement[2]),
        block: normalizeBlock(statement[3]),
      };

    case Builder.Comment:
      return {
        kind: HeadKind.Comment,
        value: statement[1],
      };
  }
}

function extractBlockHead(name: string): NormalizedHead {
  let result = /^(#|!)(.*)$/u.exec(name);

  if (result === null) {
    throw new Error(`Unexpected missing # in block head`);
  }

  return normalizeDottedPath(result[2] as string);
}

function normalizeCallHead(name: string): NormalizedHead {
  let result = /^\((.*)\)$/u.exec(name);

  if (result === null) {
    throw new Error(`Unexpected missing () in call head`);
  }

  return normalizeDottedPath(result[1] as string);
}

function normalizePath(head: string, tail: string[] = []): NormalizedHead {
  let pathHead = normalizePathHead(head);

  return isPresentArray(tail)
    ? {
        type: ExpressionKind.GetPath,
        path: {
          head: pathHead,
          tail,
        },
      }
    : {
        type: ExpressionKind.GetVariable,
        variable: pathHead,
      };
}

function normalizeDottedPath(whole: string): NormalizedHead {
  let { kind, name: rest } = normalizePathHead(whole);

  let [name, ...tail] = rest.split('.') as [string, ...string[]];

  let variable: Variable = { kind, name, mode: 'loose' };

  return isPresentArray(tail)
    ? { type: ExpressionKind.GetPath, path: { head: variable, tail } }
    : { type: ExpressionKind.GetVariable, variable };
}

export function normalizePathHead(whole: string): Variable {
  let kind: VariableKind;
  let name: string;

  if (/^this(?:\.|$)/u.test(whole)) {
    return {
      kind: VariableKind.This,
      name: whole,
      mode: 'loose',
    };
  }

  switch (whole[0]) {
    case '^':
      kind = VariableKind.Free;
      name = whole.slice(1);
      break;

    case '@':
      kind = VariableKind.Argument;
      name = whole.slice(1);
      break;

    case '&':
      kind = VariableKind.Block;
      name = whole.slice(1);
      break;

    default:
      kind = VariableKind.Local;
      name = whole;
  }

  return { kind, name, mode: 'loose' };
}

export type BuilderBlockStatement =
  | [string, BuilderBlock | BuilderBlocks]
  | [string, BuilderParameters | BuilderBlockHash, BuilderBlock | BuilderBlocks]
  | [string, BuilderParameters, BuilderBlockHash, BuilderBlock | BuilderBlocks];

export interface NormalizedBuilderBlockStatement {
  head: NormalizedHead;
  params: Nullable<NormalizedParameters>;
  hash: Nullable<NormalizedHash>;
  blockParams: Nullable<string[]>;
  blocks: NormalizedBlocks;
}

export function normalizeBuilderBlockStatement(
  statement: BuilderBlockStatement
): NormalizedBuilderBlockStatement {
  let head = statement[0];
  let blocks: NormalizedBlocks = dict();
  let parameters: Nullable<NormalizedParameters> = null;
  let hash: Nullable<NormalizedHash> = null;
  let blockParameters: Nullable<string[]> = null;

  switch (statement.length) {
    case 2:
      blocks = normalizeBlocks(statement[1]);

      break;

    case 3:
      if (Array.isArray(statement[1])) {
        parameters = normalizeParams(statement[1]);
      } else {
        ({ hash, blockParams: blockParameters } = normalizeBlockHash(statement[1]));
      }

      blocks = normalizeBlocks(statement[2]);

      break;

    case 4:
      parameters = normalizeParams(statement[1]);
      ({ hash, blockParams: blockParameters } = normalizeBlockHash(statement[2]));
      blocks = normalizeBlocks(statement[3]);

      break;

    // No default
  }

  return {
    head: extractBlockHead(head),
    params: parameters,
    hash,
    blockParams: blockParameters,
    blocks,
  };
}

function normalizeBlockHash(hash: BuilderBlockHash): {
  hash: Nullable<NormalizedHash>;
  blockParams: Nullable<string[]>;
} {
  if (hash === null) {
    return { hash: null, blockParams: null };
  }

  let out: Nullable<Dict<NormalizedExpression>> = null;
  let blockParameters: Nullable<string[]> = null;

  entries(hash, (key, value) => {
    if (key === 'as') {
      blockParameters = Array.isArray(value) ? (value as string[]) : [value as string];
    } else {
      out = out || dict();
      out[key] = normalizeExpression(value as BuilderExpression);
    }
  });

  return { hash: out, blockParams: blockParameters };
}

export function entries<D extends Dict>(
  dict: D,
  callback: <K extends keyof D>(key: K, value: D[K]) => void
): void {
  for (let key of Object.keys(dict)) {
    let value = dict[key];
    callback(key, value as D[keyof D]);
  }
}

function normalizeBlocks(value: BuilderBlock | BuilderBlocks): NormalizedBlocks {
  return Array.isArray(value)
    ? { default: normalizeBlock(value) }
    : mapObject(value, normalizeBlock);
}

function normalizeBlock(block: BuilderBlock): NormalizedBlock {
  return block.map((s) => normalizeStatement(s));
}

function normalizeAttributes(attributes: BuilderAttributes): NormalizedAttributes {
  return mapObject(attributes, (a) => normalizeAttribute(a).expr);
}

function normalizeAttribute(attribute: BuilderAttribute): {
  expr: NormalizedAttribute;
  trusted: boolean;
} {
  if (attribute === 'splat') {
    return { expr: HeadKind.Splat, trusted: false };
  } else {
    let expr = normalizeExpression(attribute);
    return { expr, trusted: false };
  }
}

function mapObject<T extends Dict<unknown>, Out>(
  object: T,
  mapper: (value: DictValue<T>, key: keyof T) => Out
): Record<keyof T, Out> {
  let out = dict() as { [P in keyof T]?: Out };

  for (let key of Object.keys(object)) {
    out[key as keyof T] = mapper(object[key] as DictValue<T>, key);
  }

  return out as Record<keyof T, Out>;
}

export type BuilderElement =
  | [string]
  | [string, BuilderAttributes, BuilderBlock]
  | [string, BuilderBlock]
  | [string, BuilderAttributes];

export type BuilderComment = [Builder.Comment, string];

export type InvocationElement =
  | [string]
  | [string, BuilderAttributes, BuilderBlock]
  | [string, BuilderBlock]
  | [string, BuilderAttributes];

export function isElement(input: [string, ...unknown[]]): input is BuilderElement {
  let match = /^<([\d\-a-z][\d\-A-Za-z]*)>$/u.exec(input[0]);

  return !!match && !!match[1];
}

export function extractElement(input: string): Nullable<string> {
  let match = /^<([\d\-a-z][\d\-A-Za-z]*)>$/u.exec(input);

  return match?.[1] ?? null;
}

export function isAngleInvocation(input: [string, ...unknown[]]): input is InvocationElement {
  // TODO Paths
  let match = /^<(@[\dA-Za-z]*|[A-Z][\d\-A-Za-z]*)>$/u.exec(input[0]);

  return !!match && !!match[1];
}

export function isBlock(input: [string, ...unknown[]]): input is BuilderBlockStatement {
  // TODO Paths
  let match = /^#[\s\S]?([\dA-Za-z]*|[A-Z][\d\-A-Za-z]*)$/u.exec(input[0]);

  return !!match && !!match[1];
}

export enum Builder {
  Literal,
  Comment,
  Append,
  Modifier,
  DynamicComponent,
  Get,
  Concat,
  HasBlock,
  HasBlockParameters,
}

export type VerboseStatement =
  | [Builder.Literal, string]
  | [Builder.Comment, string]
  | [Builder.Append, BuilderExpression, true]
  | [Builder.Append, BuilderExpression]
  | [Builder.Modifier, Parameters, Hash]
  | [Builder.DynamicComponent, BuilderExpression, Hash, BuilderBlock];

export type BuilderStatement =
  | VerboseStatement
  | SugaryArrayStatement
  | TupleBuilderExpression
  | string;

export type BuilderAttribute = 'splat' | BuilderExpression;

export type TupleBuilderExpression =
  | [Builder.Literal, string | boolean | null | undefined]
  | [Builder.Get, string]
  | [Builder.Get, string, string[]]
  | [Builder.Concat, ...BuilderExpression[]]
  | [Builder.HasBlock, string]
  | [Builder.HasBlockParameters, string]
  | BuilderCallExpression;

type Parameters = BuilderParameters;
type Hash = Dict<BuilderExpression>;

export enum ExpressionKind {
  Literal = 'Literal',
  Call = 'Call',
  GetPath = 'GetPath',
  GetVariable = 'GetVar',
  Concat = 'Concat',
  HasBlock = 'HasBlock',
  HasBlockParameters = 'HasBlockParams',
}

export interface NormalizedCallExpression {
  type: ExpressionKind.Call;
  head: NormalizedHead;
  params: Nullable<NormalizedParameters>;
  hash: Nullable<NormalizedHash>;
}

export interface NormalizedPath {
  type: ExpressionKind.GetPath;
  path: Path;
}

export interface NormalizedVariable {
  type: ExpressionKind.GetVariable;
  variable: Variable;
}

export type NormalizedHead = NormalizedPath | NormalizedVariable;

export interface NormalizedConcat {
  type: ExpressionKind.Concat;
  params: [NormalizedExpression, ...NormalizedExpression[]];
}

export type NormalizedExpression =
  | {
      type: ExpressionKind.Literal;
      value: null | undefined | boolean | string | number;
    }
  | NormalizedCallExpression
  | NormalizedPath
  | NormalizedVariable
  | NormalizedConcat
  | {
      type: ExpressionKind.HasBlock;
      name: string;
    }
  | {
      type: ExpressionKind.HasBlockParameters;
      name: string;
    };

export function normalizeAppendExpression(
  expression: BuilderExpression,
  forceTrusted = false
): AppendExpr | AppendPath {
  if (expression === null || expression === undefined) {
    return {
      expr: {
        type: ExpressionKind.Literal,
        value: expression,
      },
      kind: HeadKind.AppendExpr,
      trusted: false,
    };
  } else if (Array.isArray(expression)) {
    switch (expression[0]) {
      case Builder.Literal:
        return {
          expr: { type: ExpressionKind.Literal, value: expression[1] },
          kind: HeadKind.AppendExpr,
          trusted: false,
        };

      case Builder.Get:
        return normalizeAppendHead(normalizePath(expression[1], expression[2]), forceTrusted);

      case Builder.Concat: {
        let expr: NormalizedConcat = {
          type: ExpressionKind.Concat,
          params: normalizeParams(expression.slice(1)) as [
            NormalizedExpression,
            ...NormalizedExpression[]
          ],
        };

        return {
          expr,
          kind: HeadKind.AppendExpr,
          trusted: forceTrusted,
        };
      }

      case Builder.HasBlock:
        return {
          expr: {
            type: ExpressionKind.HasBlock,
            name: expression[1],
          },
          kind: HeadKind.AppendExpr,
          trusted: forceTrusted,
        };

      case Builder.HasBlockParameters:
        return {
          expr: {
            type: ExpressionKind.HasBlockParameters,
            name: expression[1],
          },
          kind: HeadKind.AppendExpr,
          trusted: forceTrusted,
        };

      default:
        if (isBuilderCallExpression(expression)) {
          return {
            expr: normalizeCallExpression(expression),
            kind: HeadKind.AppendExpr,
            trusted: forceTrusted,
          };
        } else {
          throw new Error(
            `Unexpected array in expression position (wasn't a tuple expression and ${
              expression[0] as string
            } isn't wrapped in parens, so it isn't a call): ${JSON.stringify(expression)}`
          );
        }

      // BuilderCallExpression
    }
  } else if (typeof expression === 'object') {
    throw assertNever(expression);
  } else {
    switch (typeof expression) {
      case 'string':
        return normalizeAppendHead(normalizeDottedPath(expression), forceTrusted);

      case 'boolean':
      case 'number':
        return {
          expr: { type: ExpressionKind.Literal, value: expression },
          kind: HeadKind.AppendExpr,
          trusted: true,
        };

      default:
        throw assertNever(expression);
    }
  }
}

export function normalizeExpression(expression: BuilderExpression): NormalizedExpression {
  if (expression === null || expression === undefined) {
    return {
      type: ExpressionKind.Literal,
      value: expression,
    };
  } else if (Array.isArray(expression)) {
    switch (expression[0]) {
      case Builder.Literal:
        return { type: ExpressionKind.Literal, value: expression[1] };

      case Builder.Get:
        return normalizePath(expression[1], expression[2]);

      case Builder.Concat: {
        let expr: NormalizedConcat = {
          type: ExpressionKind.Concat,
          params: normalizeParams(expression.slice(1)) as [
            NormalizedExpression,
            ...NormalizedExpression[]
          ],
        };

        return expr;
      }

      case Builder.HasBlock:
        return {
          type: ExpressionKind.HasBlock,
          name: expression[1],
        };

      case Builder.HasBlockParameters:
        return {
          type: ExpressionKind.HasBlockParameters,
          name: expression[1],
        };

      default:
        if (isBuilderCallExpression(expression)) {
          return normalizeCallExpression(expression);
        } else {
          throw new Error(
            `Unexpected array in expression position (wasn't a tuple expression and ${
              expression[0] as string
            } isn't wrapped in parens, so it isn't a call): ${JSON.stringify(expression)}`
          );
        }

      // BuilderCallExpression
    }
  } else if (typeof expression === 'object') {
    throw assertNever(expression);
  } else {
    switch (typeof expression) {
      case 'string':
        return normalizeDottedPath(expression);

      case 'boolean':
      case 'number':
        return { type: ExpressionKind.Literal, value: expression };

      default:
        throw assertNever(expression);
    }
  }
}

// | [Builder.Get, string]
// | [Builder.Get, string, string[]]
// | [Builder.Concat, Params]
// | [Builder.HasBlock, string]
// | [Builder.HasBlockParams, string]

export type BuilderExpression =
  | TupleBuilderExpression
  | BuilderCallExpression
  | null
  | undefined
  | boolean
  | string
  | number;

export function isBuilderExpression(
  expr: BuilderExpression | BuilderCallExpression
): expr is TupleBuilderExpression | BuilderCallExpression {
  return Array.isArray(expr);
}

export function isLiteral(
  expr: BuilderExpression | BuilderCallExpression
): expr is [Builder.Literal, string | boolean | undefined] {
  return Array.isArray(expr) && expr[0] === 'literal';
}

export function statementIsExpression(
  statement: BuilderStatement
): statement is TupleBuilderExpression {
  if (!Array.isArray(statement)) {
    return false;
  }

  let name = statement[0];

  if (typeof name === 'number') {
    switch (name) {
      case Builder.Literal:
      case Builder.Get:
      case Builder.Concat:
      case Builder.HasBlock:
      case Builder.HasBlockParameters:
        return true;
      default:
        return false;
    }
  }

  if (name[0] === '(') {
    return true;
  }

  return false;
}

export function isBuilderCallExpression(
  value: TupleBuilderExpression | BuilderCallExpression
): value is BuilderCallExpression {
  return typeof value[0] === 'string' && value[0][0] === '(';
}

export type MiniBuilderBlock = BuilderStatement[];

export type BuilderBlock = MiniBuilderBlock;

export type BuilderCallExpression =
  | [string]
  | [string, Parameters | Hash]
  | [string, Parameters, Hash];

export function normalizeParams(input: Parameters): NormalizedParameters {
  return input.map(normalizeExpression);
}

export function normalizeHash(input: Nullable<Hash>): Nullable<NormalizedHash> {
  if (input === null) return null;
  return mapObject(input, normalizeExpression);
}

export function normalizeCallExpression(expr: BuilderCallExpression): NormalizedCallExpression {
  switch (expr.length) {
    case 1:
      return {
        type: ExpressionKind.Call,
        head: normalizeCallHead(expr[0]),
        params: null,
        hash: null,
      };
    case 2:
      return Array.isArray(expr[1])
        ? {
            type: ExpressionKind.Call,
            head: normalizeCallHead(expr[0]),
            params: normalizeParams(expr[1]),
            hash: null,
          }
        : {
            type: ExpressionKind.Call,
            head: normalizeCallHead(expr[0]),
            params: null,
            hash: normalizeHash(expr[1]),
          };

    case 3:
      return {
        type: ExpressionKind.Call,
        head: normalizeCallHead(expr[0]),
        params: normalizeParams(expr[1]),
        hash: normalizeHash(expr[2]),
      };
  }
}
