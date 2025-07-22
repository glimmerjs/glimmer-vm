import type { VariableKind } from '@glimmer/constants';
import type {
  AttrNamespace,
  Buildable,
  Expressions,
  GetResolvedOrKeywordOpcode,
  Nullable,
  Optional,
  PresentArray,
  WireFormat,
} from '@glimmer/interfaces';
import {
  APPEND_EXPR_HEAD,
  APPEND_INVOKE_HEAD,
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
  RESOLVED_CALLEE,
  SPLAT_HEAD,
  THIS_VAR,
} from '@glimmer/constants';
import { exhausted, expect, isPresentArray, localAssert, unreachable } from '@glimmer/debug-util';
import { assertNever, enumerate, zipTuples } from '@glimmer/util';
import {
  BLOCKS_OPCODE,
  EMPTY_ARGS_OPCODE,
  NAMED_ARGS_AND_BLOCKS_OPCODE,
  NAMED_ARGS_OPCODE,
  POSITIONAL_AND_BLOCKS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE,
  POSITIONAL_AND_NAMED_ARGS_OPCODE,
  POSITIONAL_ARGS_OPCODE,
  SexpOpcodes as Op,
  VariableResolutionContext,
} from '@glimmer/wire-format';

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

import { compactSexpr } from '../../passes/2-encoding/content';
import { normalizeStatement } from './builder-interface';

function getOps(expr: WireFormat.Expression): WireFormat.Expressions.StackOperation[] {
  if (expr[0] === Op.StackExpression) {
    return expr.slice(1) as WireFormat.Expressions.StackOperation[];
  } else {
    return [expr as WireFormat.Expressions.StackOperation];
  }
}

/**
 * Helper to create a StackExpression for resolved helper calls
 */
function createResolvedHelperStack(
  symbol: number,
  builtParams?: WireFormat.Expression[],
  builtHash?: WireFormat.Core.Hash
): WireFormat.Expressions.StackExpression {
  const operations: WireFormat.Expressions.StackOperation[] = [[Op.BeginCall]];

  // Push positional args
  if (builtParams) {
    for (const param of builtParams) {
      operations.push(...getOps(param));
    }
  }

  // Push named args
  const namedNames: string[] = [];
  if (builtHash) {
    const [names, values] = builtHash;
    for (const [_, name, value] of zipTuples(names, values)) {
      namedNames.push(name);
      operations.push(...getOps(value));
    }
  }

  const positionalCount = builtParams ? builtParams.length : 0;
  const flags = (positionalCount << 4) | 0b0000;
  operations.push([Op.PushArgs, namedNames, [], flags]);
  operations.push([Op.CallHelper, symbol]);

  return [Op.StackExpression, ...operations];
}

/**
 * Helper to create a StackExpression for dynamic helper calls
 */
function createDynamicHelperStack(
  calleeExpr: WireFormat.Expression,
  builtParams?: WireFormat.Expression[],
  builtHash?: WireFormat.Core.Hash
): WireFormat.Expressions.StackExpression {
  const operations: WireFormat.Expressions.StackOperation[] = [];

  // First push the callee expression
  if (Array.isArray(calleeExpr) && calleeExpr[0] === Op.StackExpression) {
    operations.push(...(calleeExpr.slice(1) as WireFormat.Expressions.StackOperation[]));
  } else {
    operations.push(calleeExpr as WireFormat.Expressions.StackOperation);
  }

  // Then BeginCallDynamic, which will save the helper ref
  operations.push([Op.BeginCallDynamic]);

  // Push positional args
  if (builtParams) {
    for (const param of builtParams) {
      if (Array.isArray(param) && param[0] === Op.StackExpression) {
        operations.push(...(param.slice(1) as WireFormat.Expressions.StackOperation[]));
      } else if (typeof param === 'number') {
        // SimpleStackOp - already an operation
        operations.push(param);
      } else if (Array.isArray(param)) {
        // Other expressions need to be pushed first
        operations.push(param);
      }
    }
  }

  // Push named args
  const namedNames: string[] = [];
  if (builtHash) {
    const [names, values] = builtHash;
    for (const [i, name] of enumerate(names)) {
      namedNames.push(name);
      const value = values[i];
      if (Array.isArray(value) && value[0] === Op.StackExpression) {
        operations.push(...(value.slice(1) as WireFormat.Expressions.StackOperation[]));
      } else if (typeof value === 'number') {
        // SimpleStackOp - already an operation
        operations.push(value);
      } else if (Array.isArray(value)) {
        // Other expressions need to be pushed first
        operations.push(value);
      }
    }
  }

  const positionalCount = builtParams ? builtParams.length : 0;
  const flags = (positionalCount << 4) | 0b0000;
  operations.push([Op.PushArgs, namedNames, [], flags]);
  operations.push([Op.CallDynamicHelper]);

  return [Op.StackExpression, ...operations];
}

