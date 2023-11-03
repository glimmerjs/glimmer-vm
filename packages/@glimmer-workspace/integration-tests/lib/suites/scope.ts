import { RenderTestContext } from '../render-test';
import { render } from '../test-decorator';
import { stripTight } from '../test-helpers/strings';

export class ScopeSuite extends RenderTestContext {
  static suiteName = 'Scope';

  @render
  'correct scope - conflicting local names'() {
    this.render.template({
      layout: stripTight`
        {{#with @a as |item|}}{{@a}}: {{item}},
          {{#with @b as |item|}} {{@b}}: {{item}},
            {{#with @c as |item|}} {{@c}}: {{item}}{{/with}}
          {{/with}}
        {{/with}}`,
      args: { a: '"A"', b: '"B"', c: '"C"' },
    });

    this.assertComponent('A: A, B: B, C: C');
    this.assertStableRerender();
  }

  @render
  'correct scope - conflicting block param and attr names'() {
    this.render.template({
      layout:
        'Outer: {{@conflict}} {{#with @item as |conflict|}}Inner: {{@conflict}} Block: {{conflict}}{{/with}}',
      args: { item: '"from block"', conflict: '"from attr"' },
    });

    this.assertComponent('Outer: from attr Inner: from attr Block: from block');
    this.assertStableRerender();
  }
}
