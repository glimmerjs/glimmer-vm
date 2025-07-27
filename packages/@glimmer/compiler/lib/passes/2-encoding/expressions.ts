import type { Optional, WireFormat } from '@glimmer/interfaces';
import type { ASTv2 } from '@glimmer/syntax';
import { isSmallInt } from '@glimmer/constants';
import { assertPresentArray, exhausted } from '@glimmer/debug-util';
import { EMPTY_STRING_ARRAY } from '@glimmer/util';
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
} from '@glimmer/wire-format';

import type * as mir from './mir';

import { createEncodingView } from '../../shared/post-validation-view';
import { NamedBlocks } from './content';

export type HashPair = [string, WireFormat.Expression];

// The encoder assumes the MIR has been validated
const view = createEncodingView();

/**
 * Helper function to flatten expressions into stack operations.
 * If the expression is already a StackExpression, it extracts its operations.
 * Otherwise, it returns the expression as a single operation.
 */
function flattenExpression(expr: WireFormat.Expression): WireFormat.Expressions.StackOperation[] {
  if (Array.isArray(expr) && expr[0] === Op.StackExpression) {
    // Extract operations from StackExpression, skipping the Op.StackExpression marker
    return expr.slice(1) as WireFormat.Expressions.StackOperation[];
  } else {
    // Single operation
    return [expr as WireFormat.Expressions.StackOperation];
  }
}

function flatten(expr: mir.ExpressionValueNode): WireFormat.Expressions.StackOperation[] {
  return flattenExpression(encodeExpr(expr));
}

function buildArgs(args: mir.Args): WireFormat.Expressions.StackOperation[] {
  const operations: WireFormat.Expressions.StackOperation[] = [];

  const positional = args.positional.list.toPresentArray();
  const positionalCount = positional ? positional.length : 0;
  const namedNames: string[] = [];

  // Evaluate positional arguments
  if (positional) {
    for (const arg of positional) {
      const encoded = encodeExpr(view.get(arg));
      operations.push(...flattenExpression(encoded));
    }
  }

  // Evaluate named arguments
  const named = args.named.entries.toPresentArray();
  if (named) {
    for (const { name, value } of named) {
      namedNames.push(name.getString());
      const encoded = encodeExpr(view.get(value));
      operations.push(...flattenExpression(encoded));
    }
  }

  // Always push args to match what VM_DYNAMIC_HELPER_OP expects
  // Even with empty args, we need an Arguments object on the stack
  const flags = (positionalCount << 4) | 0b0000;
  operations.push([Op.PushArgs, namedNames, EMPTY_STRING_ARRAY, flags]);

  return operations;
}

/**
 * Shared helper to build a resolved helper call as a StackExpression
 */
export function buildResolvedHelperCall(
  symbol: number,
  args: mir.Args
): WireFormat.Expressions.StackExpression {
  const operations: WireFormat.Expressions.StackOperation[] = [[Op.BeginCall], ...buildArgs(args)];

  // Call the helper
  operations.push([Op.CallHelper, symbol]);

  return [Op.StackExpression, ...operations];
}

/**
 * Shared helper to build a dynamic helper call as a StackExpression
 */
export function buildDynamicHelperCall(
  callee: WireFormat.Expression,
  args: mir.Args
): WireFormat.Expressions.StackExpression {
  return [
    Op.StackExpression,
    ...flattenExpression(callee),
    [Op.BeginCallDynamic],
    ...buildArgs(args),
    [Op.CallDynamicHelper],
  ];
}

export function encodeMaybeExpr(
  expr: mir.ExpressionNode | mir.Missing
): WireFormat.Expression | undefined {
  return expr.type === 'Missing' ? undefined : encodeExpr(expr);
}

export function encodeInterpolatePart(expr: mir.AttrStyleInterpolatePart) {
  switch (expr.type) {
    case 'mir.CustomInterpolationPart':
      return encodeExpr(expr.value);
    default:
      return encodeCoreInterpolatePart(expr);
  }
}

