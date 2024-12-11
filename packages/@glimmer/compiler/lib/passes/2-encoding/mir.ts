import type { CurriedType, PresentArray } from '@glimmer/interfaces';
import type {
  ASTv2,
  BlockSymbolTable,
  ProgramSymbolTable,
  SourceSlice,
  SourceSpan,
  SymbolTable,
} from '@glimmer/syntax';
import { setLocalDebugType } from '@glimmer/debug-util';

import type { AnyOptionalList, OptionalList, PresentList } from '../../shared/list';

type NodeFields<N extends ASTv2.BaseNodeFields> = Omit<N, 'type'>;

function build<const K extends string, F extends ASTv2.BaseNodeFields>(
  type: K,
  fields: F
): F & { type: K } {
  const node = {
    ...fields,
    type,
  };

  setLocalDebugType('syntax:mir:node', node);

  return node;
}

type MirNode<T extends string, F> = F & { type: T; loc: SourceSpan };

export type Template = MirNode<'Template', { scope: ProgramSymbolTable; body: Statement[] }>;

export function Template(fields: NodeFields<Template>): Template {
  return build('Template', fields);
}

export type InElement = MirNode<
  'InElement',
  {
    guid: string;
    insertBefore: ExpressionNode | Missing;
    destination: ExpressionNode;
    block: NamedBlock;
  }
>;

export function InElement(fields: NodeFields<InElement>): InElement {
  return build('InElement', fields);
}

export type Not = MirNode<'Not', { value: ExpressionNode }>;

export function Not(fields: NodeFields<Not>): Not {
  return build('Not', fields);
}

export type If = MirNode<
  'If',
  {
    condition: ExpressionNode;
    block: NamedBlock;
    inverse: NamedBlock | null;
  }
>;

export function If(fields: NodeFields<If>): If {
  return build('If', fields);
}

export type IfInline = MirNode<
  'IfInline',
  {
    condition: ExpressionNode;
    truthy: ExpressionNode;
    falsy: ExpressionNode | null;
  }
>;

export function IfInline(fields: NodeFields<IfInline>): IfInline {
  return build('IfInline', fields);
}

export type Each = MirNode<
  'Each',
  {
    value: ExpressionNode;
    key: ExpressionNode | null;
    block: NamedBlock;
    inverse: NamedBlock | null;
  }
>;

export function Each(fields: NodeFields<Each>): Each {
  return build('Each', fields);
}

export type Let = MirNode<
  'Let',
  {
    positional: Positional;
    block: NamedBlock;
  }
>;

export function Let(fields: NodeFields<Let>): Let {
  return build('Let', fields);
}

export type WithDynamicVars = MirNode<
  'WithDynamicVars',
  {
    named: NamedArguments;
    block: NamedBlock;
  }
>;

export function WithDynamicVars(fields: NodeFields<WithDynamicVars>): WithDynamicVars {
  return build('WithDynamicVars', fields);
}

export type GetDynamicVar = MirNode<
  'GetDynamicVar',
  {
    name: ExpressionNode;
  }
>;

export function GetDynamicVar(fields: NodeFields<GetDynamicVar>): GetDynamicVar {
  return build('GetDynamicVar', fields);
}

export type Log = MirNode<'Log', { positional: Positional }>;

export function Log(fields: NodeFields<Log>): Log {
  return build('Log', fields);
}

export type InvokeComponent = MirNode<
  'InvokeComponent',
  {
    definition: ExpressionNode;
    args: Args;
    blocks: NamedBlocks | null;
  }
>;

export function InvokeComponent(fields: NodeFields<InvokeComponent>): InvokeComponent {
  return build('InvokeComponent', fields);
}

export type NamedBlocks = MirNode<
  'NamedBlocks',
  {
    blocks: OptionalList<NamedBlock>;
  }
>;

export function NamedBlocks(fields: NodeFields<NamedBlocks>): NamedBlocks {
  return build('NamedBlocks', fields);
}

export type NamedBlock = MirNode<
  'NamedBlock',
  {
    name: SourceSlice;
    scope: BlockSymbolTable;
    body: Statement[];
  }
>;

export function NamedBlock(fields: NodeFields<NamedBlock>): NamedBlock {
  return build('NamedBlock', fields);
}

export type AppendTrustedHTML = MirNode<'AppendTrustedHTML', { html: ExpressionNode }>;

export function AppendTrustedHTML(fields: NodeFields<AppendTrustedHTML>): AppendTrustedHTML {
  return build('AppendTrustedHTML', fields);
}

export type AppendTextNode = MirNode<'AppendTextNode', { text: ExpressionNode }>;

export function AppendTextNode(fields: NodeFields<AppendTextNode>): AppendTextNode {
  return build('AppendTextNode', fields);
}

export type AppendComment = MirNode<'AppendComment', { value: SourceSlice }>;

export function AppendComment(fields: NodeFields<AppendComment>): AppendComment {
  return build('AppendComment', fields);
}

export type Component = MirNode<
  'Component',
  {
    tag: ExpressionNode;
    params: ElementParameters;
    args: NamedArguments;
    blocks: NamedBlocks;
  }
>;

export function Component(fields: NodeFields<Component>): Component {
  return build('Component', fields);
}

export interface AttrKind {
  // triple-curly
  trusting: boolean;
  // this attribute is on an element with component features:
  //   - <CapCase ...>
  //   - modifiers
  //   - <dynamic.tag ...>
  component: boolean;
}

export type StaticAttr = MirNode<
  'StaticAttr',
  {
    kind: AttrKind;
    name: SourceSlice;
    value: SourceSlice;
    namespace?: string | undefined;
  }
