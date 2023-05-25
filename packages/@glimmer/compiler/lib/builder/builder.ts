import type {
  AttrNamespace,
  Dict,
  Expressions,
  GetContextualFreeOpcode,
  Nullable,
  PresentArray,
  WireFormat,
} from '@glimmer/interfaces';
import {
  assert,
  assertNever,
  dict,
  exhausted,
  expect,
  isPresentArray,
  NS_XLINK,
  NS_XML,
  NS_XMLNS,
  values,
} from '@glimmer/util';
import {
  VariableResolutionContext,
  WIRE_TRUSTING_APPEND,
  WIRE_APPEND,
  WIRE_CALL,
  WIRE_COMMENT,
  WIRE_BLOCK,
  WIRE_WITH,
  WIRE_IF,
  WIRE_EACH,
  WIRE_OPEN_ELEMENT_WITH_SPLAT,
  WIRE_OPEN_ELEMENT,
  WIRE_FLUSH_ELEMENT,
  WIRE_CLOSE_ELEMENT,
  WIRE_COMPONENT,
  WIRE_ATTR_SPLAT,
  WIRE_STATIC_ATTR,
  WIRE_DYNAMIC_ATTR,
  WIRE_CONCAT,
  WIRE_HAS_BLOCK,
  WIRE_HAS_BLOCK_PARAMS,
  WIRE_UNDEFINED,
  WIRE_GET_SYMBOL,
  WIRE_GET_STRICT_KEYWORD,
  WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OR_THIS_FALLBACK,
  WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD,
  WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK,
  WIRE_GET_FREE_AS_HELPER_HEAD,
  WIRE_GET_FREE_AS_MODIFIER_HEAD,
  WIRE_GET_FREE_AS_COMPONENT_HEAD,
} from '@glimmer/wire-format';

import {
  Builder,
  type BuilderComment,
  type BuilderStatement,
  ExpressionKind,
  HeadKind,
  type NormalizedAngleInvocation,
  type NormalizedAttributes,
  type NormalizedBlock,
  type NormalizedBlocks,
  type NormalizedElement,
  type NormalizedExpression,
  type NormalizedHash,
  type NormalizedHead,
  type NormalizedKeywordStatement,
  type NormalizedParameters,
  type NormalizedPath,
  type NormalizedStatement,
  normalizeStatement,
  type Variable,
  VariableKind,
} from './builder-interface';

interface Symbols {
  top: ProgramSymbols;
  freeVar(name: string): number;
  arg(name: string): number;
  block(name: string): number;
  local(name: string): number;
  this(): number;

  hasLocal(name: string): boolean;

  child(parameters: string[]): LocalSymbols;
}

export class ProgramSymbols implements Symbols {
  _freeVariables: string[] = [];
  _symbols: string[] = ['this'];

  top = this;

  toSymbols(): string[] {
    return this._symbols.slice(1);
  }

  toUpvars(): string[] {
    return this._freeVariables;
  }

  freeVar(name: string): number {
    return addString(this._freeVariables, name);
  }

  block(name: string): number {
    return this.symbol(name);
  }

  arg(name: string): number {
    return addString(this._symbols, name);
  }

  local(name: string): never {
    throw new Error(
      `No local ${name} was found. Maybe you meant ^${name} for upvar, or !${name} for keyword?`
    );
  }

  this(): number {
    return 0;
  }

  hasLocal(_name: string): false {
    return false;
  }

  // any symbol
  symbol(name: string): number {
    return addString(this._symbols, name);
  }

  child(locals: string[]): LocalSymbols {
    return new LocalSymbols(this, locals);
  }
}

class LocalSymbols implements Symbols {
  private locals: Dict<number> = dict();

  constructor(private parent: Symbols, locals: string[]) {
    for (let local of locals) {
      this.locals[local] = parent.top.symbol(local);
    }
  }

  get paramSymbols(): number[] {
    return values(this.locals);
  }

  get top(): ProgramSymbols {
    return this.parent.top;
  }

  freeVar(name: string): number {
    return this.parent.freeVar(name);
  }

  arg(name: string): number {
    return this.parent.arg(name);
  }

  block(name: string): number {
    return this.parent.block(name);
  }

  local(name: string): number {
    return name in this.locals ? (this.locals[name] as number) : this.parent.local(name);
  }

  this(): number {
    return this.parent.this();
  }

  hasLocal(name: string): boolean {
    return name in this.locals ? true : this.parent.hasLocal(name);
  }

