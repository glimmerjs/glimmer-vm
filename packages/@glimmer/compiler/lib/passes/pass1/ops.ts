import { ExpressionContext, Option, PresentArray } from '@glimmer/interfaces';
import { AST } from '@glimmer/syntax';
import { assert, isPresent } from '@glimmer/util';
import { op, OpsTable } from '../shared/op';
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
export class Concat extends op('Concat').args<{ parts: PresentArray<Expr> }>() {}

export class SubExpression extends op('SubExpression').args<{
  head: Expr;
  params: AnyParams;
  hash: AnyNamedArguments;
}>() {}

export class Params extends op('Params').args<{ list: PresentArray<Expr> }>() {}
export class EmptyParams extends op('EmptyParams').void() {}

export type AnyParams = Params | EmptyParams;

export class NamedArgument extends op('NamedArgument').args<{ key: SourceSlice; value: Expr }>() {}
export class NamedArguments extends op('NamedArguments').args<{
  pairs: PresentArray<NamedArgument>;
}>() {}
export class EmptyNamedArguments extends op('EmptyNamedArguments').void() {}

export type AnyNamedArguments = NamedArguments | EmptyNamedArguments;

export type Internal =
  | Ignore
  | SourceSlice
  | AnyParams
  | AnyNamedArguments
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
  params: AnyParams;
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
  params: AnyParams;
  hash: AnyNamedArguments;
  blocks: Option<PresentArray<NamedBlock>>;
}>() {}

export function getBlock(
  blocks: Option<PresentArray<NamedBlock>>,
  name: string
): Option<NamedBlock> {
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

function onlyHasSemanticChildren(args: TemporaryNamedBlock['args']): args is NamedBlock['args'] {
  return args.body.every((s) => s.name !== 'TemporaryNamedBlock');
}

type ExtractedMaybeNamedBlocks =
  | { type: 'named-blocks'; blocks: PresentArray<NamedBlock> }
  | typeof NESTED_NAMED_BLOCK_ERROR;

function extractMaybeNameBlocks(body: NonSemanticChild[]): ExtractedMaybeNamedBlocks {
  let blocks: NamedBlock[] = [];
  let nodes: NonSemantic[] = [];

  for (let statement of body) {
    switch (statement.name) {
      case 'AppendComment':
      case 'AppendWhitespace':
        nodes.push(statement);
        break;
      case 'TemporaryNamedBlock':
        if (statement.isValidNamedBlock()) {
          blocks.push(statement.asNamedBlock());
        } else {
          return NESTED_NAMED_BLOCK_ERROR;
        }
    }
  }

  assert(
    isPresent(blocks),
    `the block did not have named blocks (make sure to call hasValidNamedBlocks before asNamedBlocks)`
  );

  return { type: 'named-blocks', blocks };
}

const NESTED_NAMED_BLOCK_ERROR = {
  type: 'error',
  desc: 'a named block cannot have named block children',
} as const;

// A TemporaryNamedBlock may have named blocks inside of it. This is normally
// disallowed, but it is used to determine whether a component has named blocks
// or a single default block.
export class TemporaryNamedBlock extends op('TemporaryNamedBlock').args<{
  name: SourceSlice;
  table: BlockSymbolTable;
  body: (Statement | TemporaryNamedBlock)[];
}>() {
  hasValidNamedBlocks(): this is { args: { body: NonSemanticChild[] } } {
    return (
      this.args.body.every(
        (node) =>
          node.name === 'AppendWhitespace' ||
          node.name === 'AppendComment' ||
          node.name === 'TemporaryNamedBlock'
      ) && this.args.body.some((node) => node.name === 'TemporaryNamedBlock')
    );
  }

  asNamedBlocks(this: this & { args: { body: NonSemanticChild[] } }): ExtractedMaybeNamedBlocks {
    return extractMaybeNameBlocks(this.args.body);
  }

  isValidNamedBlock(): this is { args: { body: Statement[] } } {
    return onlyHasSemanticChildren(this.args);
  }

  asNamedBlock(this: this & { args: NamedBlock['args'] }): NamedBlock {
    return new NamedBlock(this.offsets, this.args);
  }
}

export class Ignore extends op('Ignore').void() {}

export class Component extends op('Component').args<{
  tag: Expr;
  params: AnyElementParameters;
  args: AnyNamedArguments;
  blocks: AnyNamedBlocks;
}>() {}

export class ElementParameters extends op('ElementParameters').args<{
  body: PresentArray<ElementParameter>;
}>() {}

export class EmptyElementParameters extends op('EmptyElementParameters').void() {}

export type AnyElementParameters = ElementParameters | EmptyElementParameters;

export class SimpleElement extends op('SimpleElement').args<{
  tag: SourceSlice;
  params: AnyElementParameters;
  body: NamedBlock;
}>() {}

export class ElementWithDynamicFeatures extends op('ElementWithDynamicFeatures').args<{
  tag: SourceSlice;
  params: AnyElementParameters;
  body: NamedBlock;
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
  params: AnyParams;
  hash: AnyNamedArguments;
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
  | ElementWithDynamicFeatures
  | ElementParameter;

export type StatementTable = OpsTable<Statement>;

// export type Statement<P extends keyof Statements = keyof Statements> = Statements[P];

export type AnyOpTable = StatementTable & ExprTable;
export type AnyOp = Statement | Expr | Internal;
