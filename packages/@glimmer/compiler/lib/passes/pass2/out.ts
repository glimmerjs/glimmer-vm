import {
  Expressions,
  SexpOpcodes as op,
  WellKnownAttrName,
  WireFormat as wire,
} from '@glimmer/interfaces';
import { assertPresent } from '@glimmer/util';
import * as pass1 from '../pass1/ops';
import { SourceOffsets } from '../shared/location';
import { Op as AbstractOp } from '../shared/op';
import { deflateAttrName } from '../../utils';
import { ComponentBlock, NamedBlock } from './blocks';

/** ENCODABLE */

interface EncodableOp<
  N extends string = string,
  Wire extends wire.SyntaxWithInternal = wire.SyntaxWithInternal,
  Args = unknown
> extends AbstractOp {
  readonly name: N;
  readonly args: Args;
  encode(): Wire;
}

function out<N extends string, Wire extends wire.SyntaxWithInternal, Args>(
  name: N,
  encode: () => Wire
): EncodableOpConstructor<N, Wire, void>;
function out<N extends string, Wire extends wire.SyntaxWithInternal, Args>(
  name: N,
  encode: (args: Args) => Wire
): EncodableOpConstructor<N, Wire, Args>;
function out<N extends string, Wire extends wire.SyntaxWithInternal, Args>(
  name: N,
  encode: (args?: Args) => Wire
): EncodableOpConstructor<N, Wire, Args> {
  return class extends AbstractOp<Args> {
    readonly name = name;

    encode(): Wire {
      return encode(this.args);
    }
  };
}

function expr<N extends string, Wire extends wire.Expression, Args>(
  name: N,
  encode: () => Wire
): EncodableOpConstructor<N, Wire, void>;
function expr<N extends string, Wire extends wire.Expression, Args>(
  name: N,
  encode: (args: Args) => Wire
): EncodableOpConstructor<N, Wire, Args>;
function expr<N extends string, Wire extends wire.Expression, Args>(
  name: N,
  encode: (args?: Args) => Wire
): EncodableOpConstructor<N, Wire, Args> {
  return class extends AbstractOp<Args> {
    readonly name = name;

    encode(): Wire {
      return encode(this.args);
    }
  };
}

function stmt<N extends string, Wire extends wire.Statement, Args>(
  name: N,
  encode: () => Wire
): EncodableOpConstructor<N, Wire, void>;
function stmt<N extends string, Wire extends wire.Statement, Args>(
  name: N,
  encode: (args: Args) => Wire
): EncodableOpConstructor<N, Wire, Args>;
function stmt<N extends string, Wire extends wire.Statement, Args>(
  name: N,
  encode: (args?: Args) => Wire
): EncodableOpConstructor<N, Wire, Args> {
  return class extends AbstractOp<Args> {
    readonly name = name;

    encode(): Wire {
      return encode(this.args);
    }
  };
}

export type Expr<
  N extends string = string,
  Wire extends wire.Expression = wire.Expression,
  Args extends unknown = unknown
> = EncodableOp<N, Wire, Args>;

export type Stmt<
  N extends string = string,
  Wire extends wire.Statement = wire.Statement,
  Args extends unknown = unknown
> = EncodableOp<N, Wire, Args>;

export type EncodableOpConstructor<N extends string, Wire extends wire.SyntaxWithInternal, Args> = {
  new (offsets: SourceOffsets | null, args: Args): EncodableOp<N, Wire, Args>;
};

/** UTILITY TYPES */
export type SexpExpressionContext =
  | op.GetFreeInAppendSingleId
  | op.GetFreeInExpression
  | op.GetFreeInCallHead
  | op.GetFreeInBlockHead
  | op.GetFreeInModifierHead
  | op.GetFreeInComponentHead;

export type DeflatedAttrName = string | WellKnownAttrName;

/** #---- STACK VALUES ----# */

