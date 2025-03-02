import type { Cursor, Environment, TreeBuilder } from '@glimmer/interfaces';
import { precompile } from '@glimmer/compiler';
import { NodeDOMTreeConstruction, serializeBuilder } from '@glimmer/node';

import { blockStack } from '../dom/blocks';
import { toInnerHTML } from '../dom/simple-utils';
import { AbstractNodeTest, NodeJitRenderDelegate } from '../modes/node/env';
import { RenderTest } from '../render-test';
import { test } from '../test-decorator';
import { strip } from '../test-helpers/strings';

export class DOMHelperTests extends AbstractNodeTest {
  static suiteName = 'Server-side rendering in Node.js (normal)';

  @test
  'can instantiate NodeDOMTreeConstruction without a document'() {
    // this emulates what happens in Ember when using `App.visit('/', { shouldRender: false });`

    let helper = new NodeDOMTreeConstruction(null as any);

    this.assert.ok(!!helper, 'helper was instantiated without errors');
  }
}

export class CompilationTests extends RenderTest {
  static suiteName = 'Id generation';

  @test
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

  override getElementBuilder(env: Environment, cursor: Cursor): TreeBuilder {
    return serializeBuilder(env, cursor);
  }
}

export class SerializedDOMHelperTests extends DOMHelperTests {
  static override suiteName = 'Server-side rendering in Node.js (serialize)';

  @test
  'The compiler can handle unescaped HTML'() {
    this.render('<div>{{{this.title}}}</div>', { title: '<strong>hello</strong>' });
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

  @test
  'Unescaped helpers render correctly'() {
    this.registerHelper('testing-unescaped', (params) => params[0]);
    this.render('{{{testing-unescaped "<span>hi</span>"}}}');
    let b = blockStack();
    this.assertHTML(strip`
      ${b(1)}
      <!--%glmr%-->
      <span>hi</span>
      <!--%glmr%-->
      ${b(1)}
    `);
  }

  @test
  'Null literals do not have representation in DOM'() {
    this.render('{{null}}');
    this.assertHTML(strip`<!--% %-->`);
  }

  @test
  'Elements inside a yielded block'() {
    this.render('{{#if true}}<div id="test">123</div>{{/if}}');
    let b = blockStack();
    this.assertHTML(strip`
      ${b(1)}
      <div id=\"test\">123</div>
      ${b(1)}
    `);
  }

  @test
  'A simple block helper can return text'() {
    this.render('{{#if true}}test{{else}}not shown{{/if}}');
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
