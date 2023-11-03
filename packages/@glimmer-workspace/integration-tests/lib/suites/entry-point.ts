import { createPrimitiveCell } from '@glimmer/reference';
import { DynamicScopeImpl } from '@glimmer/runtime';
import { castToBrowser } from '@glimmer/util';

import { JitRenderDelegate } from '../modes/jit/delegate';
import { RenderTest } from '../render-test';
import { render } from '../test-decorator';
import { defineComponent } from '../test-helpers/define';

export class EntryPointTest extends RenderTest {
  static suiteName = 'entry points';

  @render
  'an entry point'() {
    let Title = defineComponent({}, `<h1>hello {{@title}}</h1>`);

    let title = createPrimitiveCell('renderComponent');
    this.render.component(Title, { title }, { into: this.element });

    QUnit.assert.strictEqual(
      castToBrowser(this.element, 'HTML').innerHTML,
      '<h1>hello renderComponent</h1>'
    );
  }

  @render
  'does not leak args between invocations'() {
    let delegate = new JitRenderDelegate();
    let Title = defineComponent({}, `<h1>hello {{@title}}</h1>`);

    let element = delegate.dom.getInitialElement(delegate.dom.document);
    let title = createPrimitiveCell('renderComponent');
    this.render.component(Title, { title }, { into: element });
    QUnit.assert.strictEqual(
      castToBrowser(element, 'HTML').innerHTML,
      '<h1>hello renderComponent</h1>'
    );

    element = this.getInitialElement();
    let newTitle = createPrimitiveCell('new title');
    this.render.component(Title, { title: newTitle }, { into: element });
    QUnit.assert.strictEqual(castToBrowser(element, 'HTML').innerHTML, '<h1>hello new title</h1>');
  }

  @render
  'can render different components per call'() {
    let Title = defineComponent({}, `<h1>hello {{@title}}</h1>`);
    let Body = defineComponent({}, `<p>body {{@body}}</p>`);

    let title = createPrimitiveCell('renderComponent');
    this.render.component(Title, { title });
    QUnit.assert.strictEqual(
      castToBrowser(this.element, 'HTML').innerHTML,
      '<h1>hello renderComponent</h1>'
    );

    const delegate = new JitRenderDelegate();
    const element = delegate.dom.getInitialElement(delegate.dom.document);
    let body = createPrimitiveCell('text');
    this.render.component(Body, { body }, { into: element });
    QUnit.assert.strictEqual(castToBrowser(element, 'HTML').innerHTML, '<p>body text</p>');
  }

  @render
  'supports passing in an initial dynamic context'() {
    let Locale = defineComponent({}, `{{-get-dynamic-var "locale"}}`);

    let dynamicScope = new DynamicScopeImpl({
      locale: createPrimitiveCell('en_US'),
    });
    this.render.component(Locale, {}, { dynamicScope });

    QUnit.assert.strictEqual(castToBrowser(this.element, 'HTML').innerHTML, 'en_US');
  }
}
