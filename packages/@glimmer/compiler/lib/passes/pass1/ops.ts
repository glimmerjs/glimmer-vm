import { ExpressionContext, Optional, PresentArray } from '@glimmer/interfaces';
import { AST } from '@glimmer/syntax';
import { isPresent } from '@glimmer/util';
import { AnyOptionalList, PresentList } from '../../shared/list';
import { op, OpsTable } from '../../shared/op';
import { BlockSymbolTable, ProgramSymbolTable } from '../../shared/symbol-table';
import { SourceOffsets } from '../../source/offsets';
import { TemporaryNamedBlock } from '../pass0/visitors/element/temporary-block';

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

export class Template extends op('Template').args<{
  symbols: ProgramSymbolTable;
  body: Statement[];
}>() {}

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

export class Literal extends op('Literal').args<{ value: AST.Literal['value'] }>() {}
export class Path extends op('Path').args<{ head: Expr; tail: PresentArray<SourceSlice> }>() {}
export class GetArg extends op('GetArg').args<{ name: SourceSlice }>() {}
export class GetThis extends op('GetThis').void() {}
export class GetVar extends op('GetVar').args<{
  name: SourceSlice;
  context: ExpressionContext;
}>() {}
export class GetSloppy extends op('GetSloppy').args<{
  name: SourceSlice;
}>() {}

export class HasBlock extends op('HasBlock').args<{ target: SourceSlice }>() {}
export class HasBlockParams extends op('HasBlockParams').args<{ target: SourceSlice }>() {}
export class Concat extends op('Concat').args<{ parts: PresentList<Expr> }>() {}

export class SubExpression extends op('SubExpression').args<{
  head: Expr;
  params: Params;
  hash: NamedArguments;
}>() {}

export class Params extends op('Params').args<{ list: AnyOptionalList<Expr> }>() {}
export type PresentParams = Params & { args: { list: PresentList<Expr> } };

export class NamedArgument extends op('NamedArgument').args<{ key: SourceSlice; value: Expr }>() {}
export class NamedArguments extends op('NamedArguments').args<{
  pairs: AnyOptionalList<NamedArgument>;
}>() {}

export type Internal =
  | Ignore
  | SourceSlice
  | Params
  | NamedArguments
  | NamedArgument
  | NamedBlock
  | AnyNamedBlocks
  | AnyElementParameters;

export type InternalTable = OpsTable<Internal>;

export type Expr =
  | Literal
  | Concat
  | Path
  | GetArg
  | GetThis
  | GetVar
  | GetSloppy
  | HasBlock
  | HasBlockParams
  | SubExpression;

export type ExprTable = OpsTable<Expr>;

export type ExprLike = Expr | Internal;

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

// Whitespace is allowed between and around named blocks
export class AppendWhitespace extends op('AppendWhitespace').args<{ value: string }>() {}
export class AppendComment extends op('AppendComment').args<{ value: string }>() {}

export type NonSemantic = AppendWhitespace | AppendComment;

export class AppendTextNode extends op('AppendTextNode').args<{ value: Expr }>() {}
export class AppendTrustedHTML extends op('AppendTrustedHTML').args<{ value: Expr }>() {}

export class BlockInvocation extends op('BlockInvocation').args<{
  head: Expr;
  params: Params;
  hash: NamedArguments;
  blocks: Optional<PresentArray<NamedBlock>>;
}>() {}

export function getBlock(
  blocks: Optional<PresentArray<NamedBlock>>,
  name: string
): Optional<NamedBlock> {
  if (blocks === null) {
    return null;
  }
  return blocks.find((block) => block.args.name.getString() === name) || null;
}

export class NamedBlock extends op('NamedBlock').args<{
  name: SourceSlice;
  table: BlockSymbolTable;
  body: Statement[];
}>() {}

export class NamedBlocks extends op('NamedBlocks').args<{ blocks: PresentArray<NamedBlock> }>() {}
export class EmptyNamedBlocks extends op('EmptyNamedBlocks').void() {}

export type AnyNamedBlocks = NamedBlocks | EmptyNamedBlocks;

export type NonSemanticChild = NonSemantic | TemporaryNamedBlock;

export class Ignore extends op('Ignore').void() {}

export class Component extends op('Component').args<{
  tag: Expr;
  params: AnyElementParameters;
  args: NamedArguments;
  blocks: AnyNamedBlocks;
}>() {}

export class ElementParameters extends op('ElementParameters').args<{
  body: PresentArray<ElementParameter>;
}>() {}

export class EmptyElementParameters extends op('EmptyElementParameters').void() {}

export type AnyElementParameters = ElementParameters | EmptyElementParameters;

export function AnyElementParameters(
  body: ElementParameter[],
  offsets: SourceOffsets | null = null
): AnyElementParameters {
  if (isPresent(body)) {
    return new ElementParameters(offsets, { body });
  } else {
    return new EmptyElementParameters(offsets);
  }
}

export class SimpleElement extends op('SimpleElement').args<{
  tag: SourceSlice;
  params: AnyElementParameters;
  body: NamedBlock;
  dynamicFeatures: boolean;
}>() {}

export class AttrSplat extends op('AttrSplat').void() {}
export class Attr extends op('Attr').args<{
  kind: AttrKind;
  name: SourceSlice;
  value: Expr;
  namespace?: string;
}>() {}

export class Modifier extends op('Modifier').args<{
  head: Expr;
  params: Params;
  hash: NamedArguments;
}>() {}

export type ElementParameter = Attr | Modifier | AttrSplat;

export type Statement =
  | Yield
  | Debugger
  | InElement
  | Partial
  | BlockInvocation
  | AppendWhitespace
  | AppendTextNode
  | AppendTrustedHTML
  | AppendComment
  | Component
  | SimpleElement
  | ElementParameter;

export type StatementTable = OpsTable<Statement>;

// export type Statement<P extends keyof Statements = keyof Statements> = Statements[P];

export type AnyOpTable = StatementTable & ExprTable;
export type AnyOp = Statement | Expr | Internal;