export class Params extends out(
  'Params',
  ({ list }: { list: [Expr, ...Expr[]] }) => list.map(l => l.encode()) as wire.Core.ConcatParams
) {}
export class Missing extends out('Missing', (): never => {
  throw new Error(`Internal Missing operation is not encodable`);
}) {}
export class EmptyParams extends out('EmptyParams', (): null => null) {}
export class Hash extends out(
  'Hash',
  (args: { pairs: [HashPair, ...HashPair[]] }): wire.Core.Hash => {
    let keys: string[] = [];
    let values: wire.Core.Expression[] = [];

    for (let pair of args.pairs) {
      let [key, value] = pair.encode();
      keys.push(key);
      values.push(value);
    }

    return [assertPresent(keys), assertPresent(values)];
  }
) {}

export class HashPair extends out('HashPair', (args: { key: SourceSlice; value: Expr }): [
  string,
  wire.Expression
] => [args.key.encode(), args.value.encode()]) {}

export class SourceSlice extends out('SourceSlice', (args: pass1.SourceSlice): string =>
  args.getString()
) {}

export class EmptyHash extends out('EmptyHash', (): null => null) {}

export type AnyParams = Params | EmptyParams;
export type AnyHash = Hash | EmptyHash;
export type Temporary = AnyParams | AnyHash | AnyNamedBlocks | HashPair | Missing | SourceSlice;

/** #---- EXPRESSIONS ----# */

export class Undefined extends expr('Undefined', () => [op.Undefined]) {}

export class Value extends expr('Value', ({ value }: { value: Expressions.Value }) => value) {}

export class GetSymbol extends expr(
  'GetSymbol',
  (args: { symbol: number }): wire.Get => [op.GetSymbol, args.symbol]
) {}

export class GetContextualFree extends expr(
  'GetContextualFree',
  (args: {
    symbol: number;
    context: SexpExpressionContext;
  }): wire.Expressions.GetContextualFree => [args.context, args.symbol]
) {}

export class GetPath extends expr(
  'GetPath',
  (args: { head: Expr; tail: [SourceSlice, ...SourceSlice[]] }): wire.Expressions.GetPath => [
    op.GetPath,
    args.head.encode(),
    args.tail.map(t => t.encode()) as [string, ...string[]],
  ]
) {}

export class Concat extends expr(
  'Concat',
  (args: { parts: Params }): wire.Expressions.Concat => [op.Concat, args.parts.encode()]
) {}

export class Call extends expr(
  'Call',
  (args: { head: Expr; params: AnyParams; hash: AnyHash }): wire.Expressions.Helper => [
    op.Call,
    args.head.encode(),
    args.params.encode(),
    args.hash.encode(),
  ]
) {}

export class HasBlock extends expr(
  'HasBlock',
  (args: { symbol: number }): wire.Expressions.HasBlock => [
    op.HasBlock,
    [op.GetSymbol, args.symbol],
  ]
) {}
export class HasBlockParams extends expr(
  'HasBlockParams',
  (args: { symbol: number }): wire.Expressions.HasBlockParams => [
    op.HasBlockParams,
    [op.GetSymbol, args.symbol],
  ]
) {}

/** strict mode */
export class GetFree extends expr(
  'GetFree',
  (args: { symbol: number }): wire.Expressions.GetFree => [op.GetFree, args.symbol]
) {}

export type AnyExpr =
  | HasBlock
  | HasBlockParams
  | Undefined
  | Value
  | GetSymbol
  | GetContextualFree
  | GetFree
  | GetPath
  | Concat
  | Call;

/** #---- STATEMENTS ----# */

export class TrustingAppend extends stmt(
  'TrustingAppend',
  (args: { value: Expr }): wire.Statements.TrustingAppend => [
    op.TrustingAppend,
    args.value.encode(),
  ]
) {}

export class Append extends stmt(
  'Append',
  (args: { value: Expr }): wire.Statements.Append => [op.Append, args.value.encode()]
) {}

export class AppendComment extends stmt(
  'AppendComment',
  (args: { value: SourceSlice }): wire.Statements.Comment => [op.Comment, args.value.encode()]
) {}

