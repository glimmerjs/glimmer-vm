import { Optional, PresentArray, VariableResolutionContext } from '@glimmer/interfaces';
import { ASTv2, BlockSymbolTable, ProgramSymbolTable, SymbolTable } from '@glimmer/syntax';
import { AnyOptionalList, OptionalList, PresentList } from '../../shared/list';
import { op, OpsTable } from '../../shared/op';

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

export class Literal extends op('Literal').args<{ value: ASTv2.Literal['value'] }>() {}
export class Path extends op('Path').args<{ head: Expr; tail: PresentArray<SourceSlice> }>() {}
export class GetArg extends op('GetArg').args<{ name: SourceSlice }>() {}
export class GetThis extends op('GetThis').void() {}
export class GetLocalVar extends op('GetLocalVar').args<{
  name: SourceSlice;
}>() {}
export class GetFreeVar extends op('GetFreeVar').args<{
  name: SourceSlice;
}>() {}
export class GetFreeVarWithContext extends op('GetFreeVarWithContext').args<{
  name: SourceSlice;
  context: VariableResolutionContext;
}>() {}

/**
 * This is the most ambiguous situation (`{{x}}`), which, in resolver mode,
 * requires a resolver check for whether `x` is a helper before falling
 * back to `this.x`.
 *
 * In strict mode, `{{x}}` unambiguously refers to a free variable, and
 * produces `GetFreeVar`.
 */
export class GetWithResolver extends op('GetWithResolver').args<{
  name: SourceSlice;
}>() {}

export class HasBlock extends op('HasBlock').args<{ target: SourceSlice }>() {}
export class HasBlockParams extends op('HasBlockParams').args<{ target: SourceSlice }>() {}
export class Interpolate extends op('Interpolate').args<{ parts: PresentList<Expr> }>() {}

export class SubExpression extends op('SubExpression').args<{
  head: Expr;
  params: Params;
  hash: NamedArguments;
}>() {}

export class Params extends op('Params').args<{ list: AnyOptionalList<Expr> }>() {}
export type PresentParams = Params & { args: { list: PresentList<Expr> } };

export class NamedArgument extends op('NamedArgument').args<{ key: SourceSlice; value: Expr }>() {}
export class NamedArguments extends op('NamedArguments').args<{
  pairs: OptionalList<NamedArgument>;
}>() {}

export type Internal =
  | Ignore
  | SourceSlice
  | Params
  | NamedArguments
  | NamedArgument
  | NamedBlock
  | NamedBlocks
  | ElementParameters;

export type InternalTable = OpsTable<Internal>;

export type Expr =
  | Literal
  | Interpolate
  | Path
  | GetArg
  | GetThis
  | GetLocalVar
  | GetFreeVar
  | GetFreeVarWithContext
  | GetWithResolver
  | HasBlock
  | HasBlockParams
  | SubExpression;

export type ExprTable = OpsTable<Expr>;

export type ExprLike = Expr | Internal;

/** STATEMENTS **/

export class Yield extends op('Yield').args<{
  target: SourceSlice;
  params: Params;
}>() {}

export class Partial extends op('Partial').args<{ expr: Expr; table: SymbolTable }>() {}
export class Debugger extends op('Debugger').args<{ table: SymbolTable }>() {}

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
  blocks: OptionalList<NamedBlock>;
}>() {}

export function getBlock(blocks: OptionalList<NamedBlock>, name: string): Optional<NamedBlock> {
  return blocks.into({
    ifEmpty: () => null,
    ifPresent: (blocks) =>
      blocks.toPresentArray().find((block) => block.args.name.getString() === name) || null,
  });
}

export class NamedBlock extends op('NamedBlock').args<{
  name: SourceSlice;
  table: BlockSymbolTable;
  body: Statement[];
}>() {}

export class NamedBlocks extends op('NamedBlocks').args<{
  blocks: OptionalList<NamedBlock>;
}>() {}

export type NonSemanticChild = NonSemantic;

export class Ignore extends op('Ignore').void() {}

export class Component extends op('Component').args<{
  tag: Expr;
  params: ElementParameters;
  args: NamedArguments;
  blocks: NamedBlocks;
}>() {}

export class ElementParameters extends op('ElementParameters').args<{
  body: OptionalList<ElementParameter>;
}>() {}

export class SimpleElement extends op('SimpleElement').args<{
  tag: SourceSlice;
  params: ElementParameters;
  body: Statement[];
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
