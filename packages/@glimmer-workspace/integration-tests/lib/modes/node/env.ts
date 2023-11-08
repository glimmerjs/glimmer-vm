import type {
  GlimmerTreeChanges,
  GlimmerTreeConstruction,
  SimpleDocument,
} from '@glimmer/interfaces';
import type { RenderDelegateOptions } from '../../render-delegate';

import createHTMLDocument from '@simple-dom/document';

import { toInnerHTML } from '../../dom/simple-utils';
import { RenderTestContext } from '../../render-test';
import { ClientSideRenderDelegate } from '../jit/delegate';

export interface NodeEnvironmentOptions {
  document: SimpleDocument;
  appendOperations?: GlimmerTreeConstruction;
  updateOperations?: GlimmerTreeChanges;
}

export class NodeJitRenderDelegate extends ClientSideRenderDelegate {
  static override style = 'node jit';

  constructor(options: RenderDelegateOptions = {}) {
    options.doc = options.doc || createHTMLDocument();
    super(options);
  }
}

export abstract class NodeRenderTest extends RenderTestContext {
  override assertHTML(html: string) {
    let serialized = toInnerHTML(this.element);
    this.assert.strictEqual(serialized, html);
  }

  override assertComponent(html: string) {
    let el = this.assertingElement;

    if (this.testType !== 'Glimmer' && this.testType !== 'TemplateOnly') {
      this.assert.strictEqual(el.getAttribute('class'), 'ember-view');
      this.assert.ok(el.getAttribute('id'));
      this.assert.ok(el.getAttribute('id')!.indexOf('ember') > -1);
    }

    this.assert.strictEqual(toInnerHTML(el), html);
  }
}