export class Debugger extends stmt(
  'Debugger',
  (args: { info: wire.Core.EvalInfo }): wire.Statements.Debugger => [op.Debugger, args.info]
) {}
export class Partial extends stmt(
  'Partial',
  (args: { expr: Expr; info: wire.Core.EvalInfo }): wire.Statements.Partial => [
    op.Partial,
    args.expr.encode(),
    args.info,
  ]
) {}
export class Yield extends stmt(
  'Yield',
  (args: { to: number; params: AnyParams }): wire.Statements.Yield => [
    op.Yield,
    args.to,
    args.params.encode(),
  ]
) {}

export class InElement extends stmt(
  'InElement',
  (args: {
    guid: string;
    block: NamedBlock;
    destination: Expr;
    insertBefore: Expr | Missing;
  }): wire.Statements.InElement => {
    let block = args.block.encode()[1];
    let guid = args.guid;
    let destination = args.destination.encode();
    let insertBefore = args.insertBefore;

    if (insertBefore.name === 'Missing') {
      return [op.InElement, block, guid, destination];
    } else {
      return [op.InElement, block, guid, destination, insertBefore.encode()];
    }
  }
) {}

export class EmptyNamedBlocks extends out('EmptyNamedBlocks', (): wire.Core.Blocks => null) {}
export class NamedBlocks extends out(
  'NamedBlocks',
  (args: { blocks: [NamedBlock, ...NamedBlock[]] }): wire.Core.Blocks => {
    let names: string[] = [];
    let serializedBlocks: wire.SerializedInlineBlock[] = [];

    for (let block of args.blocks) {
      let [name, serializedBlock] = block.encode();

      names.push(name);
      serializedBlocks.push(serializedBlock);
    }

    return [names, serializedBlocks];
  }
) {}

export type AnyNamedBlocks = EmptyNamedBlocks | NamedBlocks;

export class InvokeBlock extends stmt(
  'Component',
  (args: {
    head: Expr;
    params: AnyParams;
    hash: AnyHash;
    blocks: AnyNamedBlocks;
  }): wire.Statements.Block => [
    op.Block,
    args.head.encode(),
    args.params.encode(),
    args.hash.encode(),
    args.blocks.encode(),
  ]
) {}

export type TopLevel =
  | TrustingAppend
  | Append
  | AppendComment
  | Debugger
  | Partial
  | Yield
  | InElement
  | InvokeBlock;

/** --  args -- */
export class StaticArg extends stmt(
  'StaticArg',
  (args: { name: SourceSlice; value: Expr }): wire.Statements.StaticArg => [
    op.StaticArg,
    args.name.encode(),
    args.value.encode(),
  ]
) {
  encodeHash(): [key: string, value: wire.Expression] {
    return [this.args.name.encode(), this.args.value.encode()];
  }
}
export class DynamicArg extends stmt(
  'DynamicArg',
  (args: { name: SourceSlice; value: Expr }): wire.Statements.DynamicArg => [
    op.DynamicArg,
    args.name.encode(),
    args.value.encode(),
  ]
) {
  encodeHash(): [key: string, value: wire.Expression] {
    return [this.args.name.encode(), this.args.value.encode()];
  }
}

export type Arg = StaticArg | DynamicArg;

export function isArg(statement: Stmt): statement is Arg {
  return statement.name === 'StaticArg' || statement.name === 'DynamicArg';
}

/** -- attributes -- */
export interface AttrArgs {
  name: SourceSlice;
  value: Expr;
  namespace?: string;
}

type AttrFor<N extends wire.Attribute[0]> = [
  N,
  string | WellKnownAttrName,
  wire.Expression,
  string?
];

function attr<N extends wire.Attribute[0]>(op: N): (args: AttrArgs) => AttrFor<N> {
  return args => {
    let name = deflateAttrName(args.name.encode());
    if (args.namespace) {
      return [op, name, args.value.encode(), args.namespace] as AttrFor<N>;
    } else {
      return [op, name, args.value.encode()] as AttrFor<N>;
    }
  };
}

