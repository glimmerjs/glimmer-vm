import {
  Option,
  PresentArray,
  SexpOpcodes as op,
  WellKnownAttrName,
  WireFormat as wire,
} from '@glimmer/interfaces';
import { assert, assertPresent, isPresent, mapPresent } from '@glimmer/util';
import { deflateAttrName } from '../../utils';
import * as pass1 from '../pass1/ops';
import { SourceOffsets } from '../shared/location';
import { Op as AbstractOp, UnknownArgs } from '../shared/op';
import { ProgramSymbolTable } from '../shared/symbol-table';

/** ENCODABLE */

interface EncodableOp<
  N extends string = string,
  Wire extends wire.SyntaxWithInternal | WireStatements = wire.SyntaxWithInternal | WireStatements,
  Args extends UnknownArgs = UnknownArgs
> extends AbstractOp<Args> {
  readonly name: N;
  readonly args: Args;
  encode(): Wire;
}

function out<
  N extends string,
  Wire extends wire.SyntaxWithInternal | WireStatements,
  Args extends UnknownArgs
>(name: N, encode: () => Wire): EncodableOpConstructor<N, Wire, void>;
function out<
  N extends string,
  Wire extends wire.SyntaxWithInternal | WireStatements,
  Args extends UnknownArgs
>(name: N, encode: (args: Args) => Wire): EncodableOpConstructor<N, Wire, Args>;
function out<
  N extends string,
  Wire extends wire.SyntaxWithInternal | WireStatements,
  Args extends UnknownArgs
>(name: N, encode: (args?: Args) => Wire): EncodableOpConstructor<N, Wire, Args> {
  return class extends AbstractOp<Args> {
    readonly name = name;

    encode(): Wire {
      return encode(this.args);
    }
  };
}

