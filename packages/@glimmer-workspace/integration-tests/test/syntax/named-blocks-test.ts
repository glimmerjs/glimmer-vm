import { PackageSuite, verifying } from '@glimmer-workspace/integration-tests';

const syntax = PackageSuite('@glimmer/syntax');

syntax(['named block syntax errors'], (module) => {
  module.test('Defining block params on a component which has named blocks', () => {
    verifying(
      `<Foo as |bar|><:foo></:foo></Foo>`,
      `Unexpected block params list on <Foo> component invocation: when passing named blocks, the invocation tag cannot take block params`,
      { lexicalScope: (name) => name === 'Foo' }
    ).throws`
      1 | <Foo as |bar|><:foo></:foo></Foo>
        |      ========
        |       \========== unexpected block params
    `.errors();
  });

  module.test('Defining named blocks on a plain element is not allowed', () => {
    verifying(`<div><:foo></:foo></div>`, `Unexpected named block <:foo> inside <div> HTML element`)
      .throws`
      1 | <div><:foo></:foo></div>
        |       ====
        |         \===== unexpected named block
    `.errors();
  });

  module.test('Defining top level named blocks is not allowed', () => {
    verifying(`<:foo></:foo>`, `Unexpected named block at the top-level of a template`, {
      strict: 'both',
      using: 'both',
    }).throws`
      1 | <:foo></:foo>
        |  ====
        |   \===== unexpected named block
    `.errors();
  });

  module.test('Defining named blocks inside a normal block is not allowed', () => {
    verifying(`{{#if}}<:foo></:foo>{{/if}}`, `Unexpected named block nested in a normal block`, {
      lexicalScope: (name) => name === 'if',
    }).throws`
      1 | {{#if}}<:foo></:foo>{{/if}}
        |         ====
        |           \===== unexpected named block
    `.errors();
  });

  module.test('Passing multiple of the same named block is not allowed', () => {
    verifying(
      '<Foo><:foo></:foo><:foo></:foo></Foo>',
      `Component had two named blocks with the same name, \`<:foo>\`. Only one block with a given name may be passed`,
      { lexicalScope: (name) => name === 'Foo' }
    ).throws`
      1 | <Foo><:foo></:foo><:foo></:foo></Foo>
        |                    ====
        |                      \===== duplicate named block
    `.errors();
  });

  module.test(
    'Throws an error if both inverse and else named blocks are passed, inverse first',
    () => {
      verifying(
        '<Foo><:inverse></:inverse><:else></:else></Foo>',
        `Component has both <:else> and <:inverse> block. <:inverse> is an alias for <:else>`,
        { lexicalScope: (name) => name === 'Foo' }
      ).throws`
      1 | <Foo><:inverse></:inverse><:else></:else></Foo>
        |                            =====
        |                             \===== else is the same as inverse
    `.errors();

      verifying(
        '<Foo><:else></:else><:inverse></:inverse></Foo>',
        `Component has both <:else> and <:inverse> block. <:inverse> is an alias for <:else>`,
        { lexicalScope: (name) => name === 'Foo' }
      ).throws`
      1 | <Foo><:else></:else><:inverse></:inverse></Foo>
        |                      ========
        |                        \===== inverse is the same as else
    `.errors();
    }
  );

  module.test('Throws an error if there is content outside of the blocks', () => {
    verifying(
      `<Foo>Hello!<:foo></:foo></Foo>`,
      `Unexpected content inside <Foo> component invocation: when using named blocks, the tag cannot contain other content`,
      { lexicalScope: (name) => name === 'Foo' }
    ).throws`
      1 | <Foo>Hello!<:foo></:foo></Foo>
        |      ======
        |        \===== unexpected content
    `.errors();

    verifying(
      `<Foo><:foo></:foo>Hello!</Foo>`,
      `Unexpected content inside <Foo> component invocation: when using named blocks, the tag cannot contain other content`,
      { lexicalScope: (name) => name === 'Foo' }
    ).throws`
      1 | <Foo><:foo></:foo>Hello!</Foo>
        |                   ======
        |                    \===== unexpected content
    `.errors();

    verifying(
      `<Foo><:foo></:foo>Hello!<:bar></:bar></Foo>`,
      `Unexpected content inside <Foo> component invocation: when using named blocks, the tag cannot contain other content`,
      { lexicalScope: (name) => name === 'Foo' }
    ).throws`
      1 | <Foo><:foo></:foo>Hello!<:bar></:bar></Foo>
        |                   ======
        |                    \===== unexpected content
    `.errors();
  });

  module.test('Cannot pass self closing named block', () => {
    verifying(`<Foo><:foo/></Foo>`, `Named blocks cannot be self-closing`, {
      lexicalScope: (name) => name === 'Foo',
    }).throws`
      1 | <Foo><:foo/></Foo>
        |      -----==
        |           \===== invalid self-closing tag
    `.errors();

    verifying(`<Foo><:foo></:foo><:bar /></Foo>`, `Named blocks cannot be self-closing`, {
      lexicalScope: (name) => name === 'Foo',
    }).throws`
      1 | <Foo><:foo></:foo><:bar /></Foo>
        |                   ------==
        |                    \===== invalid self-closing tag
    `.errors();
  });

  module.test('Named blocks must start with a lowercase letter', () => {
    verifying(`<Foo><:Bar></:Bar></Foo>`, `Named blocks must start with a lowercase letter`, {
      lexicalScope: (name) => name === 'Foo',
    }).throws`
      1 | <Foo><:Bar></:Bar></Foo>
        |       ====
        |       \===== Bar begins with a capital letter
    `.errors();

    verifying(`<Foo><:1bar></:1bar></Foo>`, `Named blocks must start with a lowercase letter`, {
      lexicalScope: (name) => name === 'Foo',
    }).throws`
      1 | <Foo><:1bar></:1bar></Foo>
        |       =====
        |       \===== 1bar begins with a number
    `.errors();
  });

  module.test('Named blocks cannot have arguments, attributes, or modifiers', () => {
    verifying(`<Foo><:bar attr='baz'></:bar></Foo>`, `Named blocks cannot have attributes`, {
      lexicalScope: (name) => name === 'Foo',
    }).throws`
      1 | <Foo><:bar attr='baz'></:bar></Foo>
        |            ==========
        |                 \===== invalid attribute
    `.errors();

    verifying(`<Foo><:bar ...attributes></:bar></Foo>`, `Named blocks cannot have ...attributes`, {
      lexicalScope: (name) => name === 'Foo',
    }).throws`
      1 | <Foo><:bar ...attributes></:bar></Foo>
        |            =============
        |                 \===== invalid ...attributes
    `.errors();

    verifying(`<Foo><:bar @arg='baz'></:bar></Foo>`, `Named blocks cannot have arguments`, {
      lexicalScope: (name) => name === 'Foo',
    }).throws`
      1 | <Foo><:bar @arg='baz'></:bar></Foo>
        |            ==========
        |             \===== invalid argument
    `.errors();

    verifying(`<Foo><:bar {{modifier}}></:bar></Foo>`, `Named blocks cannot have modifiers`, {
      lexicalScope: (name) => name === 'Foo' || name === 'modifier',
    }).throws`
      1 | <Foo><:bar {{modifier}}></:bar></Foo>
        |            ============
        |             \===== invalid modifier
    `.errors();
  });
});