export class StaticAttr extends stmt('StaticAttr', attr(op.StaticAttr)) {}
export class StaticComponentAttr extends stmt(
  'StaticComponentAttr',
  attr(op.StaticComponentAttr)
) {}
export class ComponentAttr extends stmt('ComponentAttr', attr(op.ComponentAttr)) {}
export class TrustingComponentAttr extends stmt(
  'TrustingComponentAttr',
  attr(op.TrustingComponentAttr)
) {}
export class DynamicAttr extends stmt('DynamicAttr', attr(op.DynamicAttr)) {}
export class TrustingDynamicAttr extends stmt(
  'TrustingDynamicAttr',
  attr(op.TrustingDynamicAttr)
) {}

/** - attribute union - */

export type Attr =
  | StaticAttr
  | StaticComponentAttr
  | ComponentAttr
  | DynamicAttr
  | TrustingDynamicAttr
  | TrustingComponentAttr;

export type ElementParameter = Attr | Modifier | AttrSplat;

export function isElementParameter(statement: Stmt): statement is ElementParameter {
  switch (statement.name) {
    case 'StaticAttr':
    case 'StaticComponentAttr':
    case 'ComponentAttr':
    case 'DynamicAttr':
    case 'TrustingDynamicAttr':
    case 'TrustingComponentAttr':
    case 'Modifier':
    case 'AttrSplat':
      return true;
    default:
      return false;
  }
}

/** -- component operations */
export class InvokeComponent extends stmt(
  'Component',
  (args: { block: ComponentBlock }): wire.Statements.Component => args.block.encode()
) {}

export type Component = InvokeComponent;

/** -- element operations -- */

export class AttrSplat extends out(
  'AttrSplat',
  (args: { symbol: number }): wire.Statements.AttrSplat => [op.AttrSplat, args.symbol]
) {}

export class FlushElement extends stmt(
  'FlushElement',
  (): wire.Statements.FlushElement => [op.FlushElement]
) {}
export class Modifier extends stmt(
  'Modifier',
  (args: { head: Expr; params: AnyParams; hash: AnyHash }): wire.Statements.Modifier => [
    op.Modifier,
    args.head.encode(),
    args.params.encode(),
    args.hash.encode(),
  ]
) {}

export class OpenElement extends stmt(
  'OpenElement',
  (args: { tag: SourceSlice }): wire.Statements.OpenElement => [op.OpenElement, args.tag.encode()]
) {}

export class OpenElementWithSplat extends stmt(
  'OpenElementWithSplat',
  (args: { tag: SourceSlice }): wire.Statements.OpenElementWithSplat => [
    op.OpenElementWithSplat,
    args.tag.encode(),
  ]
) {}

export class CloseElement extends stmt(
  'CloseElement',
  (): wire.Statements.CloseElement => [op.CloseElement]
) {}

export class CloseComponent extends stmt(
  'CloseComponent',
  (): wire.Statements.CloseElement => [op.CloseElement]
) {}

export type Element =
  | AttrSplat
  | FlushElement
  | Modifier
  | OpenElement
  | OpenElementWithSplat
  | CloseElement
  | CloseComponent;

/** -- statment union -- */
export type Statement = Stmt;

/** -- GROUPINGS -- */

export type GetVar = GetSymbol | GetFree | GetContextualFree;
export type StackValue = Temporary | Expr;
export type Op = Statement | Temporary | Expr;

/** UTILITIES */

export function encodeHash<T, U>(
  list: [T, ...T[]],
  callback: (value: T) => [string, U]
): [[string, ...string[]], [U, ...U[]]];
export function encodeHash<T, U>(list: T[], callback: (value: T) => [string, U]): [string[], U[]];
export function encodeHash<T, U>(list: T[], callback: (value: T) => [string, U]): [string[], U[]] {
  let keys: string[] = [];
  let values: U[] = [];

  for (let item of list) {
    let [key, value] = callback(item);

    keys.push(key);
    values.push(value);
  }

  return [keys, values];
}