export function encodeCoreInterpolatePart(
  expr: mir.CoreAttrStyleInterpolatePart
): WireFormat.Expressions.Expression {
  switch (expr.type) {
    case 'Literal':
      return Literal(expr);
    case 'mir.CurlyAttrValue':
      return encodeExpr(view.get(expr.value));
    case 'CurlyResolvedAttrValue': {
      // For resolved attr with no args, we need to create a minimal stack expression
      const operations: WireFormat.Expressions.StackOperation[] = [[Op.BeginCall]];
      // No arguments to push
      operations.push([Op.PushArgs, EMPTY_STRING_ARRAY, EMPTY_STRING_ARRAY, 0]);
      operations.push([Op.CallHelper, view.get(expr.resolved).symbol]);
      return [Op.StackExpression, ...operations];
    }

    case 'mir.CurlyInvokeAttr':
      return CallExpression(expr);
    case 'mir.CurlyInvokeResolvedAttr':
      return buildResolvedHelperCall(view.get(expr.resolved).symbol, expr.args);

    default:
      exhausted(expr);
  }
}

export function encodeAttrValue(expr: mir.AttrStyleValue): WireFormat.Expression {
  switch (expr.type) {
    case 'InterpolateExpression':
      return InterpolateExpression(expr);
    default:
      return encodeInterpolatePart(expr);
  }
}

export function encodeExpr(
  expr: ASTv2.VariableReference
): [WireFormat.StackExpressionOpcode, WireFormat.Expressions.GetPathHead];
export function encodeExpr(
  expr: ASTv2.LiteralExpression | mir.PathExpression | ASTv2.VariableReference | mir.CallExpression
): WireFormat.Expressions.StackExpression;
export function encodeExpr(expr: Extract<mir.ExpressionNode, object>): WireFormat.Expression;
export function encodeExpr(expr: ASTv2.UnresolvedBinding): never;
export function encodeExpr(
  expr: mir.ExpressionNode | mir.InterpolateExpression | mir.Missing | ASTv2.UnresolvedBinding
): WireFormat.Expression | undefined {
  // The validator should have caught any UnresolvedBinding before we get here
  if (expr.type === 'UnresolvedBinding') {
    throw new Error(
      `Unresolved binding '${expr.name}' found during encoding. The validator should have caught this.`
    );
  }

  switch (expr.type) {
    case 'Missing':
      return undefined;
    case 'Literal':
      return Literal(expr);
    case 'Keyword':
      return Keyword(expr);
    case 'CallExpression':
      return CallExpression(expr);
    case 'ResolvedCallExpression':
      return ResolvedCallExpression(expr);
    case 'PathExpression':
      return PathExpression(expr);
    case 'Arg':
      return Arg(expr);
    case 'Local':
      return Local(expr);
    case 'Lexical':
      return Lexical(expr);
    case 'This':
      return This();
    case 'HasBlock':
      return HasBlock(expr);
    case 'HasBlockParams':
      return HasBlockParams(expr);
    case 'Curry':
      return Curry(expr);
    case 'Not':
      return Not(expr);
    case 'IfExpression':
      return IfInline(expr);
    case 'GetDynamicVar':
      return GetDynamicVar(expr);
    case 'Log':
      return Log(expr);
    case 'InterpolateExpression':
      return InterpolateExpression(expr);
    case 'CustomNamedArgument':
      return encodeExpr((expr as mir.CustomNamedArgument<mir.ExpressionValueNode>).value);

    default:
      exhausted(expr);
  }
}

export function encodePositional(positional: mir.PresentPositional): WireFormat.Core.Params;
export function encodePositional(positional: mir.Positional): Optional<WireFormat.Core.Params>;
export function encodePositional({ list }: mir.Positional): Optional<WireFormat.Core.Params> {
  return list.map((l) => encodeExpr(view.get(l))).toPresentArray();
}

export function encodeComponentArguments(
  args: mir.ComponentArguments
): Optional<WireFormat.Core.Hash> {
  let list = args.entries.toPresentArray();

  if (list) {
    let names: string[] = [];
    let values: WireFormat.Expression[] = [];

    for (let pair of list) {
      let [name, value] = encodeComponentArgument(pair);
      names.push(name);
      values.push(value);
    }

    assertPresentArray(names);
    assertPresentArray(values);

    return [names, values];
  }
}

/**
 * `insertAtPrefix` controls whether the `@` prefix is inserted for named arguments.
 *
 * - `<AngleBrackets>`: no. They already have `@`-prefixes in their syntax.
 * - `{{#some-component}}`: yes. Their arguments are equivalent to `@`-prefixed named arguments.
 * - `{{component ...}}`: yes. Their arguments are equivalent to `@`-prefixed named arguments.
 */
