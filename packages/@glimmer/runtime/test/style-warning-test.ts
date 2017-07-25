import { RenderTests, module, test } from "@glimmer/test-helpers";

abstract class StyleWarningTest extends RenderTests {

  /* TODO
    Still need to figure out how to pass StyleEnv to constructor as arg for RenderTests Class

    class StyleAttribute extends SimpleDynamicAttribute {
      set(dom: ElementBuilder, value: Opaque, env: TestEnvironment): void {
        warnings++;
        super.set(dom, value, env);
      }

      update() {}
    }

    class StyleEnv extends TestEnvironment {
      attributeFor(element: Simple.Element, attr: string, isTrusting: boolean, namespace: Option<string>): DynamicAttributeFactory {
        if (attr === 'style' && !isTrusting) {
          return StyleAttribute;
        }

        return super.attributeFor(element, attr, isTrusting, namespace);
      }
    }

    https://github.com/glimmerjs/glimmer-vm/blob/af9294247738503612b707546475a06ba4fdfa0e/packages/%40glimmer/test-helpers/lib/abstract-test-case.ts#L299
  */

  @test "using a static inline style on an element does not give you a warning"() {
    this.render(`<div style="background: {{color}}">Thing</div>`, { color: 'red' });
    this.assertHTML(`<div style="background: red">Thing</div>`);
    this.assertStableRerender();

    this.rerender({ color: 'blue' });
    this.assertHTML(`<div style="background: blue">Thing</div>`);
    this.assertStableNodes();
  }
}

module("Style Warnings Test", StyleWarningTest);
