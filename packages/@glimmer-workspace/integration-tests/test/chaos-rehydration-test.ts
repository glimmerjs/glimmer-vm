/* eslint-disable qunit/no-identical-names */
import type { Dict, Nullable, SimpleElement, SomeReactive } from '@glimmer/interfaces';
import { ReadonlyCell, unwrapReactive } from '@glimmer/reference';
import {
  castToBrowser,
  castToSimple,
  COMMENT_NODE,
  ELEMENT_NODE,
  expect,
  isObject,
  LOCAL_LOGGER,
} from '@glimmer/util';
import {
  blockStack,
  CLOSE,
  type ComponentBlueprint,
  type Content,
  content,
  equalTokens,
  matrix,
  OPEN,
  PartialRehydrationDelegate,
  qunitFixture,
  RehydrationDelegate,
  RenderTestContext,
  replaceHTML,
} from '@glimmer-workspace/integration-tests';

// `window.ActiveXObject` is "falsey" in IE11 (but not `undefined` or `false`) `"ActiveXObject" in
// window` returns `true` in all IE versions only IE11 will pass _both_ of these conditions
const isIE11 = !(window as any).ActiveXObject && 'ActiveXObject' in window;

abstract class ChaosMonkeyContext extends RenderTestContext {
  abstract renderClientSide(template: string | ComponentBlueprint, self: SomeReactive): void;

  getRandomForIteration(iteration: number) {
    const { seed } = QUnit.config;

    const str = `${iteration}\x1C${seed}`;

    // from https://github.com/qunitjs/qunit/blob/2.9.3/src/core/utilities.js#L144-L158
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }

    let hex = (0x100000000 + hash).toString(16);
    if (hex.length < 8) {
      hex = '0000000' + hex;
    }

    const result = hex.slice(-8);
    let sample = parseInt(result, 16) || -1;

    // from https://github.com/qunitjs/qunit/blob/2.9.3/src/core/processing-queue.js#L134-L154
    sample ^= sample << 13;
    sample ^= sample >>> 17;
    sample ^= sample << 5;

    if (sample < 0) {
      sample += 0x100000000;
    }

    return sample / 0x100000000;
  }

  wreakHavoc(iteration = 0, shouldLog = false) {
    const element = castToBrowser(this.element, 'HTML');

    const original = element.innerHTML;

    function collectChildNodes(childNodes: Node[], node: Node): Node[] {
      // do some thing with the node here

      node.childNodes.forEach((child) => {
        childNodes.push(child);

        collectChildNodes(childNodes, child);
      });

      return childNodes;
    }

    // gather all the nodes recursively
    let nodes: Node[] = collectChildNodes([], element);

    // cannot remove the first opening block node and last closing block node, that is what makes it
    // rehydrateable
    nodes = nodes.slice(1, -1);

    // select a random node to remove
    const indexToRemove = Math.floor(this.getRandomForIteration(iteration) * nodes.length);

    const nodeToRemove = this.guardPresent({ 'node to remove': nodes[indexToRemove] });
    const parent = this.guardPresent({ 'parent node': nodeToRemove.parentNode });

    // remove it
    parent.removeChild(nodeToRemove);

    let removedNodeDisplay: Nullable<string>;
    switch (nodeToRemove.nodeType) {
      case COMMENT_NODE:
        removedNodeDisplay = `<!--${nodeToRemove.nodeValue}-->`;
        break;
      case ELEMENT_NODE:
        removedNodeDisplay = castToBrowser(nodeToRemove, ['HTML', 'SVG']).outerHTML;
        break;
      default:
        removedNodeDisplay = nodeToRemove.nodeValue;
    }

    if (shouldLog) {
      LOCAL_LOGGER.debug(
        `${removedNodeDisplay} was removed;\noriginal: ${original}\nupdated:  ${element.innerHTML}`
      );
    }

    this.assert.notEqual(
      original,
      element.innerHTML,
      `\`${removedNodeDisplay}\` was removed from \`${original}\``
    );
  }

  runIterations(template: string, self: SomeReactive<Dict>, expectedHTML: string, count: number) {
    const element = castToBrowser(this.element, 'HTML');
    const elementResetValue = element.innerHTML;

    const urlParams = (QUnit as any).urlParams as Dict<string>;
    if (urlParams['iteration']) {
      // runs a single iteration directly, no try/catch, with logging
      const iteration = parseInt(urlParams['iteration'], 10);
      this.wreakHavoc(iteration, true);

      this.renderClientSide(template, self);

      const element = castToBrowser(this.element, 'HTML');
      this.assert.strictEqual(element.innerHTML, expectedHTML);
    } else {
      for (let i = 0; i < count; i++) {
        const seed = QUnit.config.seed ? `&seed=${QUnit.config.seed}` : '';
        const rerunUrl = `&testId=${QUnit.config.current.testId}&iteration=${i}${seed}`;

        try {
          this.wreakHavoc(i);

          this.renderClientSide(template, self);

          const element = castToBrowser(this.element, 'HTML');
          this.assert.strictEqual(
            element.innerHTML,
            expectedHTML,
            `should match after iteration ${i}; rerun with these query params: '${rerunUrl}'`
          );
        } catch (error) {
          this.assert.pushResult({
            result: false,
            actual: getErrorMessage(this.assert, error),
            expected: undefined,
            message: `Error occurred during iteration ${i}; rerun with these query params: ${rerunUrl}`,
          });

          throw error;
        } finally {
          // reset the HTML
          element.innerHTML = elementResetValue;
        }
      }
    }
  }
}

