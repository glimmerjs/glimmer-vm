import type { Maybe, Nullable } from '../core';
import type { ElementOperations, Environment, ModifierInstance } from '../runtime';
import type { BlockBounds, Cursor } from './bounds';
import type { GlimmerTreeChanges, GlimmerTreeConstruction } from './changes';
import type {
  AttrNamespace,
  SimpleComment,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleNode,
  SimpleText,
} from './simple';

export type PartialBoundsDebug =
  | {
      type: 'first';
      node: SimpleNode;
    }
  | {
      type: 'last';
      node: SimpleNode;
    };

export type BlockBoundsDebug =
  | {
      type: 'empty';
      kind: string;
      parent: SimpleElement;
    }
  | {
      type: 'range';
      kind: string;
      range: [SimpleNode, SimpleNode];
      collapsed: boolean;
    };

export type SomeBoundsDebug = BlockBoundsDebug | PartialBoundsDebug;

export interface LiveBlock extends BlockBounds {
  readonly isRemote: boolean;

  debug?: () => BlockBoundsDebug;

  openElement(element: SimpleElement): void;
  closeElement(): void;
  didAppendNode(node: SimpleNode): void;
  didAppendBounds(bounds: BlockBounds): void;
  finalize(stack: ElementBuilder): void;

  /**
   * This is called when an error occurred in the block. Any existing nodes are cleared and a
   * comment is inserted instead.
   */
  catch(stack: ElementBuilder): void;
}

export interface SimpleLiveBlock extends LiveBlock {
  parentElement(): SimpleElement;
  firstNode(): SimpleNode;
  lastNode(): SimpleNode;
}

export interface UpdatableBlock extends SimpleLiveBlock {
  reset(env: Environment): Nullable<SimpleNode>;
}

export interface DOMStack {
  pushRemoteElement(
    element: SimpleElement,
    guid: string,
    insertBefore: Maybe<SimpleNode>
  ): Nullable<SimpleLiveBlock>;
  popRemoteElement(): void;
  popElement(): void;
  openElement(tag: string, _operations?: ElementOperations): SimpleElement;
  flushElement(modifiers: Nullable<ModifierInstance[]>): void;
  appendText(string: string): SimpleText;
  appendComment(string: string): SimpleComment;

  appendDynamicHTML(value: string): void;
  appendDynamicText(value: string): SimpleText;
  appendDynamicFragment(value: SimpleDocumentFragment): void;
  appendDynamicNode(value: SimpleNode): void;

  setStaticAttribute(name: string, value: string, namespace: Nullable<string>): void;
  setDynamicAttribute(
    name: string,
    value: unknown,
    isTrusting: boolean,
    namespace: Nullable<string>
  ): AttributeOperation;

  closeElement(): Nullable<ModifierInstance[]>;
}

export interface TreeOperations {
  __openElement(tag: string): SimpleElement;
  __flushElement(parent: SimpleElement, constructing: SimpleElement): void;
  __openBlock(): void;
  __closeBlock(): void;
  __appendText(text: string): SimpleText;
  __appendComment(string: string): SimpleComment;
  __appendNode(node: SimpleNode): SimpleNode;
  __appendHTML(html: string): BlockBounds;
  __setAttribute(name: string, value: string, namespace: Nullable<string>): void;
  __setProperty(name: string, value: unknown): void;
}

export interface ElementBuilder extends Cursor, DOMStack, TreeOperations {
  readonly debug: {
    readonly /** @mutable */ blocks: LiveBlock[];
    readonly /** @mutable */ inserting: Cursor[];
    readonly constructing: SimpleElement | null;
  };
  readonly nextSibling: Nullable<SimpleNode>;
  readonly dom: GlimmerTreeConstruction;
  readonly updateOperations: GlimmerTreeChanges;
  readonly constructing: Nullable<SimpleElement>;
  readonly element: SimpleElement;

  readonly hasBlocks: boolean;
  readonly block: LiveBlock;

  begin(): LiveBlock;
  finally(): void;
  catch(): void;

  pushSimpleBlock(): LiveBlock;
  pushUpdatableBlock(): UpdatableBlock;
  pushBlockList(list: BlockBounds[]): LiveBlock;
  popBlock(): LiveBlock;

  didAppendBounds(bounds: BlockBounds): void;
}

export interface AttributeCursor {
  element: SimpleElement;
  name: string;
  namespace: Nullable<AttrNamespace>;
}

export interface AttributeOperation {
  attribute: AttributeCursor;
  set(dom: ElementBuilder, value: unknown, env: Environment): void;
  update(value: unknown, env: Environment): void;
}
