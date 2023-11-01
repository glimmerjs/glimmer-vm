import type {
  Cursor,
  Dict,
  ElementBuilder,
  ElementNamespace,
  Environment,
  Optional,
  Reference,
  RenderResult,
  SimpleDocument,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleText,
} from '@glimmer/interfaces';
import type { EnvironmentDelegate } from '@glimmer/runtime';

import type { TestJitRegistry } from './modes/jit/registry';
import type { TestJitRuntimeResolver } from './modes/jit/resolver';
import type { ASTPluginBuilder } from '@glimmer/syntax';
import type { JitContext } from './modes/jit/delegate';
import type { Self } from './render-test';

export interface RenderDelegateOptions {
  doc?: SimpleDocument | Document | undefined;
  env?: Optional<EnvironmentDelegate>;
  resolver?: (registry: TestJitRegistry) => TestJitRuntimeResolver;
}

export interface DomDelegate {
  getInitialElement(): SimpleElement;

  createElement(tagName: string): SimpleElement;
  createTextNode(content: string): SimpleText;
  createElementNS(namespace: ElementNamespace, tagName: string): SimpleElement;
  createDocumentFragment(): SimpleDocumentFragment;
}

/**
 * A WrappedTemplate is used to wrap tests in no-op handling (such as `{{#-try}}` error recovery).
 *
 * It has the wrapped template itself, as well as any properties (`this` values) needed to make the template work.
 */
export interface WrappedTemplate {
  template: string;
  properties?: Dict;
}

export interface LogRender {
  template: string;
  self: Self;
  element: SimpleElement;
}

export default interface RenderDelegate {
  // Each registered value (using the `test.register.XXX` APIs) will be registered in each of these
  // registries. In rehydration tests, this causes values to be registered on both the emulated
  // server and client.
  readonly registries: TestJitRegistry[];

  // The compilation and runtime contexts for the current testing environment.
  readonly context: JitContext;

  readonly dom: {
    document: SimpleDocument | Document;
    getInitialElement: (doc: SimpleDocument | Document) => SimpleElement;
  };

  /**
   * Optionally wrap the template in some additional code. This is used to wrap tests in no-op handling (such as
   * `{{#-try}}` error recovery).
   */
  wrap(template: string): WrappedTemplate;

  // Render the template into the given element. Rehydration delegates will emulate
  // rendering on the server and having the contents already present in the DOM.
  renderTemplate(
    template: string,
    self: Self,
    element: SimpleElement,
    snapshot: () => void,
    plugins: ASTPluginBuilder[]
  ): RenderResult;

  // Get the appropriate element builder for the current environment.
  getElementBuilder(env: Environment, cursor: Cursor): ElementBuilder;
}
