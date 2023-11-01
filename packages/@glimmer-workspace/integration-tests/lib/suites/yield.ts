import { RenderTest } from '../render-test';
import { render, suite } from '../test-decorator';

@suite('yield')
export class YieldSuite extends RenderTest {
  @render
  yield() {
    this.render.template(
      {
        layout:
          '{{#if @predicate}}Yes:{{yield @someValue}}{{else}}No:{{yield to="inverse"}}{{/if}}',
        args: { predicate: 'this.activated', someValue: '42' },
        blockParams: ['result'],
        template: 'Hello{{result}}{{this.outer}}',
        else: 'Goodbye{{this.outer}}',
      },
      { activated: true, outer: 'outer' }
    );

    this.assertComponent('Yes:Hello42outer');
    this.assertStableRerender();
  }

  @render
  'yield to "inverse"'() {
    this.render.template(
      {
        layout:
          '{{#if @predicate}}Yes:{{yield @someValue}}{{else}}No:{{yield to="inverse"}}{{/if}}',
        args: { predicate: 'this.activated', someValue: '42' },
        blockParams: ['result'],
        template: 'Hello{{result}}{{this.outer}}',
        else: 'Goodbye{{this.outer}}',
      },
      { activated: false, outer: 'outer' }
    );

    this.assertComponent('No:Goodbyeouter');
    this.assertStableRerender();
  }

  @render
  'yield to "else"'() {
    this.render.template(
      {
        layout: '{{#if @predicate}}Yes:{{yield @someValue}}{{else}}No:{{yield to="else"}}{{/if}}',
        args: { predicate: 'this.activated', someValue: '42' },
        blockParams: ['result'],
        template: 'Hello{{result}}{{this.outer}}',
        else: 'Goodbye{{this.outer}}',
      },
      { activated: false, outer: 'outer' }
    );

    this.assertComponent('No:Goodbyeouter');
    this.assertStableRerender();
  }

  @render
  'yielding to an non-existent block'() {
    this.render.template({
      layout: 'Before-{{yield}}-After',
    });

    this.assertComponent('Before--After');
    this.assertStableRerender();
  }

  @render
  'yielding a string and rendering its length'() {
    this.render.template({
      layout: `{{yield "foo"}}-{{yield ""}}`,
      blockParams: ['yielded'],
      template: '{{yielded}}-{{yielded.length}}',
    });

    this.assertComponent(`foo-3--0`);
    this.assertStableRerender();
  }

  @render
  'use a non-existent block param'() {
    this.render.template({
      layout: '{{yield @someValue}}',
      args: { someValue: '42' },
      blockParams: ['val1', 'val2'],
      template: '{{val1}} - {{val2}}',
    });

    this.assertComponent('42 - ');
    this.assertStableRerender();
  }

  @render
  'block without properties'() {
    this.render.template({
      layout: 'In layout -- {{yield}}',
      template: 'In template',
    });

    this.assertComponent('In layout -- In template');
    this.assertStableRerender();
  }

  @render
  'yielding true'() {
    this.render.template({
      layout: `{{yield true}}`,
      blockParams: ['yielded'],
      template: '{{yielded}}-{{yielded.foo.bar}}',
    });

    this.assertComponent(`true-`);
    this.assertStableRerender();
  }

  @render
  'yielding false'() {
    this.render.template({
      layout: `{{yield false}}`,
      blockParams: ['yielded'],
      template: '{{yielded}}-{{yielded.foo.bar}}',
    });

    this.assertComponent(`false-`);
    this.assertStableRerender();
  }

  @render
  'yielding null'() {
    this.render.template({
      layout: `{{yield null}}`,
      blockParams: ['yielded'],
      template: '{{yielded}}-{{yielded.foo.bar}}',
    });

    this.assertComponent(`-`);
    this.assertStableRerender();
  }

  @render
  'yielding undefined'() {
    this.render.template({
      layout: `{{yield undefined}}`,
      blockParams: ['yielded'],
      template: '{{yielded}}-{{yielded.foo.bar}}',
    });

    this.assertComponent(`-`);
    this.assertStableRerender();
  }

  @render
  'yielding integers'() {
    this.render.template({
      layout: `{{yield 123}}`,
      blockParams: ['yielded'],
      template: '{{yielded}}-{{yielded.foo.bar}}',
    });

    this.assertComponent(`123-`);
    this.assertStableRerender();
  }

  @render
  'yielding floats'() {
    this.render.template({
      layout: `{{yield 123.45}}`,
      blockParams: ['yielded'],
      template: '{{yielded}}-{{yielded.foo.bar}}',
    });

    this.assertComponent(`123.45-`);
    this.assertStableRerender();
  }

  @render
  'yielding strings'() {
    this.render.template({
      layout: `{{yield "hello"}}`,
      blockParams: ['yielded'],
      template: '{{yielded}}-{{yielded.foo.bar}}',
    });

    this.assertComponent(`hello-`);
    this.assertStableRerender();
  }

  @render
  'yield inside a conditional on the component'() {
    this.render.template(
      {
        layout: 'In layout -- {{#if @predicate}}{{yield}}{{/if}}',
        template: 'In template',
        args: { predicate: 'this.predicate' },
      },
      { predicate: true }
    );

    this.assertComponent('In layout -- In template', {});
    this.assertStableRerender();

    this.rerender({ predicate: false });
    this.assertComponent('In layout -- <!---->');
    this.assertStableNodes();

    this.rerender({ predicate: true });
    this.assertComponent('In layout -- In template');
    this.assertStableNodes();
  }
}
