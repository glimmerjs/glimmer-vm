import { ExpressionContext, PresentArray } from '@glimmer/interfaces';
import * as pass1 from '../pass1/ops';
import { op, OpsTable } from '../shared/op';
import { BlockSymbolTable, ProgramSymbolTable, SymbolTable } from '../shared/symbol-table';

export interface StaticAttrArgs {
  name: pass1.SourceSlice;
  value: pass1.SourceSlice;
  namespace?: string;
}

export interface DynamicAttrArgs {
  name: pass1.SourceSlice;
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
  name: pass1.SourceSlice;
  body: Statement[];
}>() {}
export class EndBlock extends op('EndBlock').void() {}
export class AppendTrustedHTML extends op('AppendTrustedHTML').args<{ html: Expr }>() {}
export class AppendTextNode extends op('AppendTextNode').args<{ text: Expr }>() {}
export class Component extends op('Component').args<{
  tag: Expr;
  params: AnyElementParameters;
  args: AnyNamedArguments;
  blocks: AnyNamedBlocks;
  selfClosing: boolean; // TODO make this not required
}>() {}
export class StaticArg extends op('StaticArg').args<{
  name: pass1.SourceSlice;
  value: pass1.SourceSlice;
}>() {}
export class DynamicArg extends op('DynamicArg').args<{ name: pass1.SourceSlice; value: Expr }>() {}

export class StaticSimpleAttr extends op('StaticSimpleAttr').args<StaticAttrArgs>() {}
export class StaticComponentAttr extends op('StaticComponentAttr').args<StaticAttrArgs>() {}
export class ComponentAttr extends op('ComponentAttr').args<DynamicAttrArgs>() {}
export class DynamicSimpleAttr extends op('DynamicSimpleAttr').args<StaticAttrArgs>() {}
export class TrustingComponentAttr extends op('TrustingComponentAttr').args<DynamicAttrArgs>() {}
export class TrustingDynamicAttr extends op('TrustingDynamicAttr').args<DynamicAttrArgs>() {}

export class SimpleElement extends op('SimpleElement').args<{
  tag: pass1.SourceSlice;
  params: AnyElementParameters;
  body: NamedBlock;
}>() {}

export class ElementParameters extends op('ElementParameters').args<{
  body: PresentArray<ElementParameter>;
}>() {}

export class EmptyElementParameters extends op('EmptyElementParameters').void() {}

export type AnyElementParameters = ElementParameters | EmptyElementParameters;

export class ElementWithDynamicFeatures extends op('ElementWithDynamicFeatures').args<{
  tag: pass1.SourceSlice;
  params: AnyElementParameters;
  body: NamedBlock;
}>() {}

export class Yield extends op('Yield').args<{ to: number; params: AnyParams }>() {}
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
export class GetSloppy extends op('GetSloppy').args<{
  symbol: number;
}>() {}

export class GetSymbol extends op('GetSymbol').args<{ symbol: number }>() {}
export class GetFreeWithContext extends op('GetFreeWithContext').args<{
  symbol: number;
  context: ExpressionContext;
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
export class Positional extends op('Positional').args<{ list: PresentArray<Expr> }>() {}
export class EmptyPositional extends op('EmptyPositional').void() {}
export class NamedArguments extends op('NamedArguments').args<{
  pairs: PresentArray<NamedArgument>;
}>() {}
export class EmptyNamedArguments extends op('EmptyNamedArguments').void() {}
export class NamedArgument extends op('NamedArgument').args<{
  key: pass1.SourceSlice;
  value: Expr;
}>() {}
export class Args extends op('Args').args<{ positional: AnyParams; named: AnyNamedArguments }>() {}
export class Tail extends op('Tail').args<{ members: PresentArray<pass1.SourceSlice> }>() {}

export type AnyArg = StaticArg | DynamicArg;
export type AnyParams = Positional | EmptyPositional;
export type AnyNamedArguments = NamedArguments | EmptyNamedArguments;

export type AnyAttr =
  | ComponentAttr
  | TrustingComponentAttr
  | StaticComponentAttr
  | DynamicSimpleAttr
  | TrustingDynamicAttr
  | StaticSimpleAttr;

// pass through
export import AppendComment = pass1.AppendComment;

export type Expr =
  | Literal
  | Missing
  | GetPath
  | GetSymbol
  | GetFree
  | GetFreeWithContext
  | GetSloppy
  | Concat
  | Helper
  | HasBlock
  | HasBlockParams;

export type Arg = StaticArg | DynamicArg;
export type ElementParameter = AnyAttr | Modifier | AttrSplat;

export type Internal =
  | Args
  | AnyParams
  | AnyNamedArguments
  | NamedArgument
  | Tail
  | Missing
  | NamedBlock
  | pass1.SourceSlice
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
  | ElementWithDynamicFeatures
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
