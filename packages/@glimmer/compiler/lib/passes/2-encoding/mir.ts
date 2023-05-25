import type { CurriedType, PresentArray } from '@glimmer/interfaces';
import { ASTv2 } from '@glimmer/syntax';
import type {
  SymbolTable,
  SourceSlice,
  BlockSymbolTable,
  ProgramSymbolTable,
} from '@glimmer/syntax';

import type { AnyOptionalList, OptionalList, PresentList } from '../../shared/list';

const AstNode = ASTv2.AstNode;

export class Template extends AstNode {
  readonly type = 'Template';
  declare scope: ProgramSymbolTable;
  declare body: Statement[];
}

export class InElement extends AstNode {
  readonly type = 'InElement';
  declare guid: string;
  declare insertBefore: ExpressionNode | Missing;
  declare destination: ExpressionNode;
  declare block: NamedBlock;
}

export class Not extends AstNode {
  readonly type = 'Not';
  declare value: ExpressionNode;
}

export class If extends AstNode {
  readonly type = 'If';
  declare condition: ExpressionNode;
  declare block: NamedBlock;
  declare inverse: NamedBlock | null;
}

export class IfInline extends AstNode {
  readonly type = 'IfInline';
  declare condition: ExpressionNode;
  declare truthy: ExpressionNode;
  declare falsy: ExpressionNode | null;
}

export class Each extends AstNode {
  readonly type = 'Each';
  declare value: ExpressionNode;
  declare key: ExpressionNode | null;
  declare block: NamedBlock;
  declare inverse: NamedBlock | null;
}

export class With extends AstNode {
  readonly type = 'With';
  declare value: ExpressionNode;
  declare block: NamedBlock;
  declare inverse: NamedBlock | null;
}

export class Let extends AstNode {
  readonly type = 'Let';
  declare positional: Positional;
  declare block: NamedBlock;
}

export class WithDynamicVars extends AstNode {
  readonly type = 'WithDynamicVars';
  declare named: NamedArguments;
  declare block: NamedBlock;
}

export class GetDynamicVar extends AstNode {
  readonly type = 'GetDynamicVar';
  declare name: ExpressionNode;
}

export class Log extends AstNode {
  readonly type = 'Log';
  declare positional: Positional;
}

export class InvokeComponent extends AstNode {
  readonly type = 'InvokeComponent';
  declare definition: ExpressionNode;
  declare args: Args;
  declare blocks: NamedBlocks | null;
}

export class NamedBlocks extends AstNode {
  readonly type = 'NamedBlocks';
  declare blocks: OptionalList<NamedBlock>;
}

export class NamedBlock extends AstNode {
  readonly type = 'NamedBlock';
  declare scope: BlockSymbolTable;
  declare name: SourceSlice;
  declare body: Statement[];
}
export class EndBlock extends AstNode {
  readonly type = 'EndBlock';
}
export class AppendTrustedHTML extends AstNode {
  readonly type = 'AppendTrustedHTML';
  declare html: ExpressionNode;
}
export class AppendTextNode extends AstNode {
  readonly type = 'AppendTextNode';
  declare text: ExpressionNode;
}
export class AppendComment extends AstNode {
  readonly type = 'AppendComment';
  declare value: SourceSlice;
}

export class Component extends AstNode {
  readonly type = 'Component';
  declare tag: ExpressionNode;
  declare params: ElementParameters;
  declare args: NamedArguments;
  declare blocks: NamedBlocks;
}

export interface AttributeKind {
  // triple-curly
  trusting: boolean;
  // this attribute is on an element with component features:
  //   - <CapCase ...>
  //   - modifiers
  //   - <dynamic.tag ...>
  component: boolean;
}

export class StaticAttr extends AstNode {
  readonly type = 'StaticAttr';
  declare kind: { component: boolean };
  declare name: SourceSlice;
  declare value: SourceSlice;
  declare strict: boolean;
}

export class DynamicAttr extends AstNode {
  readonly type = 'DynamicAttr';
  declare kind: AttributeKind;
  declare name: SourceSlice;
  declare value: ExpressionNode;
  declare strict: boolean;
}

export class SimpleElement extends AstNode {
  readonly type = 'SimpleElement';
  declare tag: SourceSlice;
  declare params: ElementParameters;
  declare body: Statement[];
  declare dynamicFeatures: boolean;
}

