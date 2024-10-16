import { modifierCapabilities, setModifierManager } from '@glimmer/manager';
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

  @test 'Should be able to lazily initialize with a modifier'() {
    const modifier = (callback: () => unknown) => {
      setModifierManager(
        () => ({
          capabilities: modifierCapabilities('3.22'),
          createModifier() {},
          installModifier() {
            callback();
          },
          updateModifier() {},
          destroyModifier() {},
        }),
        callback
      );

      return callback;
    };

    class Thing extends GlimmerishComponent {
      @tracked something: string | null = null;

      thing = modifier(() => {
        if (!this.something) {
          this.something = 'something';
        }
      });
    }

    this.registerComponent(
      'Glimmer',
      'HelloWorld',
      `
<div {{this.thing}}>
  {{this.something}}
</div>
`,
      Thing
    );

    this.render(`<HelloWorld />`);

    this.assertHTML(`<div>something</div>`);
  }
}

suite(LazyInitializationTest, JitRenderDelegate, {
  env: assign({}, BaseEnv, {
    enableDebugTooling: false,
  }),
});
