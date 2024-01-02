import { matrix } from '@glimmer-workspace/integration-tests';

matrix('has-block', (spec) => {
  spec({ type: 'curly' }, 'parameterized has-block (subexpr, else) when else supplied', (ctx) => {
    ctx.render.template({
      layout: '{{#if (has-block "inverse")}}Yes{{else}}No{{/if}}',
      template: 'block here',
      else: 'else here',
    });

    ctx.assertComponent('Yes');
    ctx.assertStableRerender();
  });

  spec('parameterized has-block (subexpr, else) when else not supplied', (ctx) => {
    ctx.render.template({
      layout: '{{#if (has-block "inverse")}}Yes{{else}}No{{/if}}',
      template: 'block here',
    });

    ctx.assertComponent('No');
    ctx.assertStableRerender();
  });

  spec('parameterized has-block (subexpr, default) when block supplied', (ctx) => {
    ctx.render.template({
      layout: '{{#if (has-block)}}Yes{{else}}No{{/if}}',
      template: 'block here',
    });

    ctx.assertComponent('Yes');
    ctx.assertStableRerender();
  });

  spec(
    { type: 'curly' },
    'parameterized has-block (subexpr, default) when block not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '{{#if (has-block)}}Yes{{else}}No{{/if}}',
      });

      ctx.assertComponent('No');
      ctx.assertStableRerender();
    }
  );

  spec({ type: 'curly' }, 'parameterized has-block (content, else) when else supplied', (ctx) => {
    ctx.render.template({
      layout: '{{has-block "inverse"}}',
      template: 'block here',
      else: 'else here',
    });

    ctx.assertComponent('true');
    ctx.assertStableRerender();
  });

  spec('parameterized has-block (content, else) when else not supplied', (ctx) => {
    ctx.render.template({
      layout: '{{has-block "inverse"}}',
      template: 'block here',
    });

    ctx.assertComponent('false');
    ctx.assertStableRerender();
  });

  spec('parameterized has-block (content, default) when block supplied', (ctx) => {
    ctx.render.template({
      layout: '{{has-block}}',
      template: 'block here',
    });

    ctx.assertComponent('true');
    ctx.assertStableRerender();
  });

  spec(
    { type: 'curly' },
    'parameterized has-block (content, default) when block not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '{{has-block}}',
      });

      ctx.assertComponent('false');
      ctx.assertStableRerender();
    }
  );

  spec({ type: 'curly' }, 'parameterized has-block (prop, else) when else supplied', (ctx) => {
    ctx.render.template({
      layout: '<button name={{has-block "inverse"}}></button>',
      template: 'block here',
      else: 'else here',
    });

    ctx.assertComponent('<button name="true"></button>');
    ctx.assertStableRerender();
  });

  spec('parameterized has-block (prop, else) when else not supplied', (ctx) => {
    ctx.render.template({
      layout: '<button name={{has-block "inverse"}}></button>',
      template: 'block here',
    });

    ctx.assertComponent('<button name="false"></button>');
    ctx.assertStableRerender();
  });

  spec('parameterized has-block (prop, default) when block supplied', (ctx) => {
    ctx.render.template({
      layout: '<button name={{has-block}}></button>',
      template: 'block here',
    });

    ctx.assertComponent('<button name="true"></button>');
    ctx.assertStableRerender();
  });

  spec(
    { type: 'curly' },
    'parameterized has-block (prop, default) when block not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '<button name={{has-block}}></button>',
      });

      ctx.assertComponent('<button name="false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'has-block works when used directly as an argument without extra parens (prop, default)',
    (ctx) => {
      ctx.register.component('TemplateOnly', 'Foo', '{{@hasBlock}}');

      ctx.render.template({
        layout: '<Foo @hasBlock={{has-block}}></Foo>',
      });

      ctx.assertComponent('false');
      ctx.assertStableRerender();
    }
  );

  spec({ type: 'curly' }, 'parameterized has-block (attr, else) when else supplied', (ctx) => {
    ctx.render.template({
      layout: '<button data-has-block="{{has-block "inverse"}}"></button>',
      template: 'block here',
      else: 'else here',
    });

    ctx.assertComponent('<button data-has-block="true"></button>');
    ctx.assertStableRerender();
  });

  spec('parameterized has-block (attr, else) when else not supplied', (ctx) => {
    ctx.render.template({
      layout: '<button data-has-block="{{has-block "inverse"}}"></button>',
      template: 'block here',
    });

    ctx.assertComponent('<button data-has-block="false"></button>');
    ctx.assertStableRerender();
  });

  spec('parameterized has-block (attr, default) when block supplied', (ctx) => {
    ctx.render.template({
      layout: '<button data-has-block="{{has-block}}"></button>',
      template: 'block here',
    });

    ctx.assertComponent('<button data-has-block="true"></button>');
    ctx.assertStableRerender();
  });

  spec(
    { type: 'curly' },
    'parameterized has-block (attr, default) when block not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block="{{has-block}}"></button>',
      });

      ctx.assertComponent('<button data-has-block="false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'curly' },
    'parameterized has-block (concatted attr, else) when else supplied',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block="is-{{has-block "inverse"}}"></button>',
        template: 'block here',
        else: 'else here',
      });

      ctx.assertComponent('<button data-has-block="is-true"></button>');
      ctx.assertStableRerender();
    }
  );

  spec('parameterized has-block (concatted attr, else) when else not supplied', (ctx) => {
    ctx.render.template({
      layout: '<button data-has-block="is-{{has-block "inverse"}}"></button>',
      template: 'block here',
    });

    ctx.assertComponent('<button data-has-block="is-false"></button>');
    ctx.assertStableRerender();
  });

  spec('parameterized has-block (concatted attr, default) when block supplied', (ctx) => {
    ctx.render.template({
      layout: '<button data-has-block="is-{{has-block}}"></button>',
      template: 'block here',
    });

    ctx.assertComponent('<button data-has-block="is-true"></button>');
    ctx.assertStableRerender();
  });

  spec(
    { type: 'curly' },
    'parameterized has-block (concatted attr, default) when block not supplied',
    (ctx) => {
      ctx.render.template({
        layout: '<button data-has-block="is-{{has-block}}"></button>',
      });

      ctx.assertComponent('<button data-has-block="is-false"></button>');
      ctx.assertStableRerender();
    }
  );

  spec({ type: 'glimmer' }, 'self closing angle bracket invocation (subexpr, default)', (ctx) => {
    ctx.register.component(
      'Glimmer',
      'TestComponent',
      `<div ...attributes>{{#if (has-block)}}Yes{{else}}No{{/if}}</div>`
    );
    ctx.render.template(`<TestComponent />`);

    ctx.assertComponent('No');
    ctx.assertStableRerender();
  });

  spec({ type: 'glimmer' }, 'self closing angle bracket invocation (subexpr, else)', (ctx) => {
    ctx.register.component(
      'Glimmer',
      'TestComponent',
      `<div ...attributes>{{#if (has-block 'inverse')}}Yes{{else}}No{{/if}}</div>`
    );
    ctx.render.template(`<TestComponent />`);

    ctx.assertComponent('No');
    ctx.assertStableRerender();
  });

  spec(
    { type: 'glimmer' },
    'self closing angle bracket invocation (concatted attr, default)',
    (ctx) => {
      ctx.register.component(
        'Glimmer',
        'TestComponent',
        `<div data-has-block="{{has-block}}" ...attributes></div>`
      );
      ctx.render.template(`<TestComponent />`);

      ctx.assertComponent('', { 'data-has-block': 'false' });
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'glimmer' },
    'has-block works within a yielded curried component invoked within mustaches',
    (ctx) => {
      ctx.register.component(
        'Glimmer',
        'ComponentWithHasBlock',
        `<div data-has-block="{{has-block}}" ...attributes></div>`
      );

      ctx.register.component('Glimmer', 'Yielder', `{{yield (component 'ComponentWithHasBlock')}}`);

      ctx.register.component(
        'Glimmer',
        'TestComponent',
        `<Yielder as |componentWithHasBlock|>{{componentWithHasBlock}}</Yielder>`
      );

      ctx.render.template(`<TestComponent />`);

      ctx.assertComponent('', { 'data-has-block': 'false' });
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'glimmer' },
    'has-block works within a yielded curried component invoked with angle bracket invocation (falsy)',
    (ctx) => {
      ctx.register.component(
        'Glimmer',
        'ComponentWithHasBlock',
        `<div data-has-block="{{has-block}}" ...attributes></div>`
      );

      ctx.register.component('Glimmer', 'Yielder', `{{yield (component 'ComponentWithHasBlock')}}`);

      ctx.register.component(
        'Glimmer',
        'TestComponent',
        `<Yielder as |componentWithHasBlock|><componentWithHasBlock/></Yielder>`
      );

      ctx.render.template(`<TestComponent />`);

      ctx.assertComponent('', { 'data-has-block': 'false' });
      ctx.assertStableRerender();
    }
  );

  spec(
    { type: 'glimmer' },
    'has-block works within a yielded curried component invoked with angle bracket invocation (truthy)',
    (ctx) => {
      ctx.register.component(
        'Glimmer',
        'ComponentWithHasBlock',
        `<div data-has-block="{{has-block}}" ...attributes></div>`
      );

      ctx.register.component('Glimmer', 'Yielder', `{{yield (component 'ComponentWithHasBlock')}}`);

      ctx.register.component(
        'Glimmer',
        'TestComponent',
        `<Yielder as |componentWithHasBlock|><componentWithHasBlock></componentWithHasBlock></Yielder>`
      );

      ctx.render.template(`<TestComponent />`);

      ctx.assertComponent('', { 'data-has-block': 'true' });
      ctx.assertStableRerender();
    }
  );
}).client();
