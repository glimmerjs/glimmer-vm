import type { VariableKind } from '@glimmer/constants';
import type {
  AttrNamespace,
  Expressions,
  GetResolvedOrKeywordOpcode,
  InvokeDynamicBlockOpcode,
  InvokeLexicalAngleComponentOpcode,
  InvokeResolvedBlockComponentOpcode,
  Nullable,
  Optional,
  PresentArray,
  WireFormat,
} from '@glimmer/interfaces';
import {
  APPEND_EXPR_HEAD,
  APPEND_PATH_HEAD,
  ARG_VAR,
  BLOCK_HEAD,
  BLOCK_VAR,
  BUILDER_COMMENT,
  BUILDER_LITERAL,
  CALL_EXPR,
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
import { assertNever } from '@glimmer/util';
import { isGetLexical, SexpOpcodes as Op, VariableResolutionContext } from '@glimmer/wire-format';

import type { Symbols } from '../builder';
import type {
  BuilderComment,
  BuilderStatement,
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

import { compact, isGet, isInvokeResolved, needsAtNames, ProgramSymbols } from '../builder';
import { normalizeStatement } from './builder-interface';

export function buildStatements(
  statements: BuilderStatement[],
  symbols: Symbols
): WireFormat.Content[] {
  let out: WireFormat.Content[] = [];

  statements.forEach((s) => out.push(...buildStatement(normalizeStatement(s), symbols)));

  return out;
}

export function buildNormalizedStatements(
  statements: NormalizedStatement[],
  symbols: Symbols
): WireFormat.Content[] {
  let out: WireFormat.Content[] = [];

  statements.forEach((s) => out.push(...buildStatement(s, symbols)));

  return out;
}

export function buildStatement(
  normalized: NormalizedStatement,
  symbols: Symbols = new ProgramSymbols()
): WireFormat.Content[] {
  switch (normalized.kind) {
    case APPEND_PATH_HEAD: {
      const path = buildGetPath(normalized.path, symbols);
      return [normalized.trusted ? [Op.AppendTrustedHtml, path] : buildAppendCautiously(path)];
    }

    case APPEND_EXPR_HEAD: {
      const expr = buildExpression(
        normalized.expr,
        normalized.trusted ? 'TrustedAppend' : 'Append',
        symbols
      );
      return [normalized.trusted ? [Op.AppendTrustedHtml, expr] : buildAppendCautiously(expr)];
    }

    case LITERAL_HEAD: {
      return [[Op.AppendStatic, normalized.value]];
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

      const args = buildBlockArgs(params, hash, blocks, { path });

      // @ts-expect-error
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

export function buildAppendCautiously(expr: Expressions.Expression): WireFormat.Content.SomeAppend {
  if (Array.isArray(expr)) {
    if (expr[0] === Op.GetFreeAsComponentOrHelperHead) {
      return [Op.AppendResolvedInvokable, expr[1]];
    } else if (isInvokeResolved(expr)) {
      const [, callee, args] = expr;

      return [Op.AppendResolvedInvokable, callee, args];
    }

    return [Op.AppendValueCautiously, expr];
  }

  if (typeof expr === 'string') {
    return [Op.AppendHtmlText, expr];
  } else {
    return [Op.AppendStatic, expr];
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

function buildKeyword(
  normalized: NormalizedKeywordStatement,
  symbols: Symbols
): WireFormat.Content {
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
): WireFormat.Content[] {
  let out: WireFormat.Content[] = [
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

      if (builtExpr.length === 2) {
        switch (builtExpr[0]) {
          case Op.GetFreeAsHelperHead:
          case Op.GetFreeAsComponentOrHelperHead:
            return [Op.CallResolved, builtExpr[1], buildArgs(builtParams, builtHash)];
        }
      }

      return [Op.CallDynamicValue, builtExpr, buildArgs(builtParams, builtHash)];
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
  let op: Expressions.GetPath[0] | Expressions.GetVar[0] = Op.GetLocalSymbol;
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
      op = Op.GetLocalSymbol;
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

export function expressionContextOp(
  context: VariableResolutionContext
): GetResolvedOrKeywordOpcode {
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

type ExprResolution =
  | VariableResolutionContext
  | 'Append'
  | 'TrustedAppend'
  | 'AttrValue'
  | 'SubExpression'
  | 'Strict';

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

export function buildBlockArgs(
  params: Optional<WireFormat.Core.Params>,
  rawHash: Optional<WireFormat.Core.Hash>,
  blocks: Optional<WireFormat.Core.Blocks>,
  { path }: { path: WireFormat.Core.Expression }
): Optional<WireFormat.Core.BlockArgs> {
  const hash: Optional<WireFormat.Core.Hash> =
    isGet(path) && needsAtNames(path) ? addAtNames(rawHash) : rawHash;

  return compact({
    params,
    hash,
    blocks,
  });
}

function addAtNames(hash: Optional<WireFormat.Core.Hash>): Optional<WireFormat.Core.Hash> {
  if (!hash) return;

  const [keys, values] = hash;

  return [keys.map((key) => `@${key}`) as PresentArray<string>, values];
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

export function buildGetPath(head: NormalizedPath, symbols: Symbols): Expressions.GetPath {
  return buildVar(head.path.head, VariableResolutionContext.Strict, symbols, head.path.tail);
}

function unimpl(message: string): Error {
  return new Error(`unimplemented ${message}`);
}

export function unicode(charCode: string): string {
  return String.fromCharCode(parseInt(charCode, 16));
}

export function upsert<T>(array: Optional<PresentArray<T>>, ...values: PresentArray<T>) {
  if (array) {
    array.push(...values);
  } else {
    array = [...values];
  }

  return array;
}

export function blockType(
  path: Expressions.Get
):
  | [InvokeLexicalAngleComponentOpcode, WireFormat.Expressions.GetLexicalSymbol]
  | [InvokeResolvedBlockComponentOpcode, WireFormat.Expressions.GetResolved]
  | [InvokeDynamicBlockOpcode, WireFormat.Expressions.GetPath] {
  if (path.length === 2) {
    if (isGetLexical(path)) {
      // @fixme is this possible?
      return [Op.InvokeLexicalAngleComponent, path];
    } else {
      localAssert(
        path[0] !== Op.GetFreeAsHelperHead &&
          path[0] !== Op.GetFreeAsModifierHead &&
          path[0] !== Op.GetLocalSymbol &&
          path[0] !== Op.GetStrictKeyword,
        '[BUG] resolved block with non-resolved path'
      );
      return [Op.InvokeResolvedBlockComponent, path];
    }
  }

  return [Op.InvokeDynamicBlock, path];
}

export const NEWLINE = '\n';
