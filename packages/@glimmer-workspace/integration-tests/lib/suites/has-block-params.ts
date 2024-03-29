import { GlimmerishComponent } from '../components';
import { RenderTest } from '../render-test';
import { test } from '../test-decorator';

export class HasBlockParamsHelperSuite extends RenderTest {
  static suiteName = 'has-block-params';

  @test({ kind: 'curly' })
  'parameterized has-block-params (subexpr, else) when else supplied without block params'() {
    this.render({
      layout: '{{#if (has-block-params "inverse")}}Yes{{else}}No{{/if}}',
      template: 'block here',
      else: 'else here',
    });

    this.assertComponent('No');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'has-block-params from within a yielded + invoked curried component'() {
    class TestHarness extends GlimmerishComponent {
      public Foo: any;
    }
    this.registerComponent('Glimmer', 'TestHarness', '{{yield (component "Foo")}}', TestHarness);
    this.registerComponent('Glimmer', 'Foo', '{{#if (has-block-params)}}Yes{{else}}No{{/if}}');

    this.render('<TestHarness as |Foo|>{{Foo}}</TestHarness>');

    this.assertHTML('No');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (subexpr, else) when else not supplied'() {
    this.render({
      layout: '{{#if (has-block-params "inverse")}}Yes{{else}}No{{/if}}',
      template: 'block here',
    });

    this.assertComponent('No');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (subexpr, default) when block supplied with block params'() {
    this.render({
      layout: '{{#if (has-block-params)}}Yes{{else}}No{{/if}}',
      blockParams: ['param'],
      template: 'block here',
    });

    this.assertComponent('Yes');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (subexpr, default) when block supplied without block params'() {
    this.render({
      layout: '{{#if (has-block-params)}}Yes{{else}}No{{/if}}',
      template: 'block here',
    });

    this.assertComponent('No');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (subexpr, default) when block not supplied'() {
    this.render({
      layout: '{{#if (has-block-params)}}Yes{{else}}No{{/if}}',
    });

    this.assertComponent('No');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (content, else) when else supplied without block params'() {
    this.render({
      layout: '{{has-block-params "inverse"}}',
      template: 'block here',
      else: 'else here',
    });

    this.assertComponent('false');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (content, else) when else not supplied'() {
    this.render({
      layout: '{{has-block-params "inverse"}}',
      template: 'block here',
    });

    this.assertComponent('false');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (content, default) when block supplied with block params'() {
    this.render({
      layout: '{{has-block-params}}',
      blockParams: ['param'],
      template: 'block here',
    });

    this.assertComponent('true');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (content, default) when block supplied without block params'() {
    this.render({
      layout: '{{has-block-params}}',
      template: 'block here',
    });

    this.assertComponent('false');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (content, default) when block not supplied'() {
    this.render({
      layout: '{{has-block-params}}',
      template: 'block here',
    });

    this.assertComponent('false');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (prop, else) when else supplied without block params'() {
    this.render({
      layout: '<button name={{has-block-params "inverse"}}></button>',
      template: 'block here',
      else: 'else here',
    });

    this.assertComponent('<button name="false"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (prop, else) when else not supplied'() {
    this.render({
      layout: '<button name={{has-block-params "inverse"}}></button>',
      template: 'block here',
    });

    this.assertComponent('<button name="false"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (prop, default) when block supplied with block params'() {
    this.render({
      layout: '<button name={{has-block-params}}></button>',
      blockParams: ['param'],
      template: 'block here',
    });

    this.assertComponent('<button name="true"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (prop, default) when block supplied without block params'() {
    this.render({
      layout: '<button name={{has-block-params}}></button>',
      template: 'block here',
    });

    this.assertComponent('<button name="false"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (prop, default) when block not supplied'() {
    this.render({
      layout: '<button name={{has-block-params}}></button>',
    });

    this.assertComponent('<button name="false"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (attr, else) when else supplied without block params'() {
    this.render({
      layout: '<button data-has-block-params="{{has-block-params "inverse"}}"></button>',
      template: 'block here',
      else: 'else here',
    });

    this.assertComponent('<button data-has-block-params="false"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (attr, else) when else not supplied'() {
    this.render({
      layout: '<button data-has-block-params="{{has-block-params "inverse"}}"></button>',
      template: 'block here',
      else: 'else here',
    });

    this.assertComponent('<button data-has-block-params="false"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (attr, default) when block supplied with block params'() {
    this.render({
      layout: '<button data-has-block-params="{{has-block-params}}"></button>',
      blockParams: ['param'],
      template: 'block here',
    });

    this.assertComponent('<button data-has-block-params="true"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (attr, default) when block supplied without block params'() {
    this.render({
      layout: '<button data-has-block-params="{{has-block-params}}"></button>',
      template: 'block here',
    });

    this.assertComponent('<button data-has-block-params="false"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (attr, default) when block not supplied'() {
    this.render({
      layout: '<button data-has-block-params="{{has-block-params}}"></button>',
      template: 'block here',
    });

    this.assertComponent('<button data-has-block-params="false"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (concatted attr, else) when else supplied without block params'() {
    this.render({
      layout: '<button data-has-block-params="is-{{has-block-params "inverse"}}"></button>',
      template: 'block here',
      else: 'else here',
    });

    this.assertComponent('<button data-has-block-params="is-false"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (concatted attr, else) when else not supplied'() {
    this.render({
      layout: '<button data-has-block-params="is-{{has-block-params "inverse"}}"></button>',
      template: 'block here',
    });

    this.assertComponent('<button data-has-block-params="is-false"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (concatted attr, default) when block supplied with block params'() {
    this.render({
      layout: '<button data-has-block-params="is-{{has-block-params}}"></button>',
      template: 'block here',
      blockParams: ['param'],
    });

    this.assertComponent('<button data-has-block-params="is-true"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (concatted attr, default) when block supplied without block params'() {
    this.render({
      layout: '<button data-has-block-params="is-{{has-block-params}}"></button>',
      template: 'block here',
    });

    this.assertComponent('<button data-has-block-params="is-false"></button>');
    this.assertStableRerender();
  }

  @test({ kind: 'curly' })
  'parameterized has-block-params (concatted attr, default) when block not supplied'() {
    this.render({
      layout: '<button data-has-block-params="is-{{has-block-params}}"></button>',
    });

    this.assertComponent('<button data-has-block-params="is-false"></button>');
    this.assertStableRerender();
  }
}
