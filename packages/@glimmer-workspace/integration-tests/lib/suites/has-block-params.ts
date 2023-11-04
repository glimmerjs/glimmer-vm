import { matrix } from '@glimmer-workspace/integration-tests';

import { GlimmerishComponent } from '../components';

matrix('has-block-params', (spec) => {
  spec(
    { type: 'curly' },
    'parameterized has-block-params (subexpr, else) when else supplied without block params',
    (ctx) => {
      ctx.render.template({
        layout: '{{#if (has-block-params "inverse")}}Yes{{else}}No{{/if}}',
        template: 'block here',
        else: 'else here',
      });

      ctx.assertComponent('No');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'has-block-params from within a yielded + invoked curried component',
    (ctx) => {
      class TestHarness extends GlimmerishComponent {
        public Foo: any;
      }
      ctx.register.component('Glimmer', 'TestHarness', '{{yield (component "Foo")}}', TestHarness);
      ctx.register.component('Glimmer', 'Foo', '{{#if (has-block-params)}}Yes{{else}}No{{/if}}');

      ctx.render.template('<TestHarness as |Foo|>{{Foo}}</TestHarness>');

      ctx.assertHTML('No');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (subexpr, else) when else not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '{{#if (has-block-params "inverse")}}Yes{{else}}No{{/if}}',
        template: 'block here',
      });

      ctx.assertComponent('No');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (subexpr, default) when block supplied with block params',
    (ctx) => {
      ctx.render.template({
        layout: '{{#if (has-block-params)}}Yes{{else}}No{{/if}}',
        blockParams: ['param'],
        template: 'block here',
      });

      ctx.assertComponent('Yes');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (subexpr, default) when block supplied without block params',
    (ctx) => {
      ctx.render.template({
        layout: '{{#if (has-block-params)}}Yes{{else}}No{{/if}}',
        template: 'block here',
      });

      ctx.assertComponent('No');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (subexpr, default) when block not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '{{#if (has-block-params)}}Yes{{else}}No{{/if}}',
      });

      ctx.assertComponent('No');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (content, else) when else supplied without block params',
    (ctx) => {
      ctx.render.template({
        layout: '{{has-block-params "inverse"}}',
        template: 'block here',
        else: 'else here',
      });

      ctx.assertComponent('false');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (content, else) when else not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '{{has-block-params "inverse"}}',
        template: 'block here',
      });

      ctx.assertComponent('false');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (content, default) when block supplied with block params',
    (ctx) => {
      ctx.render.template({
        layout: '{{has-block-params}}',
        blockParams: ['param'],
        template: 'block here',
      });

      ctx.assertComponent('true');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (content, default) when block supplied without block params',
    (ctx) => {
      ctx.render.template({
        layout: '{{has-block-params}}',
        template: 'block here',
      });

      ctx.assertComponent('false');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (content, default) when block not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '{{has-block-params}}',
        template: 'block here',
      });

      ctx.assertComponent('false');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (prop, else) when else supplied without block params',
    (ctx) => {
      ctx.render.template({
        layout: '<button name={{has-block-params "inverse"}}></button>',
        template: 'block here',
        else: 'else here',
      });

      ctx.assertComponent('<button name="false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (prop, else) when else not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '<button name={{has-block-params "inverse"}}></button>',
        template: 'block here',
      });

      ctx.assertComponent('<button name="false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (prop, default) when block supplied with block params',
    (ctx) => {
      ctx.render.template({
        layout: '<button name={{has-block-params}}></button>',
        blockParams: ['param'],
        template: 'block here',
      });

      ctx.assertComponent('<button name="true"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (prop, default) when block supplied without block params',
    (ctx) => {
      ctx.render.template({
        layout: '<button name={{has-block-params}}></button>',
        template: 'block here',
      });

      ctx.assertComponent('<button name="false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (prop, default) when block not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '<button name={{has-block-params}}></button>',
      });

      ctx.assertComponent('<button name="false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (attr, else) when else supplied without block params',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block-params="{{has-block-params "inverse"}}"></button>',
        template: 'block here',
        else: 'else here',
      });

      ctx.assertComponent('<button data-has-block-params="false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (attr, else) when else not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block-params="{{has-block-params "inverse"}}"></button>',
        template: 'block here',
        else: 'else here',
      });

      ctx.assertComponent('<button data-has-block-params="false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (attr, default) when block supplied with block params',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block-params="{{has-block-params}}"></button>',
        blockParams: ['param'],
        template: 'block here',
      });

      ctx.assertComponent('<button data-has-block-params="true"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (attr, default) when block supplied without block params',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block-params="{{has-block-params}}"></button>',
        template: 'block here',
      });

      ctx.assertComponent('<button data-has-block-params="false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (attr, default) when block not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block-params="{{has-block-params}}"></button>',
        template: 'block here',
      });

      ctx.assertComponent('<button data-has-block-params="false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (concatted attr, else) when else supplied without block params',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block-params="is-{{has-block-params "inverse"}}"></button>',
        template: 'block here',
        else: 'else here',
      });

      ctx.assertComponent('<button data-has-block-params="is-false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (concatted attr, else) when else not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block-params="is-{{has-block-params "inverse"}}"></button>',
        template: 'block here',
      });

      ctx.assertComponent('<button data-has-block-params="is-false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (concatted attr, default) when block supplied with block params',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block-params="is-{{has-block-params}}"></button>',
        template: 'block here',
        blockParams: ['param'],
      });

      ctx.assertComponent('<button data-has-block-params="is-true"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (concatted attr, default) when block supplied without block params',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block-params="is-{{has-block-params}}"></button>',
        template: 'block here',
      });

      ctx.assertComponent('<button data-has-block-params="is-false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block-params (concatted attr, default) when block not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block-params="is-{{has-block-params}}"></button>',
      });

      ctx.assertComponent('<button data-has-block-params="is-false"></button>');
      ctx.assertStableRerender();
    }
  );
}).client();
