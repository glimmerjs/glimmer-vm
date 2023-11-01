import { RenderTest } from '../render-test';
import { render } from '../test-decorator';

export class HasBlockSuite extends RenderTest {
  static suiteName = 'has-block';

  @render('curly')
  'parameterized has-block (subexpr, else) when else supplied'() {
    this.render.template({
      layout: '{{#if (has-block "inverse")}}Yes{{else}}No{{/if}}',
      template: 'block here',
      else: 'else here',
    });

    this.assertComponent('Yes');
    this.assertStableRerender();
  }

  @render
  'parameterized has-block (subexpr, else) when else not supplied'() {
    this.render.template({
      layout: '{{#if (has-block "inverse")}}Yes{{else}}No{{/if}}',
      template: 'block here',
    });

    this.assertComponent('No');
    this.assertStableRerender();
  }

  @render
  'parameterized has-block (subexpr, default) when block supplied'() {
    this.render.template({
      layout: '{{#if (has-block)}}Yes{{else}}No{{/if}}',
      template: 'block here',
    });

    this.assertComponent('Yes');
    this.assertStableRerender();
  }

  @render('curly')
  'parameterized has-block (subexpr, default) when block not supplied'() {
    this.render.template({
      layout: '{{#if (has-block)}}Yes{{else}}No{{/if}}',
    });

    this.assertComponent('No');
    this.assertStableRerender();
  }

  @render('curly')
  'parameterized has-block (content, else) when else supplied'() {
    this.render.template({
      layout: '{{has-block "inverse"}}',
      template: 'block here',
      else: 'else here',
    });

    this.assertComponent('true');
    this.assertStableRerender();
  }

  @render
  'parameterized has-block (content, else) when else not supplied'() {
    this.render.template({
      layout: '{{has-block "inverse"}}',
      template: 'block here',
    });

    this.assertComponent('false');
    this.assertStableRerender();
  }

  @render
  'parameterized has-block (content, default) when block supplied'() {
    this.render.template({
      layout: '{{has-block}}',
      template: 'block here',
    });

    this.assertComponent('true');
    this.assertStableRerender();
  }

  @render('curly')
  'parameterized has-block (content, default) when block not supplied'() {
    this.render.template({
      layout: '{{has-block}}',
    });

    this.assertComponent('false');
    this.assertStableRerender();
  }

  @render('curly')
  'parameterized has-block (prop, else) when else supplied'() {
    this.render.template({
      layout: '<button name={{has-block "inverse"}}></button>',
      template: 'block here',
      else: 'else here',
    });

    this.assertComponent('<button name="true"></button>');
    this.assertStableRerender();
  }

  @render
  'parameterized has-block (prop, else) when else not supplied'() {
    this.render.template({
      layout: '<button name={{has-block "inverse"}}></button>',
      template: 'block here',
    });

    this.assertComponent('<button name="false"></button>');
    this.assertStableRerender();
  }

  @render
  'parameterized has-block (prop, default) when block supplied'() {
    this.render.template({
      layout: '<button name={{has-block}}></button>',
      template: 'block here',
    });

    this.assertComponent('<button name="true"></button>');
    this.assertStableRerender();
  }

  @render('curly')
  'parameterized has-block (prop, default) when block not supplied'() {
    this.render.template({
      layout: '<button name={{has-block}}></button>',
    });

    this.assertComponent('<button name="false"></button>');
    this.assertStableRerender();
  }

  @render('curly')
  'has-block works when used directly as an argument without extra parens (prop, default)'() {
    this.register.component('TemplateOnly', 'Foo', '{{@hasBlock}}');

    this.render.template({
      layout: '<Foo @hasBlock={{has-block}}></Foo>',
    });

    this.assertComponent('false');
    this.assertStableRerender();
  }

  @render('curly')
  'parameterized has-block (attr, else) when else supplied'() {
    this.render.template({
      layout: '<button data-has-block="{{has-block "inverse"}}"></button>',
      template: 'block here',
      else: 'else here',
    });

    this.assertComponent('<button data-has-block="true"></button>');
    this.assertStableRerender();
  }

  @render
  'parameterized has-block (attr, else) when else not supplied'() {
    this.render.template({
      layout: '<button data-has-block="{{has-block "inverse"}}"></button>',
      template: 'block here',
    });

    this.assertComponent('<button data-has-block="false"></button>');
    this.assertStableRerender();
  }

  @render
  'parameterized has-block (attr, default) when block supplied'() {
    this.render.template({
      layout: '<button data-has-block="{{has-block}}"></button>',
      template: 'block here',
    });

    this.assertComponent('<button data-has-block="true"></button>');
    this.assertStableRerender();
  }

