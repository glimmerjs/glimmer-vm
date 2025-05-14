import { consumeTag, createUpdatableTag, dirtyTag } from '@glimmer/validator';
import {
  defineComponent,
  jitSuite,
  RenderTest,
  test,
  tracked,
} from '@glimmer-workspace/integration-tests';

class Each extends RenderTest {
  static suiteName = '{{#each}} keyword';

  @test
  'each with undefined item https://github.com/emberjs/ember.js/issues/20786'() {
    class State {
      @tracked data = [undefined];
    }

    let state = new State();

    const Bar = defineComponent(
      { state },
      `{{#each state.data key='anything' as |datum|}}
        {{datum}}
       {{/each}}`
        .replaceAll(/^\s|\s+$|\s+(?=\s)/gu, '')
        .replaceAll(/\n/gu, '')
    );

    this.renderComponent(Bar);

    this.assertHTML('  ');
  }

  @test
  'each with array of tags is reactive per item'(assert: Assert) {
    let array = [createUpdatableTag(), createUpdatableTag()];
    let step = (index: number) => {
      consumeTag(array[index]);
      assert.step(String(index));
      return index;
    };

    const Foo = defineComponent(
      { step, array },
      `{{#each array as |item index|}}
        {{step index}}
       {{/each}}`
        .replaceAll(/^\s|\s+$|\s+(?=\s)/gu, '')
        .replaceAll(/\n/gu, '')
    );

    this.renderComponent(Foo);
    this.assertHTML(' 0  1 ');
    assert.verifySteps(['0', '1']);

    dirtyTag(array[0]!);
    this.rerender();
    this.assertHTML(' 0  1 ');
    assert.verifySteps(['0']);

    dirtyTag(array[1]!);
    this.rerender();
    this.assertHTML(' 0  1 ');
    assert.verifySteps(['1']);
  }
}

jitSuite(Each);
