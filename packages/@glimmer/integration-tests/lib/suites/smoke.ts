import { test } from '../test-decorator';
import { RenderTest } from '../render-test';

export class SmokeTests extends RenderTest {
  static suiteName = 'smoke test';

  @test
  'can create many blocks without overflowing'() {
    let input = '';
    let output = '';
    for (let i = 0; i < 10000; i++) {
      input +=
        '<div id="test">{{#if true}}Hello{{else}}Bye{{/if}}{{#if false}}Hello{{else}}Bye{{/if}}</div>';
      output += '<div id="test">HelloBye</div>';
    }

    this.render(input);
    this.assertHTML(output);
  }
}
