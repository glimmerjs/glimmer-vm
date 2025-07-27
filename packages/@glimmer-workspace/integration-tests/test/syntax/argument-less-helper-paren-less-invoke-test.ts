import { Validation } from '@glimmer/syntax';
import {
  defineSimpleHelper,
  highlightError,
  jitSuite,
  preprocess,
  RenderTest,
  test,
} from '@glimmer-workspace/integration-tests';

class ArgumentLessHelperParenLessInvokeTest extends RenderTest {
  static suiteName = 'argument-less helper paren-less invoke';

  @test
  'invoking an argument-less helper without parens in named argument position is a syntax error'(
    assert: Assert
  ) {
    assert.throws(
      () => {
        preprocess('<Bar @content={{foo}} />', {
          meta: { moduleName: 'test-module' },
        });
      },
      highlightError(
        Validation.resolutionError({
          attemptedTo: 'pass `foo` as an argument',
        }),
        [
          [
            `Try:\n`,
            `* @content={{this.foo}} if this was meant to be a property lookup, or`,
            `* @content={{(foo)}} if this was meant to invoke the resolved helper, or`,
            `* @content={{helper "foo"}} if this was meant to pass the resolved helper by value`,
          ].join('\n'),
        ]
      )`
        1 | <Bar @content={{foo}} />
          |                 ===
          |                   \= not in scope
      `
    );
  }

  @test
  'invoking an argument-less helper with parens in named argument position is not deprecated'() {
    this.registerHelper('is-string', ([value]: readonly unknown[]) => typeof value === 'string');

    this.registerHelper('foo', () => 'Hello, world!');
    this.registerComponent('TemplateOnly', 'Bar', '[{{is-string @content}}][{{@content}}]');

    this.render('<Bar @content={{(foo)}} />');
    this.assertHTML('[true][Hello, world!]');
    this.assertStableRerender();
  }

  @test
  'invoking an argument-less helper with quotes in named argument position is not deprecated'() {
    this.registerHelper('is-string', ([value]: readonly unknown[]) => typeof value === 'string');

    this.registerHelper('foo', () => 'Hello, world!');
    this.registerComponent('TemplateOnly', 'Bar', '[{{is-string @content}}][{{@content}}]');

    this.render('<Bar @content="{{foo}}" />');
    this.assertHTML('[true][Hello, world!]');
    this.assertStableRerender();
  }

  @test
  'passing a local helper in named argument position is not deprecated'() {
    this.registerHelper('is-string', ([value]: readonly unknown[]) => typeof value === 'string');

    const foo = defineSimpleHelper(() => 'Hello, world!');

    this.registerComponent('TemplateOnly', 'Bar', '[{{is-string @content}}][{{@content}}]');

    this.render('{{#let this.foo as |foo|}}<Bar @content={{foo}} />{{/let}}', { foo });
    this.assertHTML('[false][Hello, world!]');
    this.assertStableRerender();
  }

  @test
  'invoking a local helper with parens in named argument position is not deprecated'() {
    this.registerHelper('is-string', ([value]: readonly unknown[]) => typeof value === 'string');

    const foo = defineSimpleHelper(() => 'Hello, world!');

    this.registerComponent('TemplateOnly', 'Bar', '[{{is-string @content}}][{{@content}}]');

    this.render('{{#let this.foo as |foo|}}<Bar @content={{(foo)}} />{{/let}}', { foo });
    this.assertHTML('[true][Hello, world!]');
    this.assertStableRerender();
  }

  // TODO: this should work, but doesn't

  // @test
  // 'invoking a helper with quotes in named argument position is not deprecated'() {
  //   this.registerHelper('is-string', ([value]: readonly unknown[]) => typeof value === 'string');

  //   const foo = defineSimpleHelper(() => 'Hello, world!');

  //   this.registerComponent('TemplateOnly', 'Bar', '[{{is-string @content}}][{{@content}}]');

  //   this.render('{{#let this.foo as |foo|}}<Bar @content="{{foo}}" />{{/let}}', { foo });
  //   this.assertHTML('[true][Hello, world!]');
  //   this.assertStableRerender();
  // }
}

jitSuite(ArgumentLessHelperParenLessInvokeTest);
