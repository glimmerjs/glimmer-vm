import { jitSuite, RenderTest, test } from '@glimmer-workspace/integration-tests';
import * as prettier from 'prettier';

/**
 * See: https://github.com/glimmerjs/glimmer-vm/issues/1688
 */
class PrettierSuite extends RenderTest {
  static suiteName = 'Prettier';

  @test
  async 'Underlynig preprocess API works'() {
    let result = (await import('@glimmer/syntax')).preprocess('<h1></h1>');

    this.assert.ok(result, `It can be await import()'d, and doesn't error`);
  }

  /**
   * Requires the root package.json#pnpm#overrides point at our internal
   * copy of @glimmer/syntax, or else prettier brings its own already published
   * copy of @glimmer/syntax
   */
  @test
  async 'Prettier can call preprocess'() {
    let result = await prettier.format(`     <div>\n</div>`, { parser: 'glimmer' });

    this.assert.strictEqual(result, '');
  }
}

jitSuite(PrettierSuite);
