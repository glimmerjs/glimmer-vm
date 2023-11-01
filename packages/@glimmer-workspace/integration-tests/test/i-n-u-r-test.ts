import { castToSimple } from '@glimmer/util';

import { JitRenderDelegate } from '../lib/modes/jit/delegate';
import { RenderTest } from '../lib/render-test';
import { RenderTestContext } from '../lib/test-helpers/module';
import { module } from './support';

// "I-N-U-R" cycle
// initial render -> no-op rerender -> update(s) via mutation(s) -> reset via replacement
module('Render Tests: I-N-U-R', ({ test }) => {
  let doc = castToSimple(document);

  test('Can take basic snapshots', (assert) => {
    let div = doc.createElement('div');
    let text = doc.createTextNode('Foo');
    div.appendChild(text);

    new (class extends RenderTest {
      override element = div;
      constructor(...args: ConstructorParameters<typeof RenderTest>) {
        super(...args);
        let snapShot = this.takeSnapshot();
        assert.deepEqual(snapShot, [text, 'up']);
      }
    })(new JitRenderDelegate(), RenderTestContext(assert, 'glimmer'));
  });

  test('Can take nested snapshots', (assert) => {
    let div = doc.createElement('div');
    let p = doc.createElement('p');
    let text = doc.createTextNode('Foo');
    p.appendChild(text);
    div.appendChild(p);

    new (class extends RenderTest {
      override element = div;
      constructor(...args: ConstructorParameters<typeof RenderTest>) {
        super(...args);
        let snapShot = this.takeSnapshot();
        assert.deepEqual(snapShot, [p, 'down', text, 'up', 'up']);
      }
    })(new JitRenderDelegate(), RenderTestContext(assert, 'glimmer'));
  });

  test('Can take nested snapshots of serialized blocks', (assert) => {
    let div = doc.createElement('div');
    let open = doc.createComment('<!--%+b:0%-->');
    let text = doc.createTextNode('Foo');
    let close = doc.createComment('<!--%-b:0%-->');
    div.appendChild(open);
    div.appendChild(text);
    div.appendChild(close);

    new (class extends RenderTest {
      override element = div;
      constructor(...args: ConstructorParameters<typeof RenderTest>) {
        super(...args);
        let snapShot = this.takeSnapshot();
        assert.deepEqual(snapShot, [open, text, close, 'up']);
      }
    })(new JitRenderDelegate(), RenderTestContext(assert, 'glimmer'));
  });
});