function expr<N extends string, Wire extends wire.Expression, Args extends UnknownArgs>(
  name: N,
  encode: () => Wire
): EncodableOpConstructor<N, Wire, void>;
function expr<N extends string, Wire extends wire.Expression, Args extends UnknownArgs>(
  name: N,
  encode: (args: Args) => Wire
): EncodableOpConstructor<N, Wire, Args>;
function expr<N extends string, Wire extends wire.Expression, Args extends UnknownArgs>(
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

function stmt<N extends string, Wire extends wire.Statement, Args extends UnknownArgs>(
  name: N,
  encode: () => Wire
): EncodableOpConstructor<N, Wire, void>;
function stmt<N extends string, Wire extends wire.Statement, Args extends UnknownArgs>(
  name: N,
  encode: (args: Args) => Wire
): EncodableOpConstructor<N, Wire, Args>;
function stmt<N extends string, Wire extends wire.Statement, Args extends UnknownArgs>(
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
  Args extends UnknownArgs = UnknownArgs
> = EncodableOp<N, Wire, Args>;

export type Stmt<
  N extends string = string,
  Wire extends wire.Statement = wire.Statement,
  Args extends UnknownArgs = UnknownArgs
> = EncodableOp<N, Wire, Args>;

export type EncodableOpConstructor<
  N extends string,
  Wire extends wire.SyntaxWithInternal | WireStatements,
  Args extends UnknownArgs
> = {
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

export class Positional extends out(
  'Params',
  ({ list }: { list: [Expr, ...Expr[]] }) => list.map((l) => l.encode()) as wire.Core.ConcatParams
) {}
export class Missing extends out('Missing', (): never => {
  throw new Error(`Internal Missing operation is not encodable`);
}) {}
export class EmptyPositional extends out('EmptyParams', (): null => null) {}
export class NamedArguments extends out(
  'Hash',
  (args: { pairs: PresentArray<HashPair> }): wire.Core.Hash => {
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

export class SourceSlice extends out(
  'SourceSlice',
  (args: { value: string }): string => args.value
) {}

export class EmptyNamedArguments extends out('EmptyHash', (): null => null) {}

export class Args extends out(
  'Args',
  (args: { positional: AnyPositional; named: AnyNamedArguments }): wire.Core.Args => {
    return [args.positional.encode(), args.named.encode()];
  }
) {}

export class Tail extends out(
  'Tail',
  (args: { members: PresentArray<pass1.SourceSlice> }): PresentArray<string> =>
    mapPresent(args.members, (member) => member.getString())
) {}

export type AnyPositional = Positional | EmptyPositional;
export type AnyNamedArguments = NamedArguments | EmptyNamedArguments;
export type Internal =
  | Args
  | AnyPositional
  | AnyNamedArguments
  | AnyNamedBlocks
  | HashPair
  | Tail
  | Missing
  | SourceSlice
  | NamedBlock
  | Element
  | Template
  | AnyElementParameters;

/** #---- EXPRESSIONS ----# */

export class Undefined extends expr('Undefined', () => [op.Undefined]) {}

export class Value extends expr(
  'Value',
  ({ value }: { value: number | boolean | null | string }) => value
) {}

export class GetSymbol extends expr(
  'GetSymbol',
  (args: { symbol: number }): wire.Get => [op.GetSymbol, args.symbol]
) {}

export class GetSloppy extends expr(
  'GetSloppy',
  (args: { symbol: number }): wire.Get => [op.GetFreeInAppendSingleId, args.symbol]
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
  (args: { head: Expr; tail: Tail }): wire.Expressions.GetPath => [
    op.GetPath,
    args.head.encode(),
    args.tail.encode(),
  ]
) {}

export class Concat extends expr(
  'Concat',
  (args: { parts: Positional }): wire.Expressions.Concat => [op.Concat, args.parts.encode()]
) {}

export class Call extends expr(
  'Call',
  (args: { head: Expr; args: Args }): wire.Expressions.Helper => [
    op.Call,
    args.head.encode(),
    ...args.args.encode(),
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
  (args: { value: string }): wire.Statements.Comment => [op.Comment, args.value]
) {}

export class Debugger extends stmt(
  'Debugger',
  (args: { info: wire.Core.EvalInfo }): wire.Statements.Debugger => [op.Debugger, args.info]
) {}
export class Partial extends stmt(
  'Partial',
  (args: { target: Expr; info: wire.Core.EvalInfo }): wire.Statements.Partial => [
    op.Partial,
    args.target.encode(),
    args.info,
  ]
) {}
export class Yield extends stmt(
  'Yield',
  (args: { to: number; params: AnyPositional }): wire.Statements.Yield => [
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

export class ElementParameters extends out(
  'ElementParameters',
  (args: { statements: PresentArray<ElementParameter> }): PresentArray<wire.Parameter> => [
    ...PresentWireStatements.from(args.statements).toArray(),
  ]
) {
  toArray(): wire.Parameter[] {
    return WireStatements.from(this.args.statements).toArray();
  }
}

export class EmptyElementParameters extends out('EmptyElementParameters', (): null => null) {
  toArray(): wire.Parameter[] {
    return [];
  }
}

export type AnyElementParameters = ElementParameters | EmptyElementParameters;

export class NamedBlock extends out(
  'NamedBlock',
  (args: {
    name: SourceSlice;
    parameters: number[];
    statements: Statement[];
  }): wire.Core.NamedBlock => [
    args.name.encode(),
    {
      parameters: args.parameters,
      statements: [...WireStatements.from(args.statements).toArray()],
    },
  ]
) {}

export class EmptyNamedBlocks extends out('EmptyNamedBlocks', (): wire.Core.Blocks => null) {}
export class NamedBlocks extends out(
  'NamedBlocks',
  (args: { blocks: PresentArray<NamedBlock> }): wire.Core.Blocks => {
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
  (args: { head: Expr; args: Args; blocks: AnyNamedBlocks }): wire.Statements.Block => [
    op.Block,
    args.head.encode(),
    ...args.args.encode(),
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
  (args: { name: SourceSlice; value: SourceSlice }): wire.Statements.StaticArg => [
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
export interface DynamicAttrArgs {
  name: SourceSlice;
  value: Expr;
  namespace?: string;
}

export interface StaticAttrArgs {
  name: SourceSlice;
  value: SourceSlice;
  namespace?: string;
}

type AttrFor<N extends wire.Attribute[0]> = [
  N,
  string | WellKnownAttrName,
  wire.Expression,
  string?
];

function attr<N extends wire.Attribute[0]>(op: N): (args: DynamicAttrArgs) => AttrFor<N> {
  return (args) => {
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
export class ComponentBlock extends out(
  'ComponentBlock',
  (args: {
    tag: Expr;
    parameters: AnyElementParameters;
    args: AnyNamedArguments;
    blocks: NamedBlocks;
  }): wire.Statements.Component => [
    op.Component,
    args.tag.encode(),
    args.parameters.encode(),
    args.args.encode(),
    args.blocks.encode(),
  ]
) {}

export class Component extends stmt(
  'Component',
  (args: {
    tag: Expr;
    params: AnyElementParameters;
    args: AnyNamedArguments;
    blocks: AnyNamedBlocks;
    selfClosing: boolean; // TODO make this not required
  }): wire.Statements.Component => {
    let tag = args.tag.encode();
    let params = args.params.encode();
    let hash = args.args.encode();

    let blocks: null | wire.Core.Blocks;
    if (args.selfClosing) {
      blocks = null;
    } else {
      blocks = args.blocks.encode();
    }

    return [op.Component, tag, params, hash, blocks];
  }
) {}

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
  (args: { head: Expr; args: Args }): wire.Statements.Modifier => [
    op.Modifier,
    args.head.encode(),
    ...args.args.encode(),
  ]
) {}

type EncodableStatement<Wire extends wire.Statement = wire.Statement> = {
  encode(): Wire | WireStatements<Wire>;
};

type ResultFor<S extends EncodableStatement> = EncodableFor<S> | WireStatements<EncodableFor<S>>;

type EncodableFor<S extends EncodableStatement> = S extends EncodableStatement<infer Wire>
  ? Wire
  : never;

export class PresentWireStatements<Wire extends wire.Statement = wire.Statement> {
  static from<S extends EncodableStatement>(lir: S[]): PresentWireStatements<EncodableFor<S>> {
    let statements: EncodableFor<S>[] = [];

    for (let instruction of lir) {
      let result = instruction.encode() as ResultFor<S>;

      if (result instanceof WireStatements) {
        statements.push(...result.toArray());
      } else {
        statements.push(result);
      }
    }

    assert(
      isPresent(statements),
      `expected output statements to have at least one element, but the list was empty`
    );

    return new PresentWireStatements(statements);
  }

  constructor(private statements: PresentArray<Wire>) {}

  toArray(): PresentArray<Wire> {
    return this.statements;
  }
}

export class WireStatements<Wire extends wire.Statement = wire.Statement> {
  static from<S extends EncodableStatement>(lir: S[]): WireStatements<EncodableFor<S>> {
    let statements: EncodableFor<S>[] = [];

    for (let instruction of lir) {
      let result = instruction.encode() as ResultFor<S>;

      if (result instanceof WireStatements) {
        statements.push(...result.toArray());
      } else {
        statements.push(result);
      }
    }

    return new WireStatements(statements);
  }

  constructor(private statements: Wire[]) {}

  toPresentOption(): Option<PresentArray<Wire>> {
    if (isPresent(this.statements)) {
      return this.statements;
    } else {
      return null;
    }
  }

  toArray(): Wire[] {
    return this.statements;
  }
}

export class Element extends out(
  'Element',
  (args: {
    tag: SourceSlice;
    params: AnyElementParameters;
    body: NamedBlock;
    dynamicFeatures: boolean;
  }): WireStatements => {
    return new WireStatements([
      [
        args.dynamicFeatures ? op.OpenElementWithSplat : op.OpenElement,
        args.tag.encode() /* TODO deflate */,
      ],
      ...args.params.toArray(),
      [op.FlushElement],
      ...args.body.encode()[1].statements,
      [op.CloseElement],
    ]);
  }
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

export type ElementStatement =
  | AttrSplat
  | FlushElement
  | Modifier
  | OpenElement
  | OpenElementWithSplat
  | CloseElement
  | CloseComponent;

/** -- statment union -- */
export type Statement = Stmt | Element;

/** #---- TEMPLATE ----# */

export class Template extends out(
  'Template',
  (args: { table: ProgramSymbolTable; statements: Statement[] }): wire.SerializedTemplateBlock => {
    return {
      symbols: args.table.symbols,
      statements: [...WireStatements.from(args.statements).toArray()],
      hasEval: args.table.hasEval,
      upvars: args.table.freeVariables,
    };
  }
) {}

/** -- GROUPINGS -- */

export type GetVar = GetSymbol | GetFree | GetContextualFree;
export type StackValue = Internal | Expr;
export type Op = Statement | Internal | Expr;

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