export class ElementParameters extends AstNode {
  readonly type = 'ElementParameters';
  declare body: AnyOptionalList<ElementParameter>;
}

export class Yield extends AstNode {
  readonly type = 'Yield';
  declare target: SourceSlice;
  declare to: number;
  declare positional: Positional;
}
export class Debugger extends AstNode {
  readonly type = 'Debugger';
  declare scope: SymbolTable;
}

export class CallExpression extends AstNode {
  readonly type = 'CallExpression';
  declare callee: ExpressionNode;
  declare args: Args;
}
export class DeprecatedCallExpression extends AstNode {
  readonly type = 'DeprecatedCallExpression';
  declare arg: SourceSlice;
  declare callee: ASTv2.FreeVarReference;
}

export class Modifier extends AstNode {
  readonly type = 'Modifier';
  declare callee: ExpressionNode;
  declare args: Args;
}
export class InvokeBlock extends AstNode {
  readonly type = 'InvokeBlock';
  declare head: ExpressionNode;
  declare args: Args;
  declare blocks: NamedBlocks;
}
export class SplatAttr extends AstNode {
  readonly type = 'SplatAttr';
  declare symbol: number;
}
export class PathExpression extends AstNode {
  readonly type = 'PathExpression';
  declare head: ExpressionNode;
  declare tail: Tail;
}
export class GetWithResolver extends AstNode {
  readonly type = 'GetWithResolver';
  declare symbol: number;
}

export class GetSymbol extends AstNode {
  readonly type = 'GetSymbol';
  declare symbol: number;
}
export class GetFreeWithContext extends AstNode {
  readonly type = 'GetFreeWithContext';
  declare symbol: number;
  declare context: ASTv2.FreeVarResolution;
}
/** strict mode */
export class GetFree extends AstNode {
  readonly type = 'GetFree';
  declare symbol: number;
}

export class Missing extends AstNode {
  readonly type = 'Missing';
}
export class InterpolateExpression extends AstNode {
  readonly type = 'InterpolateExpression';
  declare parts: PresentList<ExpressionNode>;
}
export class HasBlock extends AstNode {
  readonly type = 'HasBlock';
  declare target: SourceSlice;
  declare symbol: number;
}

export class HasBlockParams extends AstNode {
  readonly type = 'HasBlockParams';
  declare target: SourceSlice;
  declare symbol: number;
}
export class Curry extends AstNode {
  readonly type = 'Curry';
  declare definition: ExpressionNode;
  declare curriedType: CurriedType;
  declare args: Args;
}
export class Positional extends AstNode {
  readonly type = 'Positional';
  declare list: OptionalList<ExpressionNode>;
}
export class NamedArguments extends AstNode {
  readonly type = 'NamedArguments';
  declare entries: OptionalList<NamedArgument>;
}
export class NamedArgument extends AstNode {
  readonly type = 'NamedArgument';
  declare key: SourceSlice;
  declare value: ExpressionNode;
}
export class Args extends AstNode {
  readonly type = 'Args';
  declare positional: Positional;
  declare named: NamedArguments;
}

export class Tail extends AstNode {
  readonly type = 'Tail';
  declare members: PresentArray<SourceSlice>;
}

export type ExpressionNode =
  | ASTv2.LiteralExpression
  | Missing
  | PathExpression
  | ASTv2.VariableReference
  | InterpolateExpression
  | CallExpression
  | DeprecatedCallExpression
  | Not
  | IfInline
  | HasBlock
  | HasBlockParams
  | Curry
  | GetDynamicVar
  | Log;

export type ElementParameter = StaticAttr | DynamicAttr | Modifier | SplatAttr;

export type Internal =
  | Args
  | Positional
  | NamedArguments
  | NamedArgument
  | Tail
  | NamedBlock
  | NamedBlocks
  | ElementParameters;
export type ExprLike = ExpressionNode | Internal;
export type Statement =
  | InElement
  | Debugger
  | Yield
  | AppendTrustedHTML
  | AppendTextNode
  | Component
  | SimpleElement
  | InvokeBlock
  | AppendComment
  | If
  | Each
  | With
  | Let
  | WithDynamicVars
  | InvokeComponent;
