import { module, RenderTests, test } from '@glimmer/test-helpers';


class EmberishComponentTests extends RenderTests {
  @test
  "non-block without properties"() {
    this.render({
      layout: 'In layout'
    });

     this.assertComponent('In layout');
     this.assertStableRerender();
  }
}

module('[NEW] Emberish Components', EmberishComponentTests, { componentModule: true });
