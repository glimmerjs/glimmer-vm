import type { VariableKind } from '@glimmer/constants';
import type {
  AttrNamespace,
  CallLexicalOpcode,
  CallResolvedOpcode,
  Dict,
  DynamicBlockOpcode,
  Expressions,
  GetContextualFreeOpcode,
  LexicalBlockOpcode,
  Nullable,
  Optional,
  PresentArray,
  ResolvedBlockOpcode,
  UnknownInvokeOpcode,
  WireFormat,
} from '@glimmer/interfaces';
import type { RequireAtLeastOne, Simplify } from 'type-fest';
import {
  APPEND_EXPR_HEAD,
  APPEND_PATH_HEAD,
  ARG_VAR,
  BLOCK_HEAD,
  BLOCK_VAR,
  BUILDER_COMMENT,
  BUILDER_LITERAL,
  CALL_EXPR,
  CALL_HEAD,
  COMMENT_HEAD,
  CONCAT_EXPR,
  DYNAMIC_COMPONENT_HEAD,
  ELEMENT_HEAD,
  FREE_VAR,
  GET_PATH_EXPR,
  GET_VAR_EXPR,
  HAS_BLOCK_EXPR,
  HAS_BLOCK_PARAMS_EXPR,
  KEYWORD_HEAD,
  LITERAL_EXPR,
  LITERAL_HEAD,
  LOCAL_VAR,
  MODIFIER_HEAD,
  NS_XLINK,
  NS_XML,
  NS_XMLNS,
  SPLAT_HEAD,
  THIS_VAR,
} from '@glimmer/constants';
import { exhausted, expect, isPresentArray, localAssert } from '@glimmer/debug-util';
import { LOCAL_DEBUG } from '@glimmer/local-debug-flags';
import { assertNever, dict, values } from '@glimmer/util';
import { SexpOpcodes as Op, VariableResolutionContext } from '@glimmer/wire-format';

import type {
  BuilderComment,
  BuilderStatement,
  NormalizedAngleInvocation,
  NormalizedAttrs,
  NormalizedBlock,
  NormalizedBlocks,
  NormalizedElement,
  NormalizedExpression,
  NormalizedHash,
  NormalizedHead,
  NormalizedKeywordStatement,
  NormalizedParams,
  NormalizedPath,
  NormalizedStatement,
  Variable,
} from './builder-interface';

import { normalizeStatement } from './builder-interface';

interface Symbols {
  top: ProgramSymbols;
  freeVar(name: string): number;
  arg(name: string): number;
  block(name: string): number;
  local(name: string): number;
  this(): number;

  hasLocal(name: string): boolean;

  child(params: string[]): LocalSymbols;
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

  constructor(
    private parent: Symbols,
    locals: string[]
  ) {
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
    if (name in this.locals) {
      return this.locals[name] as number;
    } else {
      return this.parent.local(name);
    }
  }

  this(): number {
    return this.parent.this();
  }

