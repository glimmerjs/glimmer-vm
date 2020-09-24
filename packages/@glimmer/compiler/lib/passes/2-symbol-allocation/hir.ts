import { Optional, PresentArray } from '@glimmer/interfaces';
import {
  ASTv2,
  BlockSymbolTable,
  ProgramSymbolTable,
  SourceSlice,
  SymbolTable,
} from '@glimmer/syntax';

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

export class PlaceholderUndefined extends op('PlaceholderUndefined').args<void>() {}
export class Literal extends op('Literal').args<{ value: ASTv2.LiteralExpression['value'] }>() {}
export class Path extends op('Path').args<{ head: Expr; tail: PresentArray<SourceSlice> }>() {}
export class GetArg extends op('GetArg').args<{ name: SourceSlice }>() {}
export class GetThis extends op('GetThis').void() {}
export class GetLocalVar extends op('GetLocalVar').args<{
  name: string;
}>() {}
export class GetFreeVar extends op('GetFreeVar').args<{
  name: string;
}>() {}
export class GetFreeVarWithResolution extends op('GetFreeVarWithResolution').args<{
  name: string;
  resolution: ASTv2.FreeVarResolution;
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
  name: string;
}>() {}

export class HasBlock extends op('HasBlock').args<{ target: SourceSlice }>() {}
export class HasBlockParams extends op('HasBlockParams').args<{ target: SourceSlice }>() {}
export class Interpolate extends op('Interpolate').args<{ parts: PresentList<Expr> }>() {}

export class SubExpression extends op('SubExpression').args<{
  head: Expr;
  args: Args;
}>() {}

export class Positional extends op('Positional').args<{ list: AnyOptionalList<Expr> }>() {}

export class NamedEntry extends op('NamedEntry').args<{ key: SourceSlice; value: Expr }>() {}

export class Named extends op('Named').args<{
  pairs: OptionalList<NamedEntry>;
}>() {}

export class Args extends op('Args').args<{ positional: Positional; named: Named }>() {}

export type Internal =
  | Ignore
  | Args
  | Positional
  | Named
  | NamedEntry
  | NamedBlock
  | NamedBlocks
  | ElementParameters;

export type InternalTable = OpsTable<Internal>;

export type Expr =
  | PlaceholderUndefined
  | Literal
  | Interpolate
  | Path
  | GetArg
  | GetThis
  | GetLocalVar
  | GetFreeVar
  | GetFreeVarWithResolution
  | GetWithResolver
  | HasBlock
  | HasBlockParams
  | SubExpression;

export type ExprTable = OpsTable<Expr>;

export type ExprLike = Expr | Internal;

/** STATEMENTS **/

export class Yield extends op('Yield').args<{
  target: SourceSlice;
  positional: Positional;
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
export class AppendComment extends op('AppendComment').args<{ value: SourceSlice }>() {}

export type NonSemantic = AppendWhitespace | AppendComment;

export class AppendTextNode extends op('AppendTextNode').args<{ value: Expr }>() {}
export class AppendTrustedHTML extends op('AppendTrustedHTML').args<{ value: Expr }>() {}

export class BlockInvocation extends op('BlockInvocation').args<{
  head: Expr;
  args: Args;
  blocks: NamedBlocks;
}>() {}

export class NamedBlock extends op('NamedBlock').args<{
  name: SourceSlice;
  table: BlockSymbolTable;
  body: Statement[];
}>() {}

export class NamedBlocks extends op('NamedBlocks').args<{
  blocks: OptionalList<NamedBlock>;
}>() {
  get(name: string): Optional<NamedBlock> {
    return this.args.blocks.into({
      ifEmpty: () => null,
      ifPresent: (blocks) =>
        blocks.toPresentArray().find((block) => block.args.name.getString() === name) || null,
    });
  }
}

export type NonSemanticChild = NonSemantic;

export class Ignore extends op('Ignore').void() {}

export class Component extends op('Component').args<{
  tag: Expr;
  params: ElementParameters;
  args: Named;
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
  args: Args;
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
