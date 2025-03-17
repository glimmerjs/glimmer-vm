import {
  GlimmerishComponent,
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

    this.render(
      strip`<div>{{if this.person.isActive "Active" "Inactive"}}</div>`,
      { person }
    );

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

    this.render(
      strip`<div>{{if this.person.isActive "Active"}}</div>`,
      { person }
    );

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
    let testComponent: TestComponent;
    
    class TestComponent extends GlimmerishComponent {
      @tracked isActive = false;
      
      constructor(owner: object, args: Record<string, unknown>) {
        super(owner, args);
        testComponent = this;
      }
    }

    this.registerComponent(
      'Glimmer',
      'TestComponent',
      '{{if @isActive "Active" "Inactive"}}',
      TestComponent
    );

    this.render(
      strip`<TestComponent @isActive={{this.isActive}} />`,
      { isActive: false }
    );

    this.assertHTML('Inactive', 'Initial render shows inactive state');
    this.assertStableRerender();

    this.rerender({ isActive: true });
    this.assertHTML('Active', 'Updates when argument changes to true');

    this.rerender({ isActive: false });
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

    class OkComponent extends GlimmerishComponent {}
    class KoComponent extends GlimmerishComponent {}

    this.registerComponent('Glimmer', 'Ok', '<div>OK Component</div>', OkComponent);
    this.registerComponent('Glimmer', 'Ko', '<div>KO Component</div>', KoComponent);

    this.render(
      strip`<div>{{if this.person.isActive Ok Ko}}</div>`,
      { person }
    );

    this.assertHTML('<div><div>KO Component</div></div>', 'Initial render shows KO component');
    this.assertStableRerender();

    person.toggle();
    this.rerender();
    this.assertHTML('<div><div>OK Component</div></div>', 'Updates to OK component when tracked property changes to true');

    person.toggle();
    this.rerender();
    this.assertHTML('<div><div>KO Component</div></div>', 'Updates to KO component when tracked property changes to false');
  }

  @test
  'inline if helper with components updates when component argument changes'() {
    class OkComponent extends GlimmerishComponent {}
    class KoComponent extends GlimmerishComponent {}

    this.registerComponent('Glimmer', 'Ok', '<div>OK Component</div>', OkComponent);
    this.registerComponent('Glimmer', 'Ko', '<div>KO Component</div>', KoComponent);

    this.registerComponent(
      'Glimmer',
      'TestComponent',
      '{{if @isOk Ok Ko}}',
      class extends GlimmerishComponent {}
    );

    this.render(
      strip`<TestComponent @isOk={{this.isOk}} />`,
      { isOk: false }
    );

    this.assertHTML('<div>KO Component</div>', 'Initial render shows KO component');
    this.assertStableRerender();

    this.rerender({ isOk: true });
    this.assertHTML('<div>OK Component</div>', 'Updates to OK component when argument changes to true');

    this.rerender({ isOk: false });
    this.assertHTML('<div>KO Component</div>', 'Updates to KO component when argument changes to false');
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

    class OkComponent extends GlimmerishComponent {}
    class KoComponent extends GlimmerishComponent {}

    this.registerComponent('Glimmer', 'Ok', '<div>OK Component</div>', OkComponent);
    this.registerComponent('Glimmer', 'Ko', '<div>KO Component</div>', KoComponent);

    this.render(
      strip`
        <div>
          Inline: {{if this.person.isActive Ok Ko}}
          Block: {{#if this.person.isActive}}<Ok />{{else}}<Ko />{{/if}}
        </div>
      `,
      { person }
    );

    this.assertHTML('<div>Inline: <div>KO Component</div> Block: <div>KO Component</div></div>', 'Initial render both show KO component');
    this.assertStableRerender();

    person.toggle();
    this.rerender();
    this.assertHTML('<div>Inline: <div>OK Component</div> Block: <div>OK Component</div></div>', 'Both update to OK component when tracked property changes to true');

    person.toggle();
    this.rerender();
    this.assertHTML('<div>Inline: <div>KO Component</div> Block: <div>KO Component</div></div>', 'Both update to KO component when tracked property changes to false');
  }
}

jitSuite(IfInlineTest);
