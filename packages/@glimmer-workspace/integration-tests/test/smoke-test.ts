import { jitSuite, RenderTest, test } from '..';

class SmokeTests extends RenderTest {
  static suiteName = 'Smoke Tests';

  @test
  'can create many blocks without overflowing'() {
    let input = '';
    let output = '';
    for (let index = 0; index < 10_000; index++) {
      input +=
        '<div id="test">{{#if true}}Hello{{else}}Bye{{/if}}{{#if false}}Hello{{else}}Bye{{/if}}</div>';
      output += '<div id="test">HelloBye</div>';
    }

    this.render(input);
    this.assertHTML(output);
  }
}

jitSuite(SmokeTests);
