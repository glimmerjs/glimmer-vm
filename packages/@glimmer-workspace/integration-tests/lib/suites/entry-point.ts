import { createPrimitiveRef } from '@glimmer/reference';
import { DynamicScopeImpl } from '@glimmer/runtime';
import { castToBrowser } from '@glimmer/util';

import type { ComponentKind } from '../components/types';
import { JitRenderDelegate } from '../modes/jit/delegate';
import { BrowserRenderTest, Count } from '../render-test';
import { test } from '../test-decorator';
import { defineComponent } from '../test-helpers/define';
import { jitSuite, nodeSuite } from '@glimmer-workspace/integration-tests';

export class EntryPointTest extends BrowserRenderTest {
  static suiteName = 'entry points';

  declare readonly testType: ComponentKind;

  override readonly count = new Count();

  @test
  'an entry point'() {
    let delegate = new JitRenderDelegate();
    let Title = defineComponent({}, `<h1>hello {{@title}}</h1>`);

    let builder = delegate.getInitialBuilder();
    let title = 'renderComponent';
    delegate.renderComponent(Title, { title }, builder);

    QUnit.assert.strictEqual(delegate.asElement().innerHTML, '<h1>hello renderComponent</h1>');
  }

  @test
  'does not leak args between invocations'() {
    let delegate = new JitRenderDelegate();
    let Title = defineComponent({}, `<h1>hello {{@title}}</h1>`);

    let title = 'renderComponent';
    let element = delegate.asElement();
    delegate.renderComponent(Title, { title }, delegate.getInitialBuilder());
    QUnit.assert.strictEqual(element.innerHTML, '<h1>hello renderComponent</h1>');

    delegate.reset();

    let newTitle = 'new title';
    delegate.renderComponent(Title, { title: newTitle }, delegate.getCurrentBuilder());
    QUnit.assert.strictEqual(delegate.asElement().innerHTML, '<h1>hello new title</h1>');
  }

  @test
  'can render different components per call'() {
    let delegate = new JitRenderDelegate();
    let Title = defineComponent({}, `<h1>hello {{@title}}</h1>`);
    let Body = defineComponent({}, `<p>body {{@body}}</p>`);

    let element = this.element;
    let title = 'renderComponent';
    delegate.renderComponent(Title, { title }, delegate.getInitialBuilder());
    QUnit.assert.strictEqual(
      castToBrowser(element, 'HTML').innerHTML,
      '<h1>hello renderComponent</h1>'
    );

    delegate.reset();

    element = this.element;
    let body = 'text';
    delegate.renderComponent(Body, { body }, delegate.getInitialBuilder());
    QUnit.assert.strictEqual(castToBrowser(element, 'HTML').innerHTML, '<p>body text</p>');
  }

  @test
  'supports passing in an initial dynamic context'() {
    let delegate = new JitRenderDelegate();
    let Locale = defineComponent({}, `{{-get-dynamic-var "locale"}}`);

    let element = this.element;
    let dynamicScope = new DynamicScopeImpl({
      locale: createPrimitiveRef('en_US'),
    });
    delegate.renderComponent(Locale, {}, delegate.getInitialBuilder(), dynamicScope);

    QUnit.assert.strictEqual(castToBrowser(element, 'HTML').innerHTML, 'en_US');
  }
}

jitSuite(EntryPointTest);
nodeSuite(EntryPointTest);
