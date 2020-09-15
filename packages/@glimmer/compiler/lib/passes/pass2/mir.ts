import { VariableResolution, PresentArray } from '@glimmer/interfaces';
import { OptionalList } from '../../shared/list';
import { op, OpsTable } from '../../shared/op';
import { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from '@glimmer/syntax';

export interface StaticAttrArgs {
  name: SourceSlice;
  value: SourceSlice;
  namespace?: string;
}

export interface DynamicAttrArgs {
  name: SourceSlice;
  value: Expr;
  namespace?: string;
}

export class Template extends op('Template').args<{
  symbols: ProgramSymbolTable;
  statements: Statement[];
}>() {}

export class InElement extends op('InElement').args<{
  guid: string;
  insertBefore: Expr | Missing;
  destination: Expr;
  block: NamedBlock;
}>() {}

export class NamedBlocks extends op('NamedBlocks').args<{ blocks: PresentArray<NamedBlock> }>() {}
export class EmptyNamedBlocks extends op('EmptyNamedBlocks').void() {}

export type AnyNamedBlocks = NamedBlocks | EmptyNamedBlocks;

export class NamedBlock extends op('NamedBlock').args<{
  symbols: BlockSymbolTable;
  name: SourceSlice;
  body: Statement[];
}>() {}
export class EndBlock extends op('EndBlock').void() {}
export class AppendTrustedHTML extends op('AppendTrustedHTML').args<{ html: Expr }>() {}
export class AppendTextNode extends op('AppendTextNode').args<{ text: Expr }>() {}
export class AppendComment extends op('AppendComment').args<{ value: string }>() {}

export class Component extends op('Component').args<{
  tag: Expr;
  params: AnyElementParameters;
  args: NamedArguments;
  blocks: AnyNamedBlocks;
}>() {}
export class StaticArg extends op('StaticArg').args<{
  name: SourceSlice;
  value: SourceSlice;
}>() {}
export class DynamicArg extends op('DynamicArg').args<{ name: SourceSlice; value: Expr }>() {}

export class StaticSimpleAttr extends op('StaticSimpleAttr').args<StaticAttrArgs>() {}
export class StaticComponentAttr extends op('StaticComponentAttr').args<StaticAttrArgs>() {}
export class ComponentAttr extends op('ComponentAttr').args<DynamicAttrArgs>() {}
export class DynamicSimpleAttr extends op('DynamicSimpleAttr').args<DynamicAttrArgs>() {}
export class TrustingComponentAttr extends op('TrustingComponentAttr').args<DynamicAttrArgs>() {}
export class TrustingDynamicAttr extends op('TrustingDynamicAttr').args<DynamicAttrArgs>() {}

export class SimpleElement extends op('SimpleElement').args<{
  tag: SourceSlice;
  params: AnyElementParameters;
  body: NamedBlock;
  dynamicFeatures: boolean;
}>() {}

export class ElementParameters extends op('ElementParameters').args<{
  body: PresentArray<ElementParameter>;
}>() {}

export class EmptyElementParameters extends op('EmptyElementParameters').void() {}

export type AnyElementParameters = ElementParameters | EmptyElementParameters;

export class Yield extends op('Yield').args<{ to: number; params: Positional }>() {}
export class Partial extends op('Partial').args<{ target: Expr; table: SymbolTable }>() {}
export class Debugger extends op('Debugger').args<{ table: SymbolTable }>() {}

export class Helper extends op('Helper').args<{ head: Expr; args: Args }>() {}
export class Modifier extends op('Modifier').args<{ head: Expr; args: Args }>() {}
export class InvokeBlock extends op('InvokeBlock').args<{
  head: Expr;
  args: Args;
  blocks: NamedBlocks;
}>() {}
export class AttrSplat extends op('AttrSplat').args<{ symbol: number }>() {}
export class GetPath extends op('GetPath').args<{
  head: Expr;
  tail: Tail;
}>() {}
export class GetWithResolver extends op('GetWithResolver').args<{
  symbol: number;
}>() {}

export class GetSymbol extends op('GetSymbol').args<{ symbol: number }>() {}
export class GetFreeWithContext extends op('GetFreeWithContext').args<{
  symbol: number;
  context: VariableResolution;
}>() {}
/** strict mode */
export class GetFree extends op('GetFree').args<{
  symbol: number;
}>() {}

export class Literal extends op('Literal').args<{
  value: boolean | number | null | undefined | string;
}>() {}
export class Missing extends op('Missing').void() {}
export class Concat extends op('Concat').args<{ parts: Positional }>() {}
export class HasBlock extends op('HasBlock').args<{ symbol: number }>() {}
export class HasBlockParams extends op('HasBlockParams').args<{ symbol: number }>() {}
export class Positional extends op('Positional').args<{ list: OptionalList<Expr> }>() {}
export class NamedArguments extends op('NamedArguments').args<{
  pairs: OptionalList<NamedArgument>;
}>() {}
export class EmptyNamedArguments extends op('EmptyNamedArguments').void() {}
export class NamedArgument extends op('NamedArgument').args<{
  key: SourceSlice;
  value: Expr;
}>() {}
export class Args extends op('Args').args<{ positional: Positional; named: NamedArguments }>() {}
export class Tail extends op('Tail').args<{ members: PresentArray<SourceSlice> }>() {}

export class SourceSlice extends op('SourceSlice').args<{ value: string }>() {}

export type AnyArg = StaticArg | DynamicArg;

export type AnyAttr =
  | ComponentAttr
  | TrustingComponentAttr
  | StaticComponentAttr
  | DynamicSimpleAttr
  | TrustingDynamicAttr
  | StaticSimpleAttr;

export type Expr =
  | Literal
  | Missing
  | GetPath
  | GetSymbol
  | GetFree
  | GetFreeWithContext
  | GetWithResolver
  | Concat
  | Helper
  | HasBlock
  | HasBlockParams;

export type Arg = StaticArg | DynamicArg;
export type ElementParameter = AnyAttr | Modifier | AttrSplat;

export type Internal =
  | Args
  | Positional
  | NamedArguments
  | NamedArgument
  | Tail
  | NamedBlock
  | SourceSlice
  | AnyNamedBlocks
  | AnyElementParameters;
export type ExprLike = Expr | Internal;
export type Statement =
  | InElement
  | Debugger
  | Yield
  | AppendTrustedHTML
  | AppendTextNode
  | Component
  | SimpleElement
  | StaticArg
  | DynamicArg
  | AnyAttr
  | Modifier
  | InvokeBlock
  | AttrSplat
  | Partial
  | AppendComment;

export type Op = Expr | Internal | Statement;
export type VisitableOp = Expr | Internal | Statement;

export type ExprTable = OpsTable<Expr>;
export type InternalTable = OpsTable<Internal>;
export type StatementTable = OpsTable<Statement>;
export type OpTable = ExprTable | InternalTable | StatementTable;