  hasLocal(name: string): boolean {
    if (name in this.locals) {
      return true;
    } else {
      return this.parent.hasLocal(name);
    }
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

  statements.forEach((s) => out.push(...buildStatement(normalizeStatement(s), symbols)));

  return out;
}

export function buildNormalizedStatements(
  statements: NormalizedStatement[],
  symbols: Symbols
): WireFormat.Statement[] {
  let out: WireFormat.Statement[] = [];

  statements.forEach((s) => out.push(...buildStatement(s, symbols)));

  return out;
}

export function buildAppend(
  trusted: boolean,
  expr: Expressions.Expression
): WireFormat.Statements.SomeAppend {
  if (Array.isArray(expr) && expr[0] === Op.GetFreeAsComponentOrHelperHead) {
    return trusted
      ? [Op.UnknownTrustingAppend, expr as Expressions.GetUnknownAppend]
      : [Op.UnknownAppend, expr as Expressions.GetUnknownAppend];
  }

  return [trusted ? Op.TrustingAppend : Op.Append, expr];
}

export function buildStatement(
  normalized: NormalizedStatement,
  symbols: Symbols = new ProgramSymbols()
): WireFormat.Statement[] {
  switch (normalized.kind) {
    case APPEND_PATH_HEAD: {
      return [buildAppend(normalized.trusted, buildGetPath(normalized.path, symbols))];
    }

    case APPEND_EXPR_HEAD: {
      return [
        buildAppend(
          normalized.trusted,
          buildExpression(normalized.expr, normalized.trusted ? 'TrustedAppend' : 'Append', symbols)
        ),
      ];
    }

    case CALL_HEAD: {
      let { head: path, params, hash, trusted } = normalized;
      let builtParams: Optional<WireFormat.Core.Params> = params
        ? buildParams(params, symbols)
        : undefined;
      let builtHash: Optional<WireFormat.Core.Hash> = hash ? buildHash(hash, symbols) : undefined;
      let builtExpr = buildCallHead(
        path,
        trusted
          ? VariableResolutionContext.ResolveAsHelperHead
          : VariableResolutionContext.ResolveAsComponentOrHelperHead,
        symbols
      ) as WireFormat.Expressions.GetUnknownAppend;

      if (Array.isArray(builtExpr) && builtExpr[0] === Op.GetFreeAsComponentOrHelperHead) {
        return [trusted ? [Op.UnknownTrustingAppend, builtExpr] : [Op.UnknownAppend, builtExpr]];
      }

      const type = callType(builtExpr);
      const call: WireFormat.Expressions.SomeHelper = [
        type,
        builtExpr,
        buildArgs(builtParams, builtHash),
      ];

      return [[trusted ? Op.TrustingAppend : Op.Append, call]];
    }

    case LITERAL_HEAD: {
      return [[Op.Append, normalized.value]];
    }

    case COMMENT_HEAD: {
      return [[Op.Comment, normalized.value]];
    }

    case BLOCK_HEAD: {
      let blocks = buildBlocks(normalized.blocks, normalized.blockParams, symbols);
      let hash = buildHash(normalized.hash, symbols);
      let params = buildParams(normalized.params, symbols);
      let path = buildCallHead(
        normalized.head,
        VariableResolutionContext.ResolveAsComponentHead,
        symbols
      );

      const args = buildBlockArgs(params, hash, blocks);

      return [[...blockType(path), args]];
    }

    case KEYWORD_HEAD: {
      return [buildKeyword(normalized, symbols)];
    }

    case ELEMENT_HEAD:
      return buildElement(normalized, symbols);

    case MODIFIER_HEAD:
      throw unimpl('modifier');

    case DYNAMIC_COMPONENT_HEAD:
      throw unimpl('dynamic component');

    default:
      assertNever(normalized);
  }
}

export function s(
  arr: TemplateStringsArray,
  ...interpolated: unknown[]
): [BUILDER_LITERAL, string] {
  let result = arr.reduce(
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- @fixme
    (result, string, i) => result + `${string}${interpolated[i] ? String(interpolated[i]) : ''}`,
    ''
  );

  return [BUILDER_LITERAL, result];
}

export function c(arr: TemplateStringsArray, ...interpolated: unknown[]): BuilderComment {
  let result = arr.reduce(
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- @fixme
    (result, string, i) => result + `${string}${interpolated[i] ? String(interpolated[i]) : ''}`,
    ''
  );

  return [BUILDER_COMMENT, result];
}

export function unicode(charCode: string): string {
  return String.fromCharCode(parseInt(charCode, 16));
}

export const NEWLINE = '\n';

function buildKeyword(
  normalized: NormalizedKeywordStatement,
  symbols: Symbols
): WireFormat.Statement {
  let { name } = normalized;
  let params = buildParams(normalized.params, symbols);
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
    case 'let':
      return [Op.Let, expect(params, 'let requires params'), block];
    case 'if':
      return [Op.If, expect(params, 'if requires params')[0], block, inverse];
    case 'each': {
      let keyExpr = normalized.hash ? normalized.hash['key'] : null;
      let key = keyExpr ? buildExpression(keyExpr, 'Strict', symbols) : null;
      return [Op.Each, expect(params, 'if requires params')[0], key, block, inverse];
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
    hasSplat(attrs) ? [Op.OpenElementWithSplat, name] : [Op.OpenElement, name],
  ];
  if (attrs) {
    let { params, named } = buildElementParams(attrs, symbols);
    if (params) out.push(...params);
    localAssert(named === undefined, `Can't pass args to a simple element`);
  }
  out.push([Op.FlushElement]);

  if (Array.isArray(block)) {
    block.forEach((s) => out.push(...buildStatement(s, symbols)));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    localAssert(block === null, `The only remaining type of 'block' is 'null'`);
  }

  out.push([Op.CloseElement]);

  return out;
}

function hasSplat(attrs: Nullable<NormalizedAttrs>): boolean {
  if (attrs === null) return false;

  return Object.keys(attrs).some((a) => attrs[a] === SPLAT_HEAD);
}

export function buildAngleInvocation(
  { attrs, block, head }: NormalizedAngleInvocation,
  symbols: Symbols
): WireFormat.Statements.Component {
  let paramList: Optional<WireFormat.Core.Splattributes>;
  let named: Optional<WireFormat.Core.Hash> = undefined;
  let blockList: WireFormat.Statement[] = [];

  if (attrs) {
    let built = buildElementParams(attrs, symbols);
    paramList = built.params;
    named = built.named;
  }

  if (block) blockList = buildNormalizedStatements(block, symbols);

  const args: Optional<WireFormat.Core.ComponentArgs> = buildComponentArgs(paramList, named, [
    ['default'],
    [[blockList, []]],
  ]);

  return [
    Op.Component,
    buildExpression(head, VariableResolutionContext.ResolveAsComponentHead, symbols),
    args,
  ];
}

export function buildElementParams(
  attrs: NormalizedAttrs,
  symbols: Symbols
): { params: Optional<WireFormat.Core.Splattributes>; named: Optional<WireFormat.Core.Hash> } {
  let params: Optional<WireFormat.Core.Splattributes>;
  let keys: string[] = [];
  let values: WireFormat.Expression[] = [];

  for (const [key, value] of Object.entries(attrs)) {
    if (value === SPLAT_HEAD) {
      const statement: WireFormat.ElementParameter = [Op.AttrSplat, symbols.block('&attrs')];
      params = upsert(params, statement);
    } else if (key[0] === '@') {
      keys.push(key);
      values.push(buildExpression(value, 'Strict', symbols));
    } else {
      const statements = buildAttributeValue(
        key,
        value,
        // TODO: extract namespace from key
        extractNamespace(key),
        symbols
      );

      if (statements) {
        params = upsert(params, ...statements);
      }
    }
  }

  return {
    params,
    named: isPresentArray(keys) && isPresentArray(values) ? [keys, values] : undefined,
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
  namespace: Nullable<AttrNamespace>,
  symbols: Symbols
): Optional<PresentArray<WireFormat.Attribute>> {
  switch (value.type) {
    case LITERAL_EXPR: {
      let val = value.value;

      if (val === false) {
        return;
      } else if (val === true) {
        return [[Op.StaticAttr, name, '', namespace ?? undefined]];
      } else if (typeof val === 'string') {
        return [[Op.StaticAttr, name, val, namespace ?? undefined]];
      } else {
        throw new Error(`Unexpected/unimplemented literal attribute ${JSON.stringify(val)}`);
      }
    }

    default:
      return [
        [
          Op.DynamicAttr,
          name,
          buildExpression(value, 'AttrValue', symbols),
          namespace ?? undefined,
        ],
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

function varContext(context: ExprResolution, bare: boolean): VarResolution {
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
    case GET_PATH_EXPR: {
      return buildGetPath(expr, symbols);
    }

    case GET_VAR_EXPR: {
      return buildVar(expr.variable, varContext(context, true), symbols);
    }

    case CONCAT_EXPR: {
      return [Op.Concat, buildConcat(expr.params, symbols)];
    }

    case CALL_EXPR: {
      let builtParams = buildParams(expr.params, symbols);
      let builtHash = buildHash(expr.hash, symbols);
      let builtExpr = buildCallHead(
        expr.head,
        context === 'Strict' ? 'SubExpression' : varContext(context, false),
        symbols
      );

      return [callType(builtExpr), builtExpr, buildArgs(builtParams, builtHash)];
    }

    case HAS_BLOCK_EXPR: {
      return [
        Op.HasBlock,
        buildVar(
          { kind: BLOCK_VAR, name: expr.name, mode: 'loose' },
          VariableResolutionContext.Strict,
          symbols
        ),
      ];
    }

    case HAS_BLOCK_PARAMS_EXPR: {
      return [
        Op.HasBlockParams,
        buildVar(
          { kind: BLOCK_VAR, name: expr.name, mode: 'loose' },
          VariableResolutionContext.Strict,
          symbols
        ),
      ];
    }

    case LITERAL_EXPR: {
      if (expr.value === undefined) {
        return [Op.Undefined];
      } else {
        return expr.value;
      }
    }

    default:
      assertNever(expr);
  }
}

export function buildCallHead(
  callHead: NormalizedHead,
  context: VarResolution,
  symbols: Symbols
): Expressions.GetVar | Expressions.GetPath {
  if (callHead.type === GET_VAR_EXPR) {
    return buildVar(callHead.variable, context, symbols);
  } else {
    return buildGetPath(callHead, symbols);
  }
}

export function buildGetPath(head: NormalizedPath, symbols: Symbols): Expressions.GetPath {
  return buildVar(head.path.head, VariableResolutionContext.Strict, symbols, head.path.tail);
}

type VarResolution =
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
  context: VarResolution,
  symbols: Symbols,
  path: PresentArray<string>
): Expressions.GetPath;
export function buildVar(
  head: Variable,
  context: VarResolution,
  symbols: Symbols
): Expressions.GetVar;
export function buildVar(
  head: Variable,
  context: VarResolution,
  symbols: Symbols,
  path?: PresentArray<string>
): Expressions.GetPath | Expressions.GetVar {
  let op: Expressions.GetPath[0] | Expressions.GetVar[0] = Op.GetSymbol;
  let sym: number;
  switch (head.kind) {
    case FREE_VAR:
      if (context === 'Strict') {
        op = Op.GetStrictKeyword;
      } else if (context === 'AppendBare') {
        op = Op.GetFreeAsComponentOrHelperHead;
      } else if (context === 'AppendInvoke') {
        op = Op.GetFreeAsComponentOrHelperHead;
      } else if (context === 'TrustedAppendBare') {
        op = Op.GetFreeAsHelperHead;
      } else if (context === 'TrustedAppendInvoke') {
        op = Op.GetFreeAsHelperHead;
      } else if (context === 'AttrValueBare') {
        op = Op.GetFreeAsHelperHead;
      } else if (context === 'AttrValueInvoke') {
        op = Op.GetFreeAsHelperHead;
      } else if (context === 'SubExpression') {
        op = Op.GetFreeAsHelperHead;
      } else {
        op = expressionContextOp(context);
      }
      sym = symbols.freeVar(head.name);
      break;
    default:
      op = Op.GetSymbol;
      sym = getSymbolForVar(head.kind, symbols, head.name);
  }

  if (path === undefined || path.length === 0) {
    return [op, sym];
  } else {
    localAssert(op !== Op.GetStrictKeyword, '[BUG] keyword with a path');
    return [op, sym, path];
  }
}

function getSymbolForVar(kind: Exclude<VariableKind, FREE_VAR>, symbols: Symbols, name: string) {
  switch (kind) {
    case ARG_VAR:
      return symbols.arg(name);
    case BLOCK_VAR:
      return symbols.block(name);
    case LOCAL_VAR:
      return symbols.local(name);
    case THIS_VAR:
      return symbols.this();
    default:
      return exhausted(kind);
  }
}

export function expressionContextOp(context: VariableResolutionContext): GetContextualFreeOpcode {
  switch (context) {
    case VariableResolutionContext.Strict:
      return Op.GetStrictKeyword;
    case VariableResolutionContext.ResolveAsComponentOrHelperHead:
      return Op.GetFreeAsComponentOrHelperHead;
    case VariableResolutionContext.ResolveAsHelperHead:
      return Op.GetFreeAsHelperHead;
    case VariableResolutionContext.ResolveAsModifierHead:
      return Op.GetFreeAsModifierHead;
    case VariableResolutionContext.ResolveAsComponentHead:
      return Op.GetFreeAsComponentHead;
    default:
      return exhausted(context);
  }
}

export function buildParams(
  exprs: Nullable<NormalizedParams>,
  symbols: Symbols
): Optional<WireFormat.Core.Params> {
  if (exprs === null || !isPresentArray(exprs)) return;

  return exprs.map((e) => buildExpression(e, 'Strict', symbols)) as WireFormat.Core.ConcatParams;
}

export function buildConcat(
  exprs: [NormalizedExpression, ...NormalizedExpression[]],
  symbols: Symbols
): WireFormat.Core.ConcatParams {
  return exprs.map((e) => buildExpression(e, 'AttrValue', symbols)) as WireFormat.Core.ConcatParams;
}

export function buildHash(
  exprs: Nullable<NormalizedHash>,
  symbols: Symbols
): Optional<WireFormat.Core.Hash> {
  if (exprs === null) return;

  let keys: Optional<PresentArray<string>>;
  let values: Optional<PresentArray<WireFormat.Expression>>;

  for (const [key, value] of Object.entries(exprs)) {
    keys = upsert(keys, key);
    values = upsert(values, buildExpression(value, 'Strict', symbols));
  }

  return keys && values ? [keys, values] : undefined;
}

export function buildBlock(
  block: NormalizedBlock,
  symbols: Symbols,
  locals: number[] = []
): WireFormat.SerializedInlineBlock {
  return [buildNormalizedStatements(block, symbols), locals];
}

export function buildBlocks(
  blocks: NormalizedBlocks,
  blockParams: Nullable<string[]>,
  parent: Symbols
): Optional<WireFormat.Core.Blocks> {
  let keys: Optional<PresentArray<string>>;
  let values: Optional<PresentArray<WireFormat.SerializedInlineBlock>>;

  for (const [name, block] of Object.entries(blocks)) {
    keys = upsert(keys, name);

    if (name === 'default') {
      let symbols = parent.child(blockParams || []);

      values = upsert(values, buildBlock(block, symbols, symbols.paramSymbols));
    } else {
      values = upsert(values, buildBlock(block, parent, []));
    }
  }

  return keys && values ? [keys, values] : undefined;
}

/**
 * Returns true if the expression is a call with a simple name (i.e. `(hello world)` or
 * `{{hello world}}`) and the name needs to be resolved via the resolver.
 *
 * If this function returns `false`, then it either has a non-simple callee (i.e. `this.hello`,
 * `@hello` or a nested `(hello)`) and we don't need special resolution machinery to invoke it.
 */
export function invokeType(
  expr: Expressions.Expression
): CallLexicalOpcode | CallResolvedOpcode | UnknownInvokeOpcode {
  if (!Array.isArray(expr)) throw Error('Something is suspicious @fixme');

  let type = expr[0];

  switch (type) {
    case Op.GetLexicalSymbol:
    case Op.GetSymbol:
      return Op.CallLexical;
    case Op.GetFreeAsComponentOrHelperHead:
      return Op.UnknownInvoke;
    case Op.GetFreeAsHelperHead:
    case Op.GetStrictKeyword:
      return Op.CallResolved;
    default:
      throw Error(`Something is suspicious (unexpected ${type} opcode in append) @fixme`);
  }
}

export function callType(expr: Expressions.Expression): CallLexicalOpcode | CallResolvedOpcode {
  if (!Array.isArray(expr)) {
    throw Error('Something is suspicious @fixme');
  }

  let type = expr[0];

  switch (type) {
    case Op.GetFreeAsHelperHead:
    case Op.GetFreeAsModifierHead:
    case Op.GetFreeAsComponentHead:
    case Op.GetFreeAsComponentOrHelperHead:
    case Op.GetStrictKeyword:
      return Op.CallResolved;

    default:
      return Op.CallLexical;
  }
}

export function buildComponentArgs(
  splattributes: Optional<WireFormat.Core.Splattributes>,
  hash: Optional<WireFormat.Core.Hash>,
  blocks: Optional<WireFormat.Core.Blocks>
): Optional<WireFormat.Core.ComponentArgs> {
  return compact({
    splattributes,
    hash,
    blocks,
  });
}

export function buildBlockArgs(
  params: Optional<WireFormat.Core.Params>,
  hash: Optional<WireFormat.Core.Hash>,
  blocks: Optional<WireFormat.Core.Blocks>
): Optional<WireFormat.Core.BlockArgs> {
  return compact({
    params,
    hash,
    blocks,
  });
}

function buildArgs(
  params: Optional<WireFormat.Core.Params>,
  hash: Optional<WireFormat.Core.Hash>
): Optional<WireFormat.Core.Args> {
  if (!params && !hash) return undefined;

  const args: Partial<WireFormat.Core.Args> = {};

  if (params) args.params = params;
  if (hash) args.hash = hash;

  return args as WireFormat.Core.Args;
}

export function upsert<T>(array: Optional<PresentArray<T>>, ...values: PresentArray<T>) {
  if (array) {
    array.push(...values);
  } else {
    array = [...values];
  }

  return array;
}

type CompactObject<T> = Simplify<
  RequireAtLeastOne<
    {
      [K in keyof T as undefined extends T[K] ? never : K]: T[K];
    } & {
      [K in keyof T as undefined extends T[K] ? K : never]?: NonNullable<T[K]>;
    }
  >
>;

/**
 * Remove all `undefined` values from an object.
 *
 * The return type:
 *
 * - removes all properties whose value is literally `undefined`.
 * - replaces properties whose value is `T | undefined` with an optional property with the value
 *   `T`.
 *
 * Example:
 *
 * ```ts
 * interface Foo {
 *   foo?: number;
 *   bar: number | undefined;
 *   baz: number;
 *   bat?: number | undefined;
 * }
 *
 * const obj: Foo = {
 *   bar: 123,
 *   baz: 456,
 *   bat: undefined
 * };
 *
 * const compacted = compact(obj);
 *
 * // compacted is now:
 * interface Foo {
 *   foo?: number;
 *   bar?: number;
 *   baz: number;
 *   bat?: number;
 * }
 * ```
 */
export function compact<T extends object>(
  object: T | undefined
): Optional<Simplify<CompactObject<T>>> {
  if (!object) return;

  const entries = Object.entries(object).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries) as Simplify<CompactObject<T>> | undefined;
}

export function isGetLexical(
  path: Expressions.Expression
): path is WireFormat.Expressions.GetLexicalSymbol {
  return Array.isArray(path) && path.length === 2 && path[0] === Op.GetLexicalSymbol;
}

export function isGetPath(path: Expressions.Expression): path is WireFormat.Expressions.GetPath {
  if (!Array.isArray(path) || path.length !== 3) return false;

  switch (path[0]) {
    case Op.GetSymbol:
    case Op.GetLexicalSymbol:
      return true;
    default:
      return isGetContextualFree(path);
  }
}

export function isGetVar(path: Expressions.Expression): path is WireFormat.Expressions.GetVar[0] {
  if (!Array.isArray(path) || path.length !== 2) return false;

  switch (path[0]) {
    case Op.GetSymbol:
    case Op.GetLexicalSymbol:
    case Op.GetStrictKeyword:
      return true;
    default:
      return isGetContextualFree(path);
  }
}

export function isTupleExpression(
  path: Expressions.Expression
): path is WireFormat.Expressions.TupleExpression {
  return Array.isArray(path);
}

export function isGetContextualFree(
  path: Expressions.TupleExpression
): path is WireFormat.Expressions.GetContextualFree {
  switch (path[0]) {
    case Op.GetFreeAsComponentOrHelperHead:
    case Op.GetFreeAsHelperHead:
    case Op.GetFreeAsModifierHead:
    case Op.GetFreeAsComponentHead:
      return true;
    default:
      return false;
  }
}

export function isGet(expr: Expressions.Expression): expr is Expressions.Get {
  return isGetVar(expr) || isGetPath(expr);
}

export function assertGet(expr: Expressions.Expression): asserts expr is Expressions.Get {
  if (LOCAL_DEBUG) {
    localAssert(isGet(expr), `Expected ${JSON.stringify(expr)} to be a Get`);
  }
}

export function blockType(
  path: Expressions.Get
):
  | [LexicalBlockOpcode, WireFormat.Expressions.GetLexicalSymbol]
  | [ResolvedBlockOpcode, WireFormat.Expressions.GetContextualFree]
  | [DynamicBlockOpcode, WireFormat.Expressions.GetPath] {
  if (isGetLexical(path)) {
    return [Op.LexicalBlock, path];
  } else if (path.length === 2) {
    return [Op.ResolvedBlock, path as WireFormat.Expressions.GetContextualFree];
  } else {
    return [Op.DynamicBlock, path];
  }
}
