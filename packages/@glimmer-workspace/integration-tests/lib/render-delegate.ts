import type {
  Cursor,
  Dict,
  DynamicScope,
  ElementBuilder,
  ElementNamespace,
  Environment,
  Optional,
  RenderResult,
  SimpleDocument,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleText,
} from '@glimmer/interfaces';
import type { Reference } from '@glimmer/reference';
import type { EnvironmentDelegate } from '@glimmer/runtime';
import type { ASTPluginBuilder } from '@glimmer/syntax';

import type { TestJitRegistry } from './modes/jit/registry';
import type { TestJitRuntimeResolver } from './modes/jit/resolver';
import type { JitTestDelegateContext } from '..';

export interface RenderDelegateOptions {
  doc?: SimpleDocument | Document | undefined;
  env?: Optional<EnvironmentDelegate>;
  resolver?: (registry: TestJitRegistry) => TestJitRuntimeResolver;
}

export default interface RenderDelegate {
  readonly registries: TestJitRegistry[];
  readonly context?: JitTestDelegateContext;

  getInitialElement(): SimpleElement;
  createElement(tagName: string): SimpleElement;
  createTextNode(content: string): SimpleText;
  createElementNS(namespace: ElementNamespace, tagName: string): SimpleElement;
  createDocumentFragment(): SimpleDocumentFragment;

  registerPlugin(plugin: ASTPluginBuilder): void;
  renderTemplate(
    template: string,
    context: Dict<unknown>,
    element: SimpleElement,
    snapshot: () => void
  ): RenderResult;
  renderComponent?(
    component: object,
    args: Record<string, unknown>,
    element: SimpleElement,
    dynamicScope?: DynamicScope
  ): RenderResult;
  getElementBuilder(env: Environment, cursor: Cursor): ElementBuilder;
  getSelf(env: Environment, context: unknown): Reference;
}