function getErrorMessage(assert: Assert, error: unknown): string {
  if (isObject(error) && 'message' in error && typeof error.message === 'string') {
    return error.message;
  } else {
    assert.pushResult({
      result: false,
      expected: `an error with a 'message' property`,
      actual: error,
      message: `unexpectedly, error.message did not exist`,
    });
    return '';
  }
}


class ChaosMonkeyRehydration extends ChaosMonkeyContext {
  static suiteName = 'chaos-rehydration';

  protected declare delegate: RehydrationDelegate;
  protected declare serverOutput: Nullable<string>;

  renderServerSide(
    template: string | ComponentBlueprint,
    self: SomeReactive,
    element: SimpleElement | undefined = undefined
  ): void {
    this.serverOutput = this.delegate.renderServerSide(
      template as string,
      self,
      () => this.takeSnapshot(),
      element,
      this.plugins
    );
    replaceHTML(this.element, this.serverOutput);
  }

  renderClientSide(template: string | ComponentBlueprint, self: SomeReactive): void {
    this.renderResult = this.delegate.renderClientSide(
      template as string,
      self,
      this.element,
      this.plugins
    );
  }

  assertExactServerOutput(_expected: string) {
    const output = expect(
      this.serverOutput,
      'must renderServerSide before calling assertServerOutput'
    );
    equalTokens(output, _expected);
  }

  assertServerOutput(..._expected: Content[]) {
    this.assertExactServerOutput(content([OPEN, ..._expected, CLOSE]));
  }
}

export const ChaosMonkeyTests = matrix(
  { context: ChaosMonkeyRehydration },
  'chaos rehydration',
  (test) => {
    test('adjacent text nodes', (ctx) => {
      const template = '<div>a {{this.b}}{{this.c}}{{this.d}}</div>';

      ctx.self.initialize({ b: '', c: '', d: '' });
      ctx.renderServerSide(template, ctx.self.ref);

      const b = blockStack();
      ctx.assertServerOutput(
        `<div>a ${b(1)}<!--% %-->${b(1)}${b(1)}<!--% %-->${b(1)}${b(1)}<!--% %-->${b(1)}</div>`
      );

      ctx.runIterations(template, ctx.self.ref, '<div>a </div>', 100);
    });

    test('<p> invoking a block which emits a <div>', (ctx) => {
      const template = '<p>hello {{#if this.show}}<div>world!</div>{{/if}}</p>';

      ctx.self.update({ show: true });
      ctx.renderServerSide(template, ctx.self.ref);
      const b = blockStack();

      // assert that we are in a "browser corrected" state (note the `</p>` before the
      // `<div>world!</div>`)
      if (isIE11) {
        // IE11 doesn't behave the same as modern browsers
        ctx.assertServerOutput(`<p>hello ${b(1)}<div>world!</div>${b(1)}<p></p>`);
      } else {
        ctx.assertServerOutput(`<p>hello ${b(1)}</p><div>world!</div>${b(1)}<p></p>`);
      }

      ctx.runIterations(template, ctx.self.ref, '<p>hello <div>world!</div></p>', 100);
    });
  }
);

