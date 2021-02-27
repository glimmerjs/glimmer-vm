import { RenderTest, test, jitSuite } from '../..';

class EqualTest extends RenderTest {
  static suiteName = '{{eq}} keyword';

  @test
  ['it works eq']() {
    this.render(`{{eq 1 1}}`);

    this.assertHTML('true');
  }

  @test
  ['it works multiple arguments eq']() {
    this.render(`{{eq 1 1 1}}`);

    this.assertHTML('true');
  }

  @test
  ['it works falsey eq']() {
    this.render(`{{eq 1 2}}`);

    this.assertHTML('false');
  }

  @test
  ['it works multiple arguments falsey eq']() {
    this.render(`{{eq 1 1 2}}`);

    this.assertHTML('false');
  }

  @test
  ['correctly eqs when values update eq']() {
    this.render(`{{eq this.foo this.bar}}`, { foo: 123, bar: 456 });

    this.assertHTML('false');

    this.rerender({ foo: 456 });

    this.assertHTML('true');
  }
}

class NotEqualTest extends RenderTest {
  static suiteName = '{{neq}} keyword';

  @test
  ['it works neq']() {
    this.render(`{{neq 1 2}}`);

    this.assertHTML('true');
  }

  @test
  ['it works multiple arguments neq']() {
    this.render(`{{neq 1 2 1}}`);

    this.assertHTML('true');
  }

  @test
  ['it works falsey neq']() {
    this.render(`{{neq 1 1}}`);

    this.assertHTML('false');
  }

  @test
  ['it works multiple arguments falsey neq']() {
    this.render(`{{neq 1 1 1}}`);

    this.assertHTML('false');
  }

  @test
  ['correctly eqs when values update neq']() {
    this.render(`{{neq this.foo this.bar}}`, { foo: 123, bar: 456 });

    this.assertHTML('true');

    this.rerender({ foo: 456 });

    this.assertHTML('false');
  }
}

jitSuite(EqualTest);
jitSuite(NotEqualTest);