export function encodeNamedArguments(
  named: mir.PresentCurlyNamedArguments,
  { insertAtPrefix }: { insertAtPrefix: boolean }
): WireFormat.Core.Hash;
export function encodeNamedArguments(
  named: mir.CurlyNamedArguments,
  { insertAtPrefix }: { insertAtPrefix: boolean }
): Optional<WireFormat.Core.Hash>;
export function encodeNamedArguments(
  { entries: pairs }: mir.CurlyNamedArguments,
  { insertAtPrefix }: { insertAtPrefix: boolean }
): Optional<WireFormat.Core.Hash> {
  let list = pairs.toPresentArray();

  if (list) {
    let names: string[] = [];
    let values: WireFormat.Expression[] = [];

    for (let pair of list) {
      let [name, value] = encodeNamedArgument(pair);
      names.push(insertAtPrefix ? `@${name}` : name);
      values.push(value);
    }

    assertPresentArray(names);
    assertPresentArray(values);

    return [names, values];
  }
}

/**
 * Encodes call-like arguments (positional and named arguments) into a `CallArgs` opcode with
 * appropriate tagging.
 *
 * This is used internally by other arg-encoding functions.
 *
 * See {@linkcode encodeNamedArguments} for information about `insertAtPrefix`.
 */
function encodeCallArgs(
  positionalArgs: mir.Args['positional'],
  namedArgs: mir.Args['named'],
  { insertAtPrefix }: { insertAtPrefix: boolean }
): WireFormat.Core.CallArgs {
  const positional = encodePositional(positionalArgs);
  const named = encodeNamedArguments(namedArgs, { insertAtPrefix });

  if (positional && named) {
    return [POSITIONAL_AND_NAMED_ARGS_OPCODE, positional, named];
  } else if (positional) {
    return [POSITIONAL_ARGS_OPCODE, positional];
  } else if (named) {
    return [NAMED_ARGS_OPCODE, named];
  } else {
    return [EMPTY_ARGS_OPCODE];
  }
}

export function callArgs(
  positionalArgs: mir.Args['positional'],
  namedArgs: mir.Args['named']
): WireFormat.Core.CallArgs {
  return encodeCallArgs(positionalArgs, namedArgs, { insertAtPrefix: false });
}

export function encodeComponentBlockArgs(
  positionalArgs: mir.Positional,
  namedArgs: mir.CurlyNamedArguments,
  blocksArgs: Optional<mir.NamedBlocks>
): WireFormat.Core.BlockArgs {
  const blocks = blocksArgs && NamedBlocks(blocksArgs);

  if (blocks) {
    const positional = encodePositional(positionalArgs);
    const named = encodeNamedArguments(namedArgs, { insertAtPrefix: true });

    if (positional && named) {
      return [POSITIONAL_AND_NAMED_ARGS_AND_BLOCKS_OPCODE, positional, named, blocks];
    } else if (positional) {
      return [POSITIONAL_AND_BLOCKS_OPCODE, positional, blocks];
    } else if (named) {
      return [NAMED_ARGS_AND_BLOCKS_OPCODE, named, blocks];
    } else {
      return [BLOCKS_OPCODE, blocks];
    }
  } else {
    return encodeCallArgs(positionalArgs, namedArgs, { insertAtPrefix: true });
  }
}

function encodeNamedArgument({ name, value }: mir.CurlyNamedArgument): HashPair {
  return [name.chars, encodeExpr(view.get(value))];
}

function encodeComponentArgument({ name, value }: mir.ComponentArgument): HashPair {
  return [name.chars, encodeAttrValue(value)];
}

function This(): WireFormat.Expressions.StackExpression {
  return [Op.StackExpression, [Op.GetLocalSymbol, 0]];
}

function Arg({ symbol }: ASTv2.ArgReference): WireFormat.Expressions.StackExpression {
  return [Op.StackExpression, [Op.GetLocalSymbol, symbol]];
}

function Literal({ value }: ASTv2.LiteralExpression): WireFormat.Expressions.StackExpression {
  if (value === undefined) {
    return [Op.StackExpression, Op.Undefined];
  } else if (typeof value === 'number' && isSmallInt(value)) {
    return [Op.StackExpression, [Op.PushImmediate, value]];
  } else {
    return [Op.StackExpression, [Op.PushConstant, value]];
  }
}

