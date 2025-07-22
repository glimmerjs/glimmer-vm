/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { jitSuite, RenderTest, test } from '@glimmer-workspace/integration-tests';

class StackArgsTest extends RenderTest {
  static suiteName = 'Stack-based Arguments';

  @test
  'simple helper with positional args'() {
    this.registerHelper('uppercase', ([str]) => (str as string).toUpperCase());

    this.render('{{uppercase "hello"}}');
    this.assertHTML('HELLO');
    this.assertStableRerender();
  }

  @test
  'helper with multiple positional args'() {
    this.registerHelper('join', ([a, b]) => `${a}${b}`);

    this.render('{{join "hello" "world"}}');
    this.assertHTML('helloworld');
    this.assertStableRerender();
  }

  @test
  'helper with named args'() {
    this.registerHelper('greet', (_, hash) => `Hello, ${hash['name']}!`);

    this.render('{{greet name="World"}}');
    this.assertHTML('Hello, World!');
    this.assertStableRerender();
  }

  @test
  'helper with both positional and named args'() {
    this.registerHelper('format', ([template], hash) => {
      return (template as string).replace('{{name}}', hash['name'] as string);
    });

    this.render('{{format "Hello, {{name}}!" name="Alice"}}');
    this.assertHTML('Hello, Alice!');
    this.assertStableRerender();
  }

  @test
  'nested helper calls'() {
    this.registerHelper('uppercase', ([str]) => (str as string).toUpperCase());
    this.registerHelper('lowercase', ([str]) => (str as string).toLowerCase());
    this.registerHelper('join', ([a, b]) => `${a}${b}`);

    this.render('{{join (uppercase "hello") (lowercase "WORLD")}}');
    this.assertHTML('HELLOworld');
    this.assertStableRerender();
  }
}

jitSuite(StackArgsTest);