  @render('curly')
  'parameterized has-block (attr, default) when block not supplied'() {
    this.render.template({
      layout: '<button data-has-block="{{has-block}}"></button>',
    });

    this.assertComponent('<button data-has-block="false"></button>');
    this.assertStableRerender();
  }

  @render('curly')
  'parameterized has-block (concatted attr, else) when else supplied'() {
    this.render.template({
      layout: '<button data-has-block="is-{{has-block "inverse"}}"></button>',
      template: 'block here',
      else: 'else here',
    });

    this.assertComponent('<button data-has-block="is-true"></button>');
    this.assertStableRerender();
  }

  @render
  'parameterized has-block (concatted attr, else) when else not supplied'() {
    this.render.template({
      layout: '<button data-has-block="is-{{has-block "inverse"}}"></button>',
      template: 'block here',
    });

    this.assertComponent('<button data-has-block="is-false"></button>');
    this.assertStableRerender();
  }

  @render
  'parameterized has-block (concatted attr, default) when block supplied'() {
    this.render.template({
      layout: '<button data-has-block="is-{{has-block}}"></button>',
      template: 'block here',
    });

    this.assertComponent('<button data-has-block="is-true"></button>');
    this.assertStableRerender();
  }

  @render('curly')
  'parameterized has-block (concatted attr, default) when block not supplied'() {
    this.render.template({
      layout: '<button data-has-block="is-{{has-block}}"></button>',
    });

    this.assertComponent('<button data-has-block="is-false"></button>');
    this.assertStableRerender();
  }

  @render('glimmer')
  'self closing angle bracket invocation (subexpr, default)'() {
    this.register.component(
      'Glimmer',
      'TestComponent',
      `<div ...attributes>{{#if (has-block)}}Yes{{else}}No{{/if}}</div>`
    );
    this.render.template(`<TestComponent />`);

    this.assertComponent('No');
    this.assertStableRerender();
  }

  @render('glimmer')
  'self closing angle bracket invocation (subexpr, else)'() {
    this.register.component(
      'Glimmer',
      'TestComponent',
      `<div ...attributes>{{#if (has-block 'inverse')}}Yes{{else}}No{{/if}}</div>`
    );
    this.render.template(`<TestComponent />`);

    this.assertComponent('No');
    this.assertStableRerender();
  }

  @render('glimmer')
  'self closing angle bracket invocation (concatted attr, default)'() {
    this.register.component(
      'Glimmer',
      'TestComponent',
      `<div data-has-block="{{has-block}}" ...attributes></div>`
    );
    this.render.template(`<TestComponent />`);

    this.assertComponent('', { 'data-has-block': 'false' });
    this.assertStableRerender();
  }

  @render('glimmer')
  'has-block works within a yielded curried component invoked within mustaches'() {
    this.register.component(
      'Glimmer',
      'ComponentWithHasBlock',
      `<div data-has-block="{{has-block}}" ...attributes></div>`
    );

    this.register.component('Glimmer', 'Yielder', `{{yield (component 'ComponentWithHasBlock')}}`);

    this.register.component(
      'Glimmer',
      'TestComponent',
      `<Yielder as |componentWithHasBlock|>{{componentWithHasBlock}}</Yielder>`
    );

    this.render.template(`<TestComponent />`);

    this.assertComponent('', { 'data-has-block': 'false' });
    this.assertStableRerender();
  }

  @render('glimmer')
  'has-block works within a yielded curried component invoked with angle bracket invocation (falsy)'() {
    this.register.component(
      'Glimmer',
      'ComponentWithHasBlock',
      `<div data-has-block="{{has-block}}" ...attributes></div>`
    );

    this.register.component('Glimmer', 'Yielder', `{{yield (component 'ComponentWithHasBlock')}}`);

    this.register.component(
      'Glimmer',
      'TestComponent',
      `<Yielder as |componentWithHasBlock|><componentWithHasBlock/></Yielder>`
    );

    this.render.template(`<TestComponent />`);

    this.assertComponent('', { 'data-has-block': 'false' });
    this.assertStableRerender();
  }

  @render('glimmer')
  'has-block works within a yielded curried component invoked with angle bracket invocation (truthy)'() {
    this.register.component(
      'Glimmer',
      'ComponentWithHasBlock',
      `<div data-has-block="{{has-block}}" ...attributes></div>`
    );

    this.register.component('Glimmer', 'Yielder', `{{yield (component 'ComponentWithHasBlock')}}`);

    this.register.component(
      'Glimmer',
      'TestComponent',
      `<Yielder as |componentWithHasBlock|><componentWithHasBlock></componentWithHasBlock></Yielder>`
    );

    this.render.template(`<TestComponent />`);

    this.assertComponent('', { 'data-has-block': 'true' });
    this.assertStableRerender();
  }
}
