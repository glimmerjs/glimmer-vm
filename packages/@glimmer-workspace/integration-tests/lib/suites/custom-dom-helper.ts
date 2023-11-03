import { precompile } from '@glimmer/compiler';
import type { Cursor, ElementBuilder, Environment } from '@glimmer/interfaces';
import { NodeDOMTreeConstruction, serializeBuilder } from '@glimmer/node';
import { RenderTestContext } from '@glimmer-workspace/integration-tests';

import { blockStack } from '../dom/blocks';
import { toInnerHTML } from '../dom/simple-utils';
import { NodeJitRenderDelegate, NodeRenderTest } from '../modes/node/env';
import { render } from '../test-decorator';
import { strip } from '../test-helpers/strings';

export class DOMHelperTests extends NodeRenderTest {
  static suiteName = 'Server-side rendering in Node.js (normal)';

  @render
  'can instantiate NodeDOMTreeConstruction without a document'() {
    // this emulates what happens in Ember when using `App.visit('/', { shouldRender: false });`

    let helper = new NodeDOMTreeConstruction(null as any);

    this.assert.ok(!!helper, 'helper was instantiated without errors');
  }
}

export class CompilationTests extends RenderTestContext {
  static suiteName = 'Id generation';

  @render
  'generates id in node'() {
    let template = precompile('hello');
    let obj = JSON.parse(template);
    this.assert.strictEqual(obj.id, 'G0ggkEjw', 'short sha of template source');
    template = precompile('hello', { meta: { moduleName: 'template/hello' } });
    obj = JSON.parse(template);
    this.assert.strictEqual(obj.id, '4vC0bnaR', 'short sha of template source and meta');
  }
}

export class JitSerializationDelegate extends NodeJitRenderDelegate {
  static override style = 'jit serialization';

  override getElementBuilder(env: Environment, cursor: Cursor): ElementBuilder {
    return serializeBuilder(env, cursor);
  }
}

export class SerializedDOMHelperTests extends DOMHelperTests {
  static override suiteName = 'Server-side rendering in Node.js (serialize)';

  @render
  'The compiler can handle unescaped HTML'() {
    this.render.template('<div>{{{this.title}}}</div>', { title: '<strong>hello</strong>' });
    let b = blockStack();
    this.assertHTML(strip`
      <div>
        ${b(1)}
        <!--%glmr%-->
        <strong>hello</strong>
        <!--%glmr%-->
        ${b(1)}
      </div>
    `);
  }

  @render
  'Unescaped helpers render correctly'() {
    this.register.helper('testing-unescaped', (params) => params[0]);
    this.render.template('{{{testing-unescaped "<span>hi</span>"}}}');
    let b = blockStack();
    this.assertHTML(strip`
      ${b(1)}
      <!--%glmr%-->
      <span>hi</span>
      <!--%glmr%-->
      ${b(1)}
    `);
  }

  @render
  'Null literals do not have representation in DOM'() {
    this.render.template('{{null}}');
    this.assertHTML(strip`<!--% %-->`);
  }

  @render
  'Elements inside a yielded block'() {
    this.render.template('{{#if true}}<div id="test">123</div>{{/if}}');
    let b = blockStack();
    this.assertHTML(strip`
      ${b(1)}
      <div id=\"test\">123</div>
      ${b(1)}
    `);
  }

  @render
  'A simple block helper can return text'() {
    this.render.template('{{#if true}}test{{else}}not shown{{/if}}');
    let b = blockStack();
    this.assertHTML(strip`
      ${b(1)}
      test
      ${b(1)}
    `);
  }

  override assertHTML(html: string) {
    let b = blockStack();
    let serialized = toInnerHTML(this.element);
    this.assert.strictEqual(serialized, `${b(0)}${html}${b(0)}`);
  }
}
