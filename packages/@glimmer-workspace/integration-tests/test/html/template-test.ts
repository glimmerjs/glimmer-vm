import { defineComponent, jitSuite, RenderTest, test } from '../..';

class TemplateElementTest extends RenderTest {
  static suiteName = '<template> (HTML template - declarative shadow dom)';

  @test
  '<template> element can render'() {
    const Bar = defineComponent({}, '<template shadowrootmode="open" data-no><p>hi</p></template>');

    this.renderComponent(Bar);

    /**
      * This is really hard to create a test for, because there is no JavaScript
      * api te assert that this succeeds without rendering it in to a browser.
      * So, to render this, they blog article here:
      *   https://web.dev/articles/declarative-shadow-dom
      *
      *   Recommends the following:
      *
      * (function attachShadowRoots(root) {
            root.querySelectorAll("template[shadowrootmode]").forEach(template => {
              const mode = template.getAttribute("shadowrootmode");
              const shadowRoot = template.parentNode.attachShadow({ mode });

              shadowRoot.appendChild(template.content);
              template.remove();
              attachShadowRoots(shadowRoot);
            });
          })(document);

          For now, since the template element is special, and only allows
          4 attributes, I've added a fake one, and asserted that it doesn't exist
          https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template
      */
    this.assertHTML('<template shadowrootmode="open"><p>hi</p></template>');
  }
}

jitSuite(TemplateElementTest);