export function buildStatements(
  statements: BuilderStatement[],
  symbols: Symbols
): WireFormat.Content[] {
  return statements.flatMap((s) => {
    return buildStatement(normalizeStatement(s), symbols).map(compactSexpr);
  });
}

export function buildNormalizedStatements(
  statements: NormalizedStatement[],
  symbols: Symbols
): WireFormat.Content[] {
  return statements.flatMap((s) => {
    return buildStatement(s, symbols).map(compactSexpr);
  });
}

export function buildStatement(
  normalized: NormalizedStatement,
  symbols: Symbols
): Buildable<WireFormat.Content>[] {
  switch (normalized.kind) {
    case APPEND_INVOKE_HEAD: {
      const { callee, args, trusted } = normalized;

      if (callee.type === 'GetVar' && callee.variable.kind === 'Resolved') {
        const calleeSymbol = symbols.resolved(callee.variable.name);
        const wireArgs = buildNormalizedCallArgs(args?.params, args?.hash, symbols);

        return [
          [
            trusted ? Op.AppendTrustedResolvedInvokable : Op.AppendResolvedInvokableCautiously,
            calleeSymbol,
            wireArgs,
          ],
        ];
      }

      throw new Error(
        `unimplemented buildStatement for APPEND_INVOKE_HEAD ${JSON.stringify(normalized)}`
      );

      // const args = normalized.args
      //   ? [buildParams(normalized.args.params, symbols), buildHash(normalized.args.hash, symbols)]
      //   : [EMPTY_ARGS_OPCODE, EMPTY_ARGS_OPCODE];

      // debugger;

      // return [
      //   normalized.trusted
      //     ? [Op.App, symbols.resolved(normalized.callee.name), args]
      //     : [Op.AppendInvokable, symbols.resolved(normalized.callee.name), args],
      // ];
    }

    case APPEND_PATH_HEAD: {
      const path = buildGetPath(normalized.path, symbols);
      return [normalized.trusted ? [Op.AppendTrustedHtml, path] : buildAppendCautiously(path)];
    }

    case APPEND_EXPR_HEAD: {
      if (normalized.expr.type === GET_VAR_EXPR && normalized.expr.variable.kind === 'Resolved') {
        if (normalized.trusted) {
          return [[Op.AppendTrustedResolvedHtml, symbols.resolved(normalized.expr.variable.name)]];
        }
      }

      if (normalized.expr.type === GET_VAR_EXPR && normalized.expr.variable.kind === 'Resolved') {
        return [
          normalized.trusted
            ? [Op.AppendTrustedResolvedHtml, symbols.resolved(normalized.expr.variable.name)]
            : [Op.AppendResolvedValueCautiously, symbols.resolved(normalized.expr.variable.name)],
        ];
      }

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
      const { head, blocks, blockParams, hash, params } = normalized;

      const isResolved = head.type === 'GetVar' && head.variable.kind === 'Resolved';

      const args = buildBlockArgs(
        buildParams(params, symbols),
        buildHash(hash, symbols),
        buildBlocks(blocks, blockParams, symbols),
        { needsAtNames: isResolved }
      );

      if (isResolved) {
        return [[Op.InvokeResolvedComponent, symbols.resolved(head.variable.name), args]];
      } else {
        return [[Op.InvokeDynamicComponent, buildCallHead(head, 'Strict', symbols), args]];
      }
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

export function buildAppendCautiously(
  expr: Expressions.Expression
):
  | WireFormat.Content.AppendValueCautiously
  | WireFormat.Content.AppendHtmlText
  | WireFormat.Content.AppendStatic {
  if (Array.isArray(expr)) {
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
    : undefined;

  switch (name) {
    case 'let':
      return [Op.Let, expect(params, 'let requires params'), block];
    case 'if':
      return compactSexpr([Op.If, expect(params, 'if requires params')[0], block, inverse]);
    case 'each': {
      let keyExpr = normalized.hash ? normalized.hash['key'] : null;
      let key = keyExpr ? buildExpression(keyExpr, 'Strict', symbols) : null;
      return compactSexpr([Op.Each, expect(params, 'if requires params')[0], key, block, inverse]);
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
    block.forEach((s) => out.push(...buildStatement(s, symbols).map(compactSexpr)));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    localAssert(block === null, `The only remaining type of 'block' is 'null'`);
  }

  out.push([Op.CloseElement]);

  return out;
}

function hasSplat(attrs: Optional<NormalizedAttrs>): boolean {
  if (attrs === undefined) return false;

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
      // Build a StackExpression with flattened parts
      const operations: WireFormat.Expressions.StackOperation[] = [];
      const parts = expr.params;

      // Flatten all parts first
      for (const part of parts) {
        const builtPart = buildExpression(part, 'AttrValue', symbols);
        if (Array.isArray(builtPart) && builtPart[0] === Op.StackExpression) {
          // Extract operations from nested StackExpression
          operations.push(...(builtPart.slice(1) as WireFormat.Expressions.StackOperation[]));
        } else if (typeof builtPart === 'string' || typeof builtPart === 'number') {
          // For primitive values, wrap in PushConstant
          operations.push([Op.PushConstant, builtPart]);
        } else {
          // For other expressions (like GetVar), they should already be proper operations
          operations.push(builtPart as WireFormat.Expressions.StackOperation);
        }
      }

      // Then emit concat with arity
      operations.push([Op.Concat, parts.length]);

      return [Op.StackExpression, ...operations];
    }

    case CALL_EXPR: {
      let builtParams = buildParams(expr.params, symbols);
      let builtHash = buildHash(expr.hash, symbols);

      // Check if this is a resolved helper call
      if (expr.head.type === GET_VAR_EXPR && expr.head.variable.kind === RESOLVED_CALLEE) {
        const symbol = symbols.resolved(expr.head.variable.name);
        return createResolvedHelperStack(symbol, builtParams, builtHash);
      }

      let builtExpr = buildCallHead(
        expr.head,
        context === 'Strict' ? 'SubExpression' : varContext(context, false),
        symbols
      );

      return createDynamicHelperStack(builtExpr, builtParams, builtHash);
    }

    case HAS_BLOCK_EXPR: {
      const varExpr = buildVar(
        { kind: BLOCK_VAR, name: expr.name, mode: 'loose' },
        VariableResolutionContext.Strict,
        symbols
      );
      // buildVar returns a StackExpression, extract its operations and append Op.HasBlock
      const operations = varExpr.slice(1) as WireFormat.Expressions.StackOperation[];
      return [Op.StackExpression, ...operations, Op.HasBlock];
    }

    case HAS_BLOCK_PARAMS_EXPR: {
      const varExpr = buildVar(
        { kind: BLOCK_VAR, name: expr.name, mode: 'loose' },
        VariableResolutionContext.Strict,
        symbols
      );
      // buildVar returns a StackExpression, extract its operations and append Op.HasBlockParams
      const operations = varExpr.slice(1) as WireFormat.Expressions.StackOperation[];
      return [Op.StackExpression, ...operations, Op.HasBlockParams];
    }

    case LITERAL_EXPR: {
      if (expr.value === undefined) {
        return [Op.StackExpression, Op.Undefined];
      } else {
        return [Op.StackExpression, [Op.PushConstant, expr.value]];
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
): Expressions.Expression {
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
): Expressions.StackExpression;
export function buildVar(
  head: Variable,
  context: VarResolution,
  symbols: Symbols
): Expressions.Expression;
export function buildVar(
  head: Variable,
  context: VarResolution,
  symbols: Symbols,
  path?: PresentArray<string>
): Expressions.Expression {
  let op: typeof Op.GetLocalSymbol | typeof Op.GetLexicalSymbol = Op.GetLocalSymbol;
  let sym: number;
  switch (head.kind) {
    case RESOLVED_CALLEE:
      switch (context) {
        case 'Strict':
          return [Op.GetKeyword, symbols.resolved(head.name)];
        case 'AppendBare':
          throw new Error('AppendBare should not be used in test utilities');
        case 'TrustedAppendBare':
        case 'TrustedAppendInvoke':
          return createResolvedHelperStack(symbols.resolved(head.name));
        case 'AttrValueBare':
        case 'AttrValueInvoke':
          return createResolvedHelperStack(symbols.resolved(head.name));
        case 'SubExpression':
          return createResolvedHelperStack(symbols.resolved(head.name));
        default:
          unreachable(`Unexpected context in test utilities: ${context}`);
      }

    default:
      op = Op.GetLocalSymbol;
      sym = getSymbolForVar(head.kind, symbols, head.name);
  }

  if (path === undefined || path.length === 0) {
    return [op, sym];
  } else {
    // Build a StackExpression: [StackExpressionOpcode, [op, sym], [GetProperty, prop1], [GetProperty, prop2], ...]
    const head = [op, sym] as Expressions.GetVar;
    const continuations: Expressions.GetProperty[] = path.map((prop) => [Op.GetProperty, prop]);
    return [Op.StackExpression, head, ...continuations] as Expressions.StackExpression;
  }
}

function getSymbolForVar(
  kind: Exclude<VariableKind, RESOLVED_CALLEE>,
  symbols: Symbols,
  name: string
) {
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
      return Op.GetKeyword;
    case VariableResolutionContext.ResolveAsComponentOrHelperHead:
      return Op.ResolveAsCurlyCallee;
    case VariableResolutionContext.ResolveAsHelperHead:
      return Op.ResolveAsHelperCallee;
    case VariableResolutionContext.ResolveAsModifierHead:
      return Op.ResolveAsModifierCallee;
    case VariableResolutionContext.ResolveAsComponentHead:
      return Op.ResolveAsComponentCallee;
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
  exprs: Optional<NormalizedParams>,
  symbols: Symbols
): Optional<WireFormat.Core.Params> {
  if (exprs === undefined || !isPresentArray(exprs)) return;

  return exprs.map((e) => buildExpression(e, 'Strict', symbols)) as WireFormat.Core.ConcatParams;
}

export function buildConcat(
  exprs: [NormalizedExpression, ...NormalizedExpression[]],
  symbols: Symbols
): WireFormat.Core.ConcatParams {
  return exprs.map((e) => buildExpression(e, 'AttrValue', symbols)) as WireFormat.Core.ConcatParams;
}

export function buildHash(
  exprs: Optional<NormalizedHash>,
  symbols: Symbols
): Optional<WireFormat.Core.Hash> {
  if (exprs === undefined) return;

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
  blockParams: Optional<string[]>,
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
  { needsAtNames }: { needsAtNames: boolean }
): WireFormat.Core.BlockArgs {
  if (!params && !rawHash && !blocks) {
    return [EMPTY_ARGS_OPCODE];
  }

  const hash: Optional<WireFormat.Core.Hash> = needsAtNames ? addAtNames(rawHash) : rawHash;

  if (!blocks) {
    return buildCallArgs(params, hash);
  }

  if (params && hash) {
    return [POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE, params, hash, blocks];
  } else if (params) {
    return [POSITIONAL_AND_BLOCKS_OPCODE, params, blocks];
  } else if (hash) {
    return [NAMED_ARGS_AND_BLOCKS_OPCODE, hash, blocks];
  } else {
    return [BLOCKS_OPCODE, blocks];
  }
}

function addAtNames(hash: Optional<WireFormat.Core.Hash>): Optional<WireFormat.Core.Hash> {
  if (!hash) return;

  const [keys, values] = hash;

  return [keys.map((key) => `@${key}`) as PresentArray<string>, values];
}

function buildNormalizedCallArgs(
  normalizedParams: Optional<NormalizedParams>,
  normalizedHash: Optional<NormalizedHash>,
  symbols: Symbols
): WireFormat.Core.CallArgs {
  const params = buildParams(normalizedParams, symbols);
  const hash = buildHash(normalizedHash, symbols);

  if (params && hash) {
    return [POSITIONAL_AND_NAMED_ARGS_OPCODE, params, hash];
  } else if (params) {
    return [POSITIONAL_ARGS_OPCODE, params];
  } else if (hash) {
    return [NAMED_ARGS_OPCODE, hash];
  } else {
    return [EMPTY_ARGS_OPCODE];
  }
}

function buildCallArgs(
  params: Optional<WireFormat.Core.Params>,
  hash: Optional<WireFormat.Core.Hash>
): WireFormat.Core.CallArgs {
  if (params && hash) {
    return [POSITIONAL_AND_NAMED_ARGS_OPCODE, params, hash];
  } else if (params) {
    return [POSITIONAL_ARGS_OPCODE, params];
  } else if (hash) {
    return [NAMED_ARGS_OPCODE, hash];
  } else {
    return [EMPTY_ARGS_OPCODE];
  }
}

export function buildGetPath(head: NormalizedPath, symbols: Symbols): Expressions.StackExpression {
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

export const NEWLINE = '\n';
