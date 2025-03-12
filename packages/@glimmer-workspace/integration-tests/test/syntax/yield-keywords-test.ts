import { PackageSuite, verifying } from '@glimmer-workspace/integration-tests';

const syntax = PackageSuite('@glimmer/syntax');

syntax(['yield keywords syntax errors'], (module) => {
  module.test('yield throws if receiving any named args besides `to`', () => {
    verifying(`{{yield foo='bar'}}`, "yield only takes a single named argument: 'to'", {
      // this is a keyword error, not a parse error
      using: 'compiler',
    }).throws`
      1 | {{yield foo='bar'}}
        |         ===------
        |          \===== invalid argument
    `.errors();
  });

  module.test('You can only yield to a literal string value', () => {
    verifying('{{yield to=this.bar}}', 'You can only yield to a literal string value', {
      using: 'compiler',
    }).throws`
      1 | {{yield to=this.bar}}
        |            ========
        |             \===== not a string literal
    `.errors();
  });

  module.test('has-block throws if receiving any named args', () => {
    verifying(`{{has-block foo='bar'}}`, '(has-block) does not take any named arguments', {
      using: 'compiler',
    }).throws`
      1 | {{has-block foo='bar'}}
        |             ===------
        |             \===== unexpected named argument
    `.errors();
  });

  module.test('has-block throws if receiving multiple positional', () => {
    verifying(`{{has-block 'foo' 'bar'}}`, '`has-block` only takes a single positional argument', {
      using: 'compiler',
    }).throws`
      1 | {{has-block 'foo' 'bar'}}
        |                   =====
        |                    \===== extra argument
    `.errors();
  });

  module.test('has-block throws if receiving a value besides a string', () => {
    verifying(
      '{{has-block this.bar}}',
      '`has-block` can only receive a string literal as its first argument',
      { using: 'compiler' }
    ).throws`
      1 | {{has-block this.bar}}
        |             ========
        |               \===== invalid argument
    `.errors();
  });

  module.test('has-block-params throws if receiving any named args', () => {
    verifying(
      `{{has-block-params foo='bar'}}`,
      '(has-block-params) does not take any named arguments',
      { using: 'compiler' }
    ).throws`
      1 | {{has-block-params foo='bar'}}
        |                    ===------
        |                      \===== unexpected named argument
    `.errors();
  });

  module.test('has-block-params throws if receiving multiple positional', () => {
    verifying(
      `{{has-block-params 'foo' 'bar' 'baz'}}`,
      '`has-block-params` only takes a single positional argument',
      { using: 'compiler' }
    ).throws`
      1 | {{has-block-params 'foo' 'bar' 'baz'}}
        |                          ===========
        |                           \===== extra arguments
    `.errors();
  });

  module.test('has-block-params throws if receiving a value besides a string', () => {
    verifying(
      '{{has-block-params this.bar}}',
      '`has-block-params` can only receive a string literal as its first argument',
      { using: 'compiler' }
    ).throws`
      1 | {{has-block-params this.bar}}
        |                    ========
        |                       \===== invalid argument
    `.errors();

    verifying(
      '{{has-block-params 123}}',
      '`has-block-params` can only receive a string literal as its first argument',
      { using: 'compiler' }
    ).throws`
    1 | {{has-block-params 123}}
      |                    ===
      |                     \===== invalid argument
  `.errors();
  });
});
