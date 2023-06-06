import type {
  CompileTimeCompilationContext,
  GlimmerTreeChanges,
  GlimmerTreeConstruction,
  RuntimeContext,
  SimpleDocument,
} from '@glimmer/interfaces';

import { assertingElement, toInnerHTML } from '../../dom/simple-utils';
import type RenderDelegate from '../../render-delegate';
import { RenderTest } from '../../render-test';
import { ServerTreeBuilder } from '@glimmer/runtime/lib/dom/tree-builder';
import { unwrap } from '@glimmer/validator/lib/utils';
import { assert, isElement } from '@glimmer/util';
import {
  BasicRenderDelegate,
  JitDelegateContext,
  type JitTestDelegateContext,
} from '../jit/delegate';

export interface NodeEnvironmentOptions {
  document: SimpleDocument;
  appendOperations?: GlimmerTreeConstruction;
  updateOperations?: GlimmerTreeChanges;
}

export class NodeJitRenderDelegate extends BasicRenderDelegate {
  static style = 'ssr';

  #builder: ServerTreeBuilder | undefined;
  #html: string | undefined;
  #context: JitTestDelegateContext | null = null;

  get context(): JitTestDelegateContext {
    if (this.#context === null) {
      this.#context = JitDelegateContext(this.resolver, this.env, document);
    }

    return this.#context;
  }

  get runtime(): RuntimeContext {
    return this.context.runtime;
  }

  get program(): CompileTimeCompilationContext {
    return this.context.program;
  }

  getInitialBuilder(): ServerTreeBuilder {
    return (this.#builder = new ServerTreeBuilder());
  }
  getCurrentBuilder(): ServerTreeBuilder {
    return unwrap(this.#builder);
  }
  getHTML(): string {
    if (this.#html) return this.#html;
    return (this.#html = this.getCurrentBuilder()._flush_());
  }
  asElement(): Element {
    let template = document.createElement('template');
    template.innerHTML = this.getHTML();
    let fragment = template.content;
    let first = fragment.firstChild;

    assert(first?.nextSibling === null, 'First child should be null');
    assert(isElement(first), 'First child should be an element');
    return first;
  }
}

export class AbstractNodeTest extends RenderTest {
  constructor(delegate: RenderDelegate) {
    super(delegate);
  }

  override assertHTML(html: string) {
    let serialized = this.delegate.getHTML();
    this.assert.strictEqual(serialized, html);
  }

  override assertComponent(html: string) {
    let element = assertingElement(this.delegate.asElement());

    if (this.testType !== 'Glimmer') {
      this.assert.strictEqual(element.getAttribute('class'), 'ember-view');
      this.assert.ok(element.getAttribute('id'));
      this.assert.ok(element.getAttribute('id')!.includes('ember'));
    }

    let serialized = toInnerHTML(element);
    this.assert.strictEqual(serialized, html);
  }
}
