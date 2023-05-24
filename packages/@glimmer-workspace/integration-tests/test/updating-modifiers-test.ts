/* eslint-disable unicorn/prefer-dom-node-dataset */

import { jitSuite, RenderTest, test } from '..';

function makeSyncDataAttributeModifier(step: (name: string) => void) {
  return class SyncDataAttributeModifier {
    declare element: Element;
    didInsertElement([parameter]: string[]) {
      this.element.setAttribute('data-modifier', `installed - ${parameter}`);
      step('didInsertElement');
    }

    didUpdate([parameter]: string[]) {
      this.element.setAttribute(`data-modifier`, `updated - ${parameter}`);
      step('didUpdate');
    }

    willDestroyElement() {
      step('willDestroyElement');
    }
  };
}

class UpdatingModifiers extends RenderTest {
  static suiteName = 'Updating Element Modifier';

  @test
  'Updating an element modifier'(assert: Assert) {
    this.registerModifier(
      'foo',
      makeSyncDataAttributeModifier((name) => assert.step(name))
    );

    this.render('<div><div {{foo this.bar baz=this.fizz}}></div></div>', {
      bar: 'Super Metroid',
    });

    this.assertHTML(
      '<div><div data-modifier="installed - Super Metroid"></div></div>',
      'initial render'
    );
    assert.verifySteps(['didInsertElement']);

    this.rerender();

    this.assertHTML(
      '<div><div data-modifier="installed - Super Metroid"></div></div>',
      'modifier updated'
    );
    assert.verifySteps([]);

    this.rerender({ bar: 'Super Mario' });
    this.assertHTML('<div><div data-modifier="updated - Super Mario"></div></div>', 'no change');
    assert.verifySteps(['didUpdate']);
  }

  @test
  "Const input doesn't trigger update in a element modifier"(assert: Assert) {
    this.registerModifier(
      'foo',
      makeSyncDataAttributeModifier((name) => assert.step(name))
    );

    this.render('<div><div {{foo "bar"}}></div></div>', {});
    this.assertHTML('<div><div data-modifier="installed - bar"></div></div>', 'initial render');
    assert.verifySteps(['didInsertElement']);

    this.rerender();

    this.assertHTML('<div><div data-modifier="installed - bar"></div></div>', 'no change');
    assert.verifySteps([]);
  }

  @test
  'Destructor is triggered on element modifiers'(assert: Assert) {
    this.registerModifier(
      'foo',
      makeSyncDataAttributeModifier((name) => assert.step(name))
    );

    this.render('{{#if this.bar}}<div {{foo this.bar}}></div>{{else}}<div></div>{{/if}}', {
      bar: true,
    });

    this.assertHTML('<div data-modifier="installed - true"></div>', 'initial render');
    assert.verifySteps(['didInsertElement']);

    this.rerender({ bar: false });

    this.assertHTML('<div></div>', 'no more modifier');
    assert.verifySteps(['willDestroyElement']);

    this.rerender({ bar: true });

    this.assertHTML('<div data-modifier="installed - true"></div>', 'back to default render');
    assert.verifySteps(['didInsertElement']);
  }
}

jitSuite(UpdatingModifiers);
