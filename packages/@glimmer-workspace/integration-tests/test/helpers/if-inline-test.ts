import {
  defineComponent,
  jitSuite,
  RenderTest,
  strip,
  test,
  tracked,
} from '@glimmer-workspace/integration-tests';

class IfInlineTest extends RenderTest {
  static suiteName = 'Helpers test: inline {{if}}';

  @test
  'inline if helper updates when tracked property changes'() {
    class Person {
      @tracked isActive = false;

      toggle() {
        this.isActive = !this.isActive;
      }
    }

    const person = new Person();

    this.render(strip`<div>{{if this.person.isActive "Active" "Inactive"}}</div>`, { person });

    this.assertHTML('<div>Inactive</div>', 'Initial render shows inactive state');
    this.assertStableRerender();

    person.toggle();
    this.rerender();
    this.assertHTML('<div>Active</div>', 'Updates when tracked property changes to true');

    person.toggle();
    this.rerender();
    this.assertHTML('<div>Inactive</div>', 'Updates when tracked property changes to false');
  }

  @test
  'inline if helper with only truthy value updates when tracked property changes'() {
    class Person {
      @tracked isActive = false;

      toggle() {
        this.isActive = !this.isActive;
      }
    }

    const person = new Person();

    this.render(strip`<div>{{if this.person.isActive "Active"}}</div>`, { person });

    this.assertHTML('<div></div>', 'Initial render shows empty when false');
    this.assertStableRerender();

    person.toggle();
    this.rerender();
    this.assertHTML('<div>Active</div>', 'Updates when tracked property changes to true');

    person.toggle();
    this.rerender();
    this.assertHTML('<div></div>', 'Updates when tracked property changes to false');
  }

  @test
  'inline if helper updates when component argument changes'() {
    const TestComponent = defineComponent({}, '{{if @isActive "Active" "Inactive"}}');

    this.render('<TestComponent @isActive={{this.isActive}} />', {
      isActive: false,
      TestComponent,
    });

    this.assertHTML('Inactive', 'Initial render shows inactive state');
    this.assertStableRerender();

    this.rerender({ isActive: true, TestComponent });
    this.assertHTML('Active', 'Updates when argument changes to true');

    this.rerender({ isActive: false, TestComponent });
    this.assertHTML('Inactive', 'Updates when argument changes to false');
  }

  @test
  'inline if helper with components updates when tracked property changes'() {
    class Person {
      @tracked isActive = false;

      toggle() {
        this.isActive = !this.isActive;
      }
    }

    const person = new Person();

    const Ok = defineComponent({}, '<div>OK Component</div>');
    const Ko = defineComponent({}, '<div>KO Component</div>');

    // Create a component with Ok and Ko in scope
    const TestContainer = defineComponent({ Ok, Ko }, '<div>{{if @isActive Ok Ko}}</div>');

    this.render('<TestContainer @isActive={{this.person.isActive}} />', { person, TestContainer });

    this.assertHTML('<div><div>KO Component</div></div>', 'Initial render shows KO component');
    this.assertStableRerender();

    person.toggle();
    this.rerender();
    this.assertHTML(
      '<div><div>OK Component</div></div>',
      'Updates to OK component when tracked property changes to true'
    );

    person.toggle();
    this.rerender();
    this.assertHTML(
      '<div><div>KO Component</div></div>',
      'Updates to KO component when tracked property changes to false'
    );
  }

  @test
  'inline if helper with components updates when component argument changes'() {
    const Ok = defineComponent({}, '<div>OK Component</div>');
    const Ko = defineComponent({}, '<div>KO Component</div>');

    const TestComponent = defineComponent({ Ok, Ko }, '{{if @isOk Ok Ko}}');

    this.render('<TestComponent @isOk={{this.isOk}} />', { isOk: false, TestComponent });

    this.assertHTML('<div>KO Component</div>', 'Initial render shows KO component');
    this.assertStableRerender();

    this.rerender({ isOk: true, TestComponent });
    this.assertHTML(
      '<div>OK Component</div>',
      'Updates to OK component when argument changes to true'
    );

    this.rerender({ isOk: false, TestComponent });
    this.assertHTML(
      '<div>KO Component</div>',
      'Updates to KO component when argument changes to false'
    );
  }

  @test
  'comparison with block form if helper using components'() {
    class Person {
      @tracked isActive = false;

      toggle() {
        this.isActive = !this.isActive;
      }
    }

    const person = new Person();

    const Ok = defineComponent({}, '<div>OK Component</div>');
    const Ko = defineComponent({}, '<div>KO Component</div>');

    // Create a component with Ok and Ko in scope for both inline and block forms
    const TestContainer = defineComponent(
      { Ok, Ko },
      `
        <div>
          Inline: {{if @isActive Ok Ko}}
          Block: {{#if @isActive}}<Ok />{{else}}<Ko />{{/if}}
        </div>
      `
    );

    this.render('<TestContainer @isActive={{this.person.isActive}} />', { person, TestContainer });

    this.assertHTML(
      '<div>Inline: <div>KO Component</div> Block: <div>KO Component</div></div>',
      'Initial render both show KO component'
    );
    this.assertStableRerender();

    person.toggle();
    this.rerender();
    this.assertHTML(
      '<div>Inline: <div>OK Component</div> Block: <div>OK Component</div></div>',
      'Both update to OK component when tracked property changes to true'
    );

    person.toggle();
    this.rerender();
    this.assertHTML(
      '<div>Inline: <div>KO Component</div> Block: <div>KO Component</div></div>',
      'Both update to KO component when tracked property changes to false'
    );
  }
}

jitSuite(IfInlineTest);
