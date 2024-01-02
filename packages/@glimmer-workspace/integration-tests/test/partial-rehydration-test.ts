import { castToSimple } from '@glimmer/util';
import {
  CLOSE,
  content,
  OPEN,
  PartialRehydrationDelegate,
  qunitFixture,
  RenderTestContext,
  replaceHTML,
  stripTight,
  test,
  testSuite,
} from '@glimmer-workspace/integration-tests';

export class PartialRehydrationTest extends RenderTestContext {
  static suiteName = 'partial rehydration';
  declare delegate: PartialRehydrationDelegate;

  @test
  'can rehydrate from non starting blocks'() {
    this.register.component('TemplateOnly', 'RehydratingComponent', '{{@a}}{{@b}}{{@c}}');

    this.register.component(
      'TemplateOnly',
      'Root',
      '<div id="placeholder"><RehydratingComponent @a={{@a}} @b={{@b}} @c={{@c}}/></div>'
    );

    const args = {
      a: 'a',
      b: 'b',
      c: 'c',
    };

    const html = this.delegate.renderComponentServerSide('Root', args);
    this.assert.strictEqual(
      html,
      content([
        OPEN,
        OPEN,
        '<div id="placeholder">',
        OPEN,
        OPEN,
        'a',
        CLOSE,
        OPEN,
        'b',
        CLOSE,
        OPEN,
        'c',
        CLOSE,
        CLOSE,
        '</div>',
        CLOSE,
        CLOSE,
      ]),
      'Expect server output to match'
    );

    replaceHTML(qunitFixture(), html);
    this.element = qunitFixture();
    this.renderResult = this.delegate.renderComponentClientSide(
      'RehydratingComponent',
      args,
      castToSimple(document.getElementById('placeholder')!)
    );
    this.assertHTML(content([OPEN, OPEN, '<div id="placeholder">abc</div>', CLOSE, CLOSE]));
    this.assert.ok(
      this.delegate.rehydrationStats.clearedNodes.length === 0,
      'No nodes were cleared'
    );
    this.assertStableNodes();
    this.assertStableRerender();
  }

  @test
  'can rehydrate multiple call sites'() {
    this.register.component('TemplateOnly', 'Nav', '{{@title}}');
    this.register.component('TemplateOnly', 'Carousel', '{{@name}}');
    this.register.component('TemplateOnly', 'Header', '<h1>I am a test</h1>');

    this.register.component(
      'TemplateOnly',
      'Root',
      stripTight`
        <div class="nav-container">
          <Nav @title={{@nav.title}}/>
        </div>
        <Header/>
        <div class="carousel-container">
          <Carousel @name={{@carousel.name}}/>
        </div>
      `
    );

    const args = {
      nav: {
        title: 'Nav',
      },
      carousel: {
        name: 'Carousel',
      },
    };

    const html = this.delegate.renderComponentServerSide('Root', args);
    this.assert.strictEqual(
      html,
      content([
        OPEN,
        OPEN,
        '<div class="nav-container">',
        OPEN,
        OPEN,
        'Nav',
        CLOSE,
        CLOSE,
        '</div>',
        OPEN,
        '<h1>I am a test</h1>',
        CLOSE,
        '<div class="carousel-container">',
        OPEN,
        OPEN,
        'Carousel',
        CLOSE,
        CLOSE,
        '</div>',
        CLOSE,
        CLOSE,
      ])
    );

    replaceHTML(qunitFixture(), html);
    this.element = qunitFixture();

    // Rehydrate First Component
    this.renderResult = this.delegate.renderComponentClientSide(
      'Nav',
      args.nav,
      castToSimple(document.querySelector('.nav-container')!)
    );
    this.assertHTML(
      content([
        OPEN,
        OPEN,
        '<div class="nav-container">Nav</div>',
        OPEN,
        '<h1>I am a test</h1>',
        CLOSE,
        '<div class="carousel-container">',
        OPEN,
        OPEN,
        'Carousel',
        CLOSE,
        CLOSE,
        '</div>',
        CLOSE,
        CLOSE,
      ])
    );
    this.assert.ok(
      this.delegate.rehydrationStats.clearedNodes.length === 0,
      'No nodes were cleared'
    );
    this.assertStableNodes();
    this.assertStableRerender();

    // Rehydrate the second component
    this.renderResult = this.delegate.renderComponentClientSide(
      'Carousel',
      args.carousel,
      castToSimple(document.querySelector('.carousel-container')!)
    );
    this.assertHTML(
      content([
        OPEN,
        OPEN,
        '<div class="nav-container">Nav</div>',
        OPEN,
        '<h1>I am a test</h1>',
        CLOSE,
        '<div class="carousel-container">Carousel</div>',
        CLOSE,
        CLOSE,
      ])
    );
    this.assert.ok(
      this.delegate.rehydrationStats.clearedNodes.length === 0,
      'No nodes were cleared'
    );
    this.assertStableNodes();
    this.assertStableRerender();
  }
}

testSuite(PartialRehydrationTest, PartialRehydrationDelegate);