  child(locals: string[]): LocalSymbols {
    return new LocalSymbols(this, locals);
  }
}

function addString(array: string[], item: string): number {
  let index = array.indexOf(item);

  if (index === -1) {
    index = array.length;
    array.push(item);
    return index;
  } else {
    return index;
  }
}

export interface BuilderGetFree {
  type: 'GetFree';
  head: string;
  tail: string[];
}

function unimpl(message: string): Error {
  return new Error(`unimplemented ${message}`);
}

export function buildStatements(
  statements: BuilderStatement[],
  symbols: Symbols
): WireFormat.Statement[] {
  let out: WireFormat.Statement[] = [];

  for (let s of statements) out.push(...buildStatement(normalizeStatement(s), symbols));

  return out;
}

export function buildNormalizedStatements(
  statements: NormalizedStatement[],
  symbols: Symbols
): WireFormat.Statement[] {
  let out: WireFormat.Statement[] = [];

  for (let s of statements) out.push(...buildStatement(s, symbols));

  return out;
}

export function buildStatement(
  normalized: NormalizedStatement,
  symbols: Symbols = new ProgramSymbols()
): WireFormat.Statement[] {
  switch (normalized.kind) {
    case HeadKind.AppendPath:
      return [
        [
          normalized.trusted ? WIRE_TRUSTING_APPEND : WIRE_APPEND,
          buildGetPath(normalized.path, symbols),
        ],
      ];

    case HeadKind.AppendExpr:
      return [
        [
          normalized.trusted ? WIRE_TRUSTING_APPEND : WIRE_APPEND,
          buildExpression(
            normalized.expr,
            normalized.trusted ? 'TrustedAppend' : 'Append',
            symbols
          ),
        ],
      ];

    case HeadKind.Call: {
      let { head: path, params, hash, trusted } = normalized;
      let builtParameters: Nullable<WireFormat.Core.Params> = params
        ? buildParams(params, symbols)
        : null;
      let builtHash: WireFormat.Core.Hash = hash ? buildHash(hash, symbols) : null;
      let builtExpr: WireFormat.Expression = buildCallHead(
        path,
        trusted
          ? VariableResolutionContext.AmbiguousInvoke
          : VariableResolutionContext.AmbiguousAppendInvoke,
        symbols
      );

      return [
        [
          trusted ? WIRE_TRUSTING_APPEND : WIRE_APPEND,
          [WIRE_CALL, builtExpr, builtParameters, builtHash],
        ],
      ];
    }

    case HeadKind.Literal:
      return [[WIRE_APPEND, normalized.value]];

    case HeadKind.Comment:
      return [[WIRE_COMMENT, normalized.value]];

    case HeadKind.Block: {
      let blocks = buildBlocks(normalized.blocks, normalized.blockParams, symbols);
      let hash = buildHash(normalized.hash, symbols);
      let parameters = buildParams(normalized.params, symbols);
      let path = buildCallHead(
        normalized.head,
        VariableResolutionContext.ResolveAsComponentHead,
        symbols
      );

      return [[WIRE_BLOCK, path, parameters, hash, blocks]];
    }

    case HeadKind.Keyword:
      return [buildKeyword(normalized, symbols)];

    case HeadKind.Element:
      return buildElement(normalized, symbols);

    case HeadKind.Modifier:
      throw unimpl('modifier');

    case HeadKind.DynamicComponent:
      throw unimpl('dynamic component');

    default:
      throw assertNever(normalized);
  }
}

export function s(
  array: TemplateStringsArray,
  ...interpolated: unknown[]
): [Builder.Literal, string] {
  let result = array.reduce(
    (result, string, index) =>
      result + `${string}${interpolated[index] ? String(interpolated[index]) : ''}`,
    ''
  );

  return [Builder.Literal, result];
}

export function c(array: TemplateStringsArray, ...interpolated: unknown[]): BuilderComment {
  let result = array.reduce(
    (result, string, index) =>
      result + `${string}${interpolated[index] ? String(interpolated[index]) : ''}`,
    ''
  );

  return [Builder.Comment, result];
}

export function unicode(charCode: string): string {
  return String.fromCodePoint(Number.parseInt(charCode, 16));
}

export const NEWLINE = '\n';

