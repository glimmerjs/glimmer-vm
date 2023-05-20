import { castToSimple } from '@glimmer/util';

import { JitRenderDelegate, RenderTest } from '..';
import { module } from './support';

// "I-N-U-R" cycle
// initial render -> no-op rerender -> update(s) via mutation(s) -> reset via replacement
module('Render Tests: I-N-U-R', ({ test }) => {
  let document_ = castToSimple(document);

   
  test('Can set properties', (assert) => {
    new (class extends RenderTest {
      constructor(delegate: JitRenderDelegate) {
        super(delegate);
        this.setProperties({ foo: 'bar' });
        assert.strictEqual(this.context['foo'], 'bar');
      }
    })(new JitRenderDelegate());
  });

   
  test('Can take basic snapshots', (assert) => {
    let div = document_.createElement('div');
    let text = document_.createTextNode('Foo');
    div.append(text);

    new (class extends RenderTest {
      override element = div;
      constructor(delegate: JitRenderDelegate) {
        super(delegate);
        let snapShot = this.takeSnapshot();
        assert.deepEqual(snapShot, [text, 'up']);
      }
    })(new JitRenderDelegate());
  });

   
  test('Can take nested snapshots', (assert) => {
    let div = document_.createElement('div');
    let p = document_.createElement('p');
    let text = document_.createTextNode('Foo');
    p.append(text);
    div.append(p);

    new (class extends RenderTest {
      override element = div;
      constructor(delegate: JitRenderDelegate) {
        super(delegate);
        let snapShot = this.takeSnapshot();
        assert.deepEqual(snapShot, [p, 'down', text, 'up', 'up']);
      }
    })(new JitRenderDelegate());
  });

   
  test('Can take nested snapshots of serialized blocks', (assert) => {
    let div = document_.createElement('div');
    let open = document_.createComment('<!--%+b:0%-->');
    let text = document_.createTextNode('Foo');
    let close = document_.createComment('<!--%-b:0%-->');
    div.append(open);
    div.append(text);
    div.append(close);

    new (class extends RenderTest {
      override element = div;
      constructor(delegate: JitRenderDelegate) {
        super(delegate);
        let snapShot = this.takeSnapshot();
        assert.deepEqual(snapShot, [open, text, close, 'up']);
      }
    })(new JitRenderDelegate());
  });
});
