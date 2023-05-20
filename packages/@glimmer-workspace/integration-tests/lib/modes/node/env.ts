import type {
  GlimmerTreeChanges,
  GlimmerTreeConstruction,
  SimpleDocument,
} from '@glimmer/interfaces';
import createHTMLDocument from '@simple-dom/document';

import { assertingElement, toInnerHTML } from '../../dom/simple-utils';
import type RenderDelegate from '../../render-delegate';
import type { RenderDelegateOptions } from '../../render-delegate';
import { RenderTest } from '../../render-test';
import { JitRenderDelegate } from '../jit/delegate';

export interface NodeEnvironmentOptions {
  document: SimpleDocument;
  appendOperations?: GlimmerTreeConstruction;
  updateOperations?: GlimmerTreeChanges;
}

export class NodeJitRenderDelegate extends JitRenderDelegate {
  static override style = 'node jit';

  constructor(options: RenderDelegateOptions = {}) {
    options.doc = options.doc || createHTMLDocument();
    super(options);
  }
}

export class AbstractNodeTest extends RenderTest {
  constructor(delegate: RenderDelegate) {
    super(delegate);
  }

  override assertHTML(html: string) {
    let serialized = toInnerHTML(this.element);
    this.assert.strictEqual(serialized, html);
  }

  override assertComponent(html: string) {
    let element = assertingElement(this.element.firstChild);

    if (this.testType !== 'Glimmer') {
      this.assert.strictEqual(element.getAttribute('class'), 'ember-view');
      this.assert.ok(element.getAttribute('id'));
      this.assert.ok(element.getAttribute('id')!.includes('ember'));
    }

    let serialized = toInnerHTML(element);
    this.assert.strictEqual(serialized, html);
  }
}