function buildKeyword(
  normalized: NormalizedKeywordStatement,
  symbols: Symbols
): WireFormat.Statement {
  let { name } = normalized;
  let parameters = buildParams(normalized.params, symbols);
  let childSymbols = symbols.child(normalized.blockParams || []);

  let block = buildBlock(
    normalized.blocks['default'] as NormalizedBlock,
    childSymbols,
    childSymbols.paramSymbols
  );
  let inverse = normalized.blocks['else']
    ? buildBlock(normalized.blocks['else'], symbols, [])
    : null;

  switch (name) {
    case 'with':
      return [WIRE_WITH, expect(parameters, 'with requires params')[0], block, inverse];
    case 'if':
      return [WIRE_IF, expect(parameters, 'if requires params')[0], block, inverse];
    case 'each': {
      let keyExpr = normalized.hash ? normalized.hash['key'] : null;
      let key = keyExpr ? buildExpression(keyExpr, 'Strict', symbols) : null;
      return [WIRE_EACH, expect(parameters, 'if requires params')[0], key, block, inverse];
    }

    default:
      throw new Error('unimplemented keyword');
  }
}

function buildElement(
  { name, attrs, block }: NormalizedElement,
  symbols: Symbols
): WireFormat.Statement[] {
  let out: WireFormat.Statement[] = [
    hasSplat(attrs) ? [WIRE_OPEN_ELEMENT_WITH_SPLAT, name] : [WIRE_OPEN_ELEMENT, name],
  ];
  if (attrs) {
    let { params, args } = buildElementParams(attrs, symbols);
    out.push(...params);
    assert(args === null, `Can't pass args to a simple element`);
  }
  out.push([WIRE_FLUSH_ELEMENT]);

  if (Array.isArray(block)) {
    for (let s of block) out.push(...buildStatement(s, symbols));
  } else if (block === null) {
    // do nothing
  } else {
    throw assertNever(block);
  }

  out.push([WIRE_CLOSE_ELEMENT]);

  return out;
}

function hasSplat(attributes: Nullable<NormalizedAttributes>): boolean {
  if (attributes === null) return false;

  return Object.keys(attributes).some((a) => attributes[a] === HeadKind.Splat);
}

export function buildAngleInvocation(
  { attrs, block, head }: NormalizedAngleInvocation,
  symbols: Symbols
): WireFormat.Statements.Component {
  let parameterList: WireFormat.ElementParameter[] = [];
  let args: WireFormat.Core.Hash = null;
  let blockList: WireFormat.Statement[] = [];

  if (attrs) {
    let built = buildElementParams(attrs, symbols);
    parameterList = built.params;
    args = built.args;
  }

  if (block) blockList = buildNormalizedStatements(block, symbols);

  return [
    WIRE_COMPONENT,
    buildExpression(head, VariableResolutionContext.ResolveAsComponentHead, symbols),
    isPresentArray(parameterList) ? parameterList : null,
    args,
    [['default'], [[blockList, []]]],
  ];
}

export function buildElementParams(
  attributes: NormalizedAttributes,
  symbols: Symbols
): { params: WireFormat.ElementParameter[]; args: WireFormat.Core.Hash } {
  let parameters: WireFormat.ElementParameter[] = [];
  let keys: string[] = [];
  let values: WireFormat.Expression[] = [];

  for (let [key, value] of Object.entries(attributes)) {
    if (value === HeadKind.Splat) {
      parameters.push([WIRE_ATTR_SPLAT, symbols.block('&attrs')]);
    } else if (key[0] === '@') {
      keys.push(key);
      values.push(buildExpression(value[0], 'Strict', symbols));
    } else {
      parameters.push(...buildAttributeValue(key, value[0], value[1].strict, symbols));
    }
  }

  return {
    params: parameters,
    args: isPresentArray(keys) && isPresentArray(values) ? [keys, values] : null,
  };
}

export function extractNamespace(name: string): Nullable<AttrNamespace> {
  if (name === 'xmlns') {
    return NS_XMLNS;
  }

  let match = /^([^:]*):([^:]*)$/u.exec(name);

  if (match === null) {
    return null;
  }

  let namespace = match[1];

  switch (namespace) {
    case 'xlink':
      return NS_XLINK;
    case 'xml':
      return NS_XML;
    case 'xmlns':
      return NS_XMLNS;
  }

  return null;
}

