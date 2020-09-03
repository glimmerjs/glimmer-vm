import { ExpressionContext, Option } from '@glimmer/interfaces';
import { AST } from '@glimmer/syntax';
import { PresentArray } from '@glimmer/util';
import { op, Op, OpsTable } from '../shared/op';
import { BlockSymbolTable, ProgramSymbolTable } from '../shared/symbol-table';

export interface AttrKind {
  // triple-curly
  trusting: boolean;
  // this attribute is on an element with component features:
  //   - <CapCase ...>
  //   - modifiers
  //   - <dynamic.tag ...>
  component: boolean;
}

/** OP **/

/** TEMPLATE **/

export class Template extends Op<{ symbols: ProgramSymbolTable; body: Statement[] }> {
  readonly name = 'Template';
}

/** EXPRESSIONS **/

// Not a string literal from a template. Used for things
// like tag names, path parts, etc. Both SourceSlices and
// Literals correspond to parts of the template source, but
// literal strings look like `"..."` or `'...'` in the
// source, while SourceSlice are a piece of another construct.
export class SourceSlice extends op('SourceSlice').args<{ value: string }>() {
  getString(): string {
    return this.args.value;
  }
}
export class Literal extends op('Literal').args<Pick<AST.Literal, 'type' | 'value'>>() {}
export class Path extends op('Path').args<{ head: Expr; tail: PresentArray<SourceSlice> }>() {}
export class GetArg extends op('GetArg').args<{ name: SourceSlice }>() {}
export class GetThis extends op('GetThis').void() {}
export class GetVar extends op('GetVar').args<{
  name: SourceSlice;
  context: ExpressionContext;
}>() {}
export class HasBlock extends op('HasBlock').args<{ target: SourceSlice }>() {}
export class HasBlockParams extends op('HasBlockParams').args<{ target: SourceSlice }>() {}
export class Concat extends op('Concat').args<{ parts: [Expr, ...Expr[]] }>() {}

export class SubExpression extends op('SubExpression').args<{
  head: Expr;
  params: Params;
  hash: Hash;
}>() {}

export class Params extends op('Params').args<{ list: Option<PresentArray<Expr>> }>() {}
export class HashPair extends op('HashPair').args<{ key: SourceSlice; value: Expr }>() {}
export class Hash extends op('Hash').args<{ pairs: HashPair[] }>() {}

export type Expr =
  | Literal
  | Concat
  | Path
  | GetArg
  | GetThis
  | GetVar
  | HasBlock
  | HasBlockParams
  | SubExpression
  | Params
  | Hash
  | HashPair;

export type ExprTable = OpsTable<Expr>;

// export interface ExprTable {
//   Literal: Literal;
//   Concat: Concat;
//   Path: Path;
//   GetArg: GetArg;
//   GetThis: GetThis;
//   GetVar: GetVar;
//   HasBlock: HasBlock;
//   HasBlockParams: HasBlockParams;
//   SubExpression: SubExpression;

//   Params: Params;
//   Hash: Hash;
//   HashPair: HashPair;
// }

/** STATEMENTS **/

// target is really a string literal, but threading that information
// through is currently too annoying
export class Yield extends op('Yield').args<{
  target: SourceSlice;
  params: Params;
}>() {}

export class Partial extends op('Partial').args<{ expr: Expr }>() {}
export class Debugger extends op('Debugger').void() {}

export class InElement extends op('InElement').args<{
  destination: Expr;
  guid: string;
  insertBefore?: Expr;
  block: NamedBlock;
}>() {}

export class AppendTextNode extends op('AppendTextNode').args<{ value: Expr }>() {}
export class AppendTrustedHTML extends op('AppendTrustedHTML').args<{ value: Expr }>() {}
export class AppendComment extends op('AppendComment').args<{ value: SourceSlice }>() {}

export class BlockInvocation extends op('BlockInvocation').args<{
  head: Expr;
  params: Params;
  hash: Hash;
  blocks: NamedBlock[];
}>() {}

export function getBlock(blocks: NamedBlock[], name: string): NamedBlock | undefined {
  return blocks.find((block) => block.args.name.getString() === name);
}

export class NamedBlock extends op('Block').args<{
  name: SourceSlice;
  symbols: BlockSymbolTable;
  body: Statement[];
}>() {}

// TODO Make Component have the same structure as BlockInvocation, and
// make named blocks just normal blocks in the invocation
export class OpenNamedBlock extends op('OpenNamedBlock').args<{
  tag: SourceSlice;
  symbols: BlockSymbolTable;
}>() {}

export class OpenComponent extends op('OpenComponent').args<{
  tag: Expr;
  symbols: BlockSymbolTable;
  selfClosing: boolean;
}>() {}

export class OpenSimpleElement extends op('OpenSimpleElement').args<{
  tag: SourceSlice;
}>() {}

export class OpenElementWithDynamicFeatures extends op('OpenElementWithDynamicFeatures').args<{
  tag: SourceSlice;
}>() {}

export class FlushElement extends op('FlushElement').args<{ symbols: BlockSymbolTable }>() {}
export class CloseNamedBlock extends op('CloseNamedBlock').void() {}
export class CloseComponent extends op('CloseComponent').void() {}
export class CloseElement extends op('CloseElement').void() {}
export class CloseElementBlock extends op('CloseElementBlock').void() {}

export class Arg extends op('Arg').args<{ name: SourceSlice; value: Expr }>() {}
export class AttrSplat extends op('AttrSplat').void() {}
export class Attr extends op('Attr').args<{
  kind: AttrKind;
  name: SourceSlice;
  value: Expr;
  namespace?: string;
}>() {}

export class Modifier extends op('Modifier').args<{ head: Expr; params: Params; hash: Hash }>() {}

export type Statement =
  | Yield
  | Debugger
  | InElement
  | Partial
  | BlockInvocation
  | NamedBlock
  | AppendTextNode
  | AppendTrustedHTML
  | AppendComment
  | OpenNamedBlock
  | OpenComponent
  | OpenSimpleElement
  | OpenElementWithDynamicFeatures
  | FlushElement
  | CloseNamedBlock
  | CloseComponent
  | CloseElement
  | CloseElementBlock
  | Arg
  | AttrSplat
  | Attr
  | Modifier;

export type StatementTable = OpsTable<Statement>;

// export type Statement<P extends keyof Statements = keyof Statements> = Statements[P];

export type AnyOpTable = StatementTable & ExprTable;
export type AnyOp = Statement | Expr;