ChaosMonkeyTests({ delegate: RehydrationDelegate, template: 'all' });

class ChaosMonkeyPartialRehydrationContext extends ChaosMonkeyContext {
  static suiteName = 'chaos-partial-rehydration';
  declare delegate: PartialRehydrationDelegate;

  renderClientSide(componentName: string, args: SomeReactive<Dict>): void {
    this.renderResult = this.delegate.renderComponentClientSide(
      componentName,
      unwrapReactive(args),
      this.element
    );
  }
}

const ChaosMonkeyPartialRehydration = matrix(
  {
    context: ChaosMonkeyPartialRehydrationContext,
  },
  'chaos partial rehydration',
  (test) => {
    test('adjacent text nodes', (ctx) => {
      const args = { b: 'b', c: 'c', d: 'd' };

      ctx.register.component('TemplateOnly', 'RehydratingComponent', 'a {{@b}}{{@c}}{{@d}}');
      ctx.register.component(
        'TemplateOnly',
        'Root',
        '<div><RehydratingComponent @b={{@b}} @c={{@c}} @d={{@d}}/></div>'
      );
      const html = ctx.delegate.renderComponentServerSide('Root', args);

      ctx.assert.strictEqual(
        html,
        content([
          OPEN,
          OPEN,
          '<div>',
          OPEN,
          'a ',
          OPEN,
          'b',
          CLOSE,
          OPEN,
          'c',
          CLOSE,
          OPEN,
          'd',
          CLOSE,
          CLOSE,
          '</div>',
          CLOSE,
          CLOSE,
        ]),
        'server html is correct'
      );
      replaceHTML(qunitFixture(), html);
      ctx.element = castToSimple(castToBrowser(qunitFixture(), 'HTML').querySelector('div')!);
      ctx.runIterations('RehydratingComponent', ReadonlyCell(args, 'args'), 'a bcd', 100);
    });

    test('<p> invoking a block which emits a <div>', (ctx) => {
      const args = { show: true };

      ctx.register.component(
        'TemplateOnly',
        'RehydratingComponent',
        '<p>hello {{#if @show}}<div>world!</div>{{/if}}</p>'
      );

      ctx.register.component(
        'TemplateOnly',
        'Root',
        '<div><RehydratingComponent @show={{@show}}/></div>'
      );
      const html = ctx.delegate.renderComponentServerSide('Root', args);
      ctx.assert.strictEqual(
        html,
        content([
          OPEN,
          OPEN,
          '<div>',
          OPEN,
          '<p>hello ',
          OPEN,
          '<div>world!</div>',
          CLOSE,
          '</p>',
          CLOSE,
          '</div>',
          CLOSE,
          CLOSE,
        ])
      );

      replaceHTML(qunitFixture(), html);
      ctx.element = castToSimple(castToBrowser(qunitFixture(), 'HTML').querySelector('div')!);
      ctx.runIterations(
        'RehydratingComponent',
        ReadonlyCell(args, 'args'),
        '<p>hello <div>world!</div></p>',
        100
      );
    });
  }
);

ChaosMonkeyPartialRehydration({ delegate: PartialRehydrationDelegate, template: 'all' });
