import { createPrimitiveCell } from '@glimmer/reference';
import { DynamicScopeImpl } from '@glimmer/runtime';
import { castToBrowser } from '@glimmer/util';
import { ClientSideRenderDelegate, matrix } from '@glimmer-workspace/integration-tests';

import { defineComponent } from '../test-helpers/define';

matrix('entry points', (spec) => {
  spec('an entry point', (ctx) => {
    let Title = defineComponent({}, `<h1>hello {{@title}}</h1>`);

    ctx.render.component(Title, { title: 'renderComponent' }, { into: ctx.element });

    QUnit.assert.strictEqual(
      castToBrowser(ctx.element, 'HTML').innerHTML,
      '<h1>hello renderComponent</h1>'
    );
  });

  spec('does not leak args between invocations', (ctx) => {
    let delegate = new ClientSideRenderDelegate();
    let Title = defineComponent({}, `<h1>hello {{@title}}</h1>`);

    let element = delegate.dom.getInitialElement(delegate.dom.document);
    ctx.render.component(Title, { title: 'renderComponent' }, { into: element });
    QUnit.assert.strictEqual(
      castToBrowser(element, 'HTML').innerHTML,
      '<h1>hello renderComponent</h1>'
    );

    element = ctx.getClearedElement();
    ctx.render.component(Title, { title: 'new title' }, { into: element });
    QUnit.assert.strictEqual(castToBrowser(element, 'HTML').innerHTML, '<h1>hello new title</h1>');
  });

  spec('can render different components per call', (ctx) => {
    let Title = defineComponent({}, `<h1>hello {{@title}}</h1>`);
    let Body = defineComponent({}, `<p>body {{@body}}</p>`);

    ctx.render.component(Title, { title: 'renderComponent' });
    QUnit.assert.strictEqual(
      castToBrowser(ctx.element, 'HTML').innerHTML,
      '<h1>hello renderComponent</h1>'
    );

    const element = ctx.getClearedElement();
    ctx.render.component(Body, { body: 'text' }, { into: element });
    QUnit.assert.strictEqual(castToBrowser(element, 'HTML').innerHTML, '<p>body text</p>');
  });

  spec('supports passing in an initial dynamic context', (ctx) => {
    let Locale = defineComponent({}, `{{-get-dynamic-var "locale"}}`);

    let dynamicScope = new DynamicScopeImpl({
      locale: createPrimitiveCell('en_US'),
    });
    ctx.render.component(Locale, {}, { dynamicScope });

    QUnit.assert.strictEqual(castToBrowser(ctx.element, 'HTML').innerHTML, 'en_US');
  });
}).client();