export function buildAttributeValue(
  name: string,
  value: NormalizedExpression,
  strict: boolean,
  symbols: Symbols
): WireFormat.Attribute[] {
  switch (value.type) {
    case ExpressionKind.Literal: {
      let value_ = value.value;

      if (value_ === false) {
        return [];
      } else if (value_ === true) {
        return [[WIRE_STATIC_ATTR, name, '', strict ? 1 : 0]];
      } else if (typeof value_ === 'string') {
        return [[WIRE_STATIC_ATTR, name, value_, strict ? 1 : 0]];
      } else {
        throw new TypeError(`Unexpected/unimplemented literal attribute ${JSON.stringify(value_)}`);
      }
    }

    default:
      return [
        [WIRE_DYNAMIC_ATTR, name, buildExpression(value, 'AttrValue', symbols), strict ? 1 : 0],
      ];
  }
}

type ExprResolution =
  | VariableResolutionContext
  | 'Append'
  | 'TrustedAppend'
  | 'AttrValue'
  | 'SubExpression'
  | 'Strict';

function variableContext(context: ExprResolution, bare: boolean): VariableResolution {
  switch (context) {
    case 'Append':
      return bare ? 'AppendBare' : 'AppendInvoke';
    case 'TrustedAppend':
      return bare ? 'TrustedAppendBare' : 'TrustedAppendInvoke';
    case 'AttrValue':
      return bare ? 'AttrValueBare' : 'AttrValueInvoke';
    default:
      return context;
  }
}

export function buildExpression(
  expr: NormalizedExpression,
  context: ExprResolution,
  symbols: Symbols
): WireFormat.Expression {
  switch (expr.type) {
    case ExpressionKind.GetPath:
      return buildGetPath(expr, symbols);

    case ExpressionKind.GetVariable:
      return buildVar(expr.variable, variableContext(context, true), symbols);

    case ExpressionKind.Concat:
      return [WIRE_CONCAT, buildConcat(expr.params, symbols)];

    case ExpressionKind.Call: {
      let builtParameters = buildParams(expr.params, symbols);
      let builtHash = buildHash(expr.hash, symbols);
      let builtExpr = buildCallHead(
        expr.head,
        context === 'Strict' ? 'SubExpression' : variableContext(context, false),
        symbols
      );

      return [WIRE_CALL, builtExpr, builtParameters, builtHash];
    }

    case ExpressionKind.HasBlock:
      return [
        WIRE_HAS_BLOCK,
        buildVar(
          { kind: VariableKind.Block, name: expr.name, mode: 'loose' },
          VariableResolutionContext.Strict,
          symbols
        ),
      ];

    case ExpressionKind.HasBlockParameters:
      return [
        WIRE_HAS_BLOCK_PARAMS,
        buildVar(
          { kind: VariableKind.Block, name: expr.name, mode: 'loose' },
          VariableResolutionContext.Strict,
          symbols
        ),
      ];

    case ExpressionKind.Literal:
      return expr.value === undefined ? [WIRE_UNDEFINED] : expr.value;

    default:
      assertNever(expr);
  }
}

export function buildCallHead(
  callHead: NormalizedHead,
  context: VariableResolution,
  symbols: Symbols
): Expressions.GetVar | Expressions.GetPath {
  return callHead.type === ExpressionKind.GetVariable
    ? buildVar(callHead.variable, context, symbols)
    : buildGetPath(callHead, symbols);
}

export function buildGetPath(head: NormalizedPath, symbols: Symbols): Expressions.GetPath {
  return buildVar(head.path.head, VariableResolutionContext.Strict, symbols, head.path.tail);
}

type VariableResolution =
  | VariableResolutionContext
  | 'AppendBare'
  | 'AppendInvoke'
  | 'TrustedAppendBare'
  | 'TrustedAppendInvoke'
  | 'AttrValueBare'
  | 'AttrValueInvoke'
  | 'SubExpression'
  | 'Strict';