>;

export function StaticAttr(fields: NodeFields<StaticAttr>): StaticAttr {
  return build('StaticAttr', fields);
}

export type DynamicAttr = MirNode<
  'DynamicAttr',
  {
    kind: AttrKind;
    name: SourceSlice;
    value: ExpressionNode;
    namespace?: string | undefined;
  }
>;

export function DynamicAttr(fields: NodeFields<DynamicAttr>): DynamicAttr {
  return build('DynamicAttr', fields);
}

export type SimpleElement = MirNode<
  'SimpleElement',
  {
    tag: SourceSlice;
    params: ElementParameters;
    body: Statement[];
    dynamicFeatures: boolean;
  }
>;

export function SimpleElement(fields: NodeFields<SimpleElement>): SimpleElement {
  return build('SimpleElement', fields);
}

export type ElementParameters = MirNode<
  'ElementParameters',
  {
    body: AnyOptionalList<ElementParameter>;
  }
>;

export function ElementParameters(fields: NodeFields<ElementParameters>): ElementParameters {
  return build('ElementParameters', fields);
}

export type Yield = MirNode<
  'Yield',
  {
    target: SourceSlice;
    to: number;
    positional: Positional;
  }
>;

export function Yield(fields: NodeFields<Yield>): Yield {
  return build('Yield', fields);
}

export type Debugger = MirNode<'Debugger', { scope: SymbolTable }>;

export function Debugger(fields: NodeFields<Debugger>): Debugger {
  return build('Debugger', fields);
}

export type CallExpression = MirNode<
  'CallExpression',
  {
    callee: ExpressionNode;
    args: Args;
  }
>;

export function CallExpression(fields: NodeFields<CallExpression>): CallExpression {
  return build('CallExpression', fields);
}

export type Modifier = MirNode<'Modifier', { callee: ExpressionNode; args: Args }>;

export function Modifier(fields: NodeFields<Modifier>): Modifier {
  return build('Modifier', fields);
}

export type InvokeBlock = MirNode<
  'InvokeBlock',
  {
    head: ExpressionNode;
    args: Args;
    blocks: NamedBlocks;
  }
>;

export function InvokeBlock(fields: NodeFields<InvokeBlock>): InvokeBlock {
  return build('InvokeBlock', fields);
}

export type SplatAttr = MirNode<'SplatAttr', { symbol: number }>;

export function SplatAttr(fields: NodeFields<SplatAttr>): SplatAttr {
  return build('SplatAttr', fields);
}

export type PathExpression = MirNode<
  'PathExpression',
  {
    head: ExpressionNode;
    tail: Tail;
  }
>;

export function PathExpression(fields: NodeFields<PathExpression>): PathExpression {
  return build('PathExpression', fields);
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Missing = MirNode<'Missing', {}>;

export function Missing(fields: NodeFields<Missing>): Missing {
  return build('Missing', fields);
}

export type InterpolateExpression = MirNode<
  'InterpolateExpression',
  {
    parts: PresentList<ExpressionNode>;
  }
>;

export function InterpolateExpression(
  fields: NodeFields<InterpolateExpression>
): InterpolateExpression {
  return build('InterpolateExpression', fields);
}

export type HasBlock = MirNode<
  'HasBlock',
  {
    target: SourceSlice;
    symbol: number;
  }
>;

export function HasBlock(fields: NodeFields<HasBlock>): HasBlock {
  return build('HasBlock', fields);
}

export type HasBlockParams = MirNode<
  'HasBlockParams',
  {
    target: SourceSlice;
    symbol: number;
  }
>;

export function HasBlockParams(fields: NodeFields<HasBlockParams>): HasBlockParams {
  return build('HasBlockParams', fields);
}

export type Curry = MirNode<
  'Curry',
  {
    definition: ExpressionNode;
    curriedType: CurriedType;
    args: Args;
  }
>;

export function Curry(fields: NodeFields<Curry>): Curry {
  return build('Curry', fields);
}

export type Positional = MirNode<'Positional', { list: OptionalList<ExpressionNode> }>;

export function Positional(fields: NodeFields<Positional>): Positional {
  return build('Positional', fields);
}

export type NamedArguments = MirNode<'NamedArguments', { entries: OptionalList<NamedArgument> }>;

export function NamedArguments(fields: NodeFields<NamedArguments>): NamedArguments {
  return build('NamedArguments', fields);
}

export type NamedArgument = MirNode<'NamedArgument', { key: SourceSlice; value: ExpressionNode }>;

export function NamedArgument(fields: NodeFields<NamedArgument>): NamedArgument {
  return build('NamedArgument', fields);
}

export type Args = MirNode<
  'Args',
  {
    positional: Positional;
    named: NamedArguments;
  }
>;

export function Args(fields: NodeFields<Args>): Args {
  return build('Args', fields);
}

export type Tail = MirNode<
  'Tail',
  {
    members: PresentArray<SourceSlice>;
  }
>;

export function Tail(fields: NodeFields<Tail>): Tail {
  return build('Tail', fields);
}

export type ExpressionNode =
  | ASTv2.LiteralExpression
  | ASTv2.KeywordExpression
  | ASTv2.VariableReference
  | Missing
  | PathExpression
  | InterpolateExpression
  | CallExpression
  | Not
  | IfInline
  | HasBlock
  | HasBlockParams
  | Curry
  | GetDynamicVar
  | Log;

export type ElementParameter = StaticAttr | DynamicAttr | Modifier | SplatAttr;

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
  | Let
  | WithDynamicVars
  | InvokeComponent;
