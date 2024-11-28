import { defineComponent, jitSuite, RenderTest, test } from '../..';

class MathElementTest extends RenderTest {
  static suiteName = '<math>';

  @test
  '<math> element can render'() {
    const Bar = defineComponent({}, '<math><msqrt><mi>x</mi></msqrt></math>');

    this.renderComponent(Bar);

    let el = (s: string) => (this.element as unknown as HTMLElement).querySelector(s);

    this.assert.strictEqual(el('math')?.namespaceURI, 'http://www.w3.org/1998/Math/MathML');
    this.assert.strictEqual(el('msqrt')?.namespaceURI, 'http://www.w3.org/1998/Math/MathML');
    this.assert.strictEqual(el('mi')?.namespaceURI, 'http://www.w3.org/1998/Math/MathML');
  }
}

jitSuite(MathElementTest);
