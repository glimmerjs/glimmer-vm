import { RenderTest, test, jitSuite, syntaxErrorFor, defineComponent, trackedObj } from '../..';

class DynamicElementTest extends RenderTest {
  static suiteName = '{{element}} keyword';

  @test
  ['it works element']() {
    const AComponent = defineComponent({}, '{{#let (element "div") as |Tag|}}<Tag></Tag>{{/let}}');
    this.renderComponent(AComponent);

    this.assertHTML('<div></div>');
  }

  @test
  ['correctly renders when values update element']() {
    let args = trackedObj({ foo: 'span' });

    const AComponent = defineComponent({}, '{{element @foo}}');
    this.renderComponent(AComponent, args);

    this.assertHTML('<span></span>');

    args.foo = 'div';
    this.rerender({ foo: 'div' });

    this.assertHTML('<div></div>');
  }

  @test
  ['it errors']() {
    this.assert.throws(() => {
      const AComponent = defineComponent({}, '{{element "div" 1}}');
      this.renderComponent(AComponent);
    }, syntaxErrorFor('(element) only takes one positional argument - the element tag name', '{{element "div" 1}}', 'an unknown module', 1, 0));
  }
}

jitSuite(DynamicElementTest);