export function Missing(): undefined {
  return undefined;
}

function HasBlock({ symbol }: mir.HasBlock): WireFormat.Expressions.StackExpression {
  return [Op.StackExpression, [Op.GetLocalSymbol, symbol], Op.HasBlock];
}

function HasBlockParams({ symbol }: mir.HasBlockParams): WireFormat.Expressions.StackExpression {
  return [Op.StackExpression, [Op.GetLocalSymbol, symbol], Op.HasBlockParams];
}

function Curry({
  definition,
  curriedType,
  args,
}: mir.Curry): WireFormat.Expressions.StackExpression {
  // return [
  //   Op.StackExpression,
  //   ...flattenExpression(callee),
  //   [Op.BeginCallDynamic],
  //   ...buildArgs(args),
  //   [Op.CallDynamicHelper],
  // ];
  return [
    Op.StackExpression,
    ...flatten(definition),
    [Op.BeginCallDynamic],
    ...buildArgs(args),
    [Op.Curry, curriedType],
  ];
}

function Local({ symbol }: ASTv2.LocalVarReference): WireFormat.Expressions.StackExpression {
  return [Op.StackExpression, [Op.GetLocalSymbol, symbol]];
}

function Lexical({ symbol }: ASTv2.LexicalVarReference): WireFormat.Expressions.StackExpression {
  return [Op.StackExpression, [Op.GetLexicalSymbol, symbol]];
}

function Keyword({ symbol }: ASTv2.KeywordExpression): WireFormat.Expressions.GetKeyword {
  return [Op.GetKeyword, symbol];
}

function PathExpression({
  head,
  tail,
}: mir.PathExpression): WireFormat.Expressions.StackExpression {
  const headExpr = encodeExpr(view.get(head));
  const headOps = headExpr.slice(1) as WireFormat.Expressions.StackOperation[];

  const continuations: WireFormat.Expressions.GetProperty[] = [];

  for (const member of tail.members) {
    continuations.push([Op.GetProperty, member.chars]);
  }

  return [Op.StackExpression, ...headOps, ...continuations];
}

function InterpolateExpression({
  parts,
}: mir.InterpolateExpression): WireFormat.Expressions.StackExpression {
  const operations: WireFormat.Expressions.StackOperation[] = [];

  const partsArray = parts.toArray();

  // Flatten all parts first
  for (const part of partsArray) {
    const encoded = encodeInterpolatePart(part);
    operations.push(...flattenExpression(encoded));
  }

  // Then emit concat with arity
  operations.push([Op.Concat, partsArray.length]);

  return [Op.StackExpression, ...operations];
}

function ResolvedCallExpression(
  expr: mir.ResolvedCallExpression
): WireFormat.Expressions.StackExpression {
  return buildResolvedHelperCall(view.get(expr.callee).symbol, expr.args);
}

function CallExpression({
  callee,
  args,
}: mir.CallExpression | mir.CurlyInvokeAttr): WireFormat.Expressions.StackExpression {
  return buildDynamicHelperCall(encodeExpr(view.get(callee)), args);
}

function Not({ value }: mir.Not): WireFormat.Expressions.StackExpression {
  return [Op.StackExpression, ...flatten(value), Op.Not];
}

function IfInline({
  condition,
  truthy,
  falsy,
}: mir.IfExpression): WireFormat.Expressions.StackExpression {
  const operations: WireFormat.Expressions.StackOperation[] = [];

  // Order matters: falsy, truthy, then condition (matching runtime expectations)
  if (falsy) {
    operations.push(...flatten(falsy));
  } else {
    operations.push(Op.Undefined);
  }
  operations.push(...flatten(truthy));
  operations.push(...flatten(condition));
  operations.push(Op.IfInline);

  return [Op.StackExpression, ...operations];
}

function GetDynamicVar({ name }: mir.GetDynamicVar): WireFormat.Expressions.StackExpression {
  return [Op.StackExpression, ...flatten(name), Op.GetDynamicVar];
}

function Log({ positional }: mir.Log): WireFormat.Expressions.StackExpression {
  const args = positional.list.toArray();
  const operations = args.flatMap((arg) => flatten(view.get(arg)));

  return [Op.StackExpression, ...operations, [Op.Log, args.length]];
}