export function buildVar(
  head: Variable,
  context: VariableResolution,
  symbols: Symbols,
  path: PresentArray<string>
): Expressions.GetPath;
export function buildVar(
  head: Variable,
  context: VariableResolution,
  symbols: Symbols
): Expressions.GetVar;
export function buildVar(
  head: Variable,
  context: VariableResolution,
  symbols: Symbols,
  path?: PresentArray<string>
): Expressions.GetPath | Expressions.GetVar {
  let op: Expressions.GetVar[0] = WIRE_GET_SYMBOL;
  let sym: number;
  switch (head.kind) {
    case VariableKind.Free:
      switch (context) {
        case 'Strict':
          op = WIRE_GET_STRICT_KEYWORD;

          break;

        case 'AppendBare':
          op = WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OR_THIS_FALLBACK;

          break;

        case 'AppendInvoke':
          op = WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD;

          break;

        case 'TrustedAppendBare':
          op = WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK;

          break;

        case 'TrustedAppendInvoke':
          op = WIRE_GET_FREE_AS_HELPER_HEAD;

          break;

        case 'AttrValueBare':
          op = WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK;

          break;

        case 'AttrValueInvoke':
          op = WIRE_GET_FREE_AS_HELPER_HEAD;

          break;

        case 'SubExpression':
          op = WIRE_GET_FREE_AS_HELPER_HEAD;

          break;

        default:
          op = expressionContextOp(context);
      }
      sym = symbols.freeVar(head.name);
      break;
    default:
      op = WIRE_GET_SYMBOL;
      sym = getSymbolForVariable(head.kind, symbols, head.name);
  }

  return path === undefined || path.length === 0 ? [op, sym] : [op, sym, path];
}

function getSymbolForVariable(
  kind: Exclude<VariableKind, VariableKind.Free>,
  symbols: Symbols,
  name: string
) {
  switch (kind) {
    case VariableKind.Argument:
      return symbols.arg(name);
    case VariableKind.Block:
      return symbols.block(name);
    case VariableKind.Local:
      return symbols.local(name);
    case VariableKind.This:
      return symbols.this();
    default:
      return exhausted(kind);
  }
}

export function expressionContextOp(context: VariableResolutionContext): GetContextualFreeOpcode {
  switch (context) {
    case VariableResolutionContext.Strict:
      return WIRE_GET_STRICT_KEYWORD;
    case VariableResolutionContext.AmbiguousAppend:
      return WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD_OR_THIS_FALLBACK;
    case VariableResolutionContext.AmbiguousAppendInvoke:
      return WIRE_GET_FREE_AS_COMPONENT_OR_HELPER_HEAD;
    case VariableResolutionContext.AmbiguousInvoke:
      return WIRE_GET_FREE_AS_HELPER_HEAD_OR_THIS_FALLBACK;
    case VariableResolutionContext.ResolveAsCallHead:
      return WIRE_GET_FREE_AS_HELPER_HEAD;
    case VariableResolutionContext.ResolveAsModifierHead:
      return WIRE_GET_FREE_AS_MODIFIER_HEAD;
    case VariableResolutionContext.ResolveAsComponentHead:
      return WIRE_GET_FREE_AS_COMPONENT_HEAD;
    default:
      return exhausted(context);
  }
}

export function buildParams(
  exprs: Nullable<NormalizedParameters>,
  symbols: Symbols
): Nullable<WireFormat.Core.Params> {
  if (exprs === null || !isPresentArray(exprs)) return null;

  return exprs.map((e) => buildExpression(e, 'Strict', symbols)) as WireFormat.Core.ConcatParams;
}

export function buildConcat(
  exprs: [NormalizedExpression, ...NormalizedExpression[]],
  symbols: Symbols
): WireFormat.Core.ConcatParams {
  return exprs.map((e) => buildExpression(e, 'AttrValue', symbols)) as WireFormat.Core.ConcatParams;
}

export function buildHash(exprs: Nullable<NormalizedHash>, symbols: Symbols): WireFormat.Core.Hash {
  if (exprs === null) return null;

  let out: [string[], WireFormat.Expression[]] = [[], []];

  for (let [key, value] of Object.entries(exprs)) {
    out[0].push(key);
    out[1].push(buildExpression(value, 'Strict', symbols));
  }

  return out as WireFormat.Core.Hash;
}

export function buildBlocks(
  blocks: NormalizedBlocks,
  blockParameters: Nullable<string[]>,
  parent: Symbols
): WireFormat.Core.Blocks {
  let keys: string[] = [];
  let values: WireFormat.SerializedInlineBlock[] = [];

  for (let [name, block] of Object.entries(blocks)) {
    keys.push(name);

    if (name === 'default') {
      let symbols = parent.child(blockParameters || []);

      values.push(buildBlock(block, symbols, symbols.paramSymbols));
    } else {
      values.push(buildBlock(block, parent, []));
    }
  }

  return [keys, values];
}

function buildBlock(
  block: NormalizedBlock,
  symbols: Symbols,
  locals: number[] = []
): WireFormat.SerializedInlineBlock {
  return [buildNormalizedStatements(block, symbols), locals];
}
