import { assign } from '@glimmer/util';
import {
  BaseEnv,
  GlimmerishComponent,
  JitRenderDelegate,
  RenderTest,
  suite,
  test,
  tracked,
} from '..';

class LazyInitializationTest extends RenderTest {
  static suiteName = 'Application test: lazy initialization';

  @test 'Should be able to lazily initialize a tracked property'() {
    class X extends GlimmerishComponent {
      @tracked _counts: number | undefined = undefined;

      get counts() {
        if (this._counts === undefined) {
          this._counts = 0;
        }

        return this._counts;
      }

      increment = () => this._counts!++;
    }
    this.registerComponent(
      'Glimmer',
      'HelloWorld',
      `
      {{this._counts}}
      {{this.counts}}
    `,
      X
    );

    this.render(`<HelloWorld />`);

    this.assertHTML(`0 0`);
  }
}

suite(LazyInitializationTest, JitRenderDelegate, {
  env: assign({}, BaseEnv, {
    enableDebugTooling: false,
  }),
});
