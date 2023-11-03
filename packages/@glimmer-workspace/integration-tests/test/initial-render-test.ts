import type { Dict, Nullable, SimpleElement } from '@glimmer/interfaces';
import type { SafeString } from '@glimmer/runtime';
import { castToBrowser, expect } from '@glimmer/util';
import {
  assertElementShape,
  assertEmberishElement,
  assertingElement,
  assertSerializedInElement,
  blockStack,
  CLOSE,
  type ComponentBlueprint,
  componentSuite,
  type Content,
  content,
  DynamicInitialRenderSuite,
  EMPTY,
  equalTokens,
  firstElementChild,
  GLIMMER_TEST_COMPONENT,
  InitialRenderTests,
  jitSuite,
  OPEN,
  RehydrationDelegate,
  render,
  RenderTestContext,
  replaceHTML,
  strip,
  suite,
  toInnerHTML,
  toTextContent,
} from '@glimmer-workspace/integration-tests';
import { matrix } from '@glimmer-workspace/integration-tests';

// `window.ActiveXObject` is "falsey" in IE11 (but not `undefined` or `false`)
// `"ActiveXObject" in window` returns `true` in all IE versions
// only IE11 will pass _both_ of these conditions
const isIE11 = !(window as any).ActiveXObject && 'ActiveXObject' in window;

class RehydrationContext extends RenderTestContext {
  declare delegate: RehydrationDelegate;
  protected declare serverOutput: Nullable<string>;

  renderServerSide(
    template: string | ComponentBlueprint,
    self: Dict,
    element: SimpleElement | undefined = undefined
  ): void {
    this.self.initialize(self);
    this.serverOutput = this.delegate.renderServerSide(
      template as string,
      this.self.ref,
      () => this.takeSnapshot(),
      element,
      this.plugins
    );
    replaceHTML(this.element, this.serverOutput);
  }

  renderClientSide(template: string | ComponentBlueprint, self: Dict): void {
    this.self.initialize(self);
    this.renderResult = this.delegate.renderClientSide(
      template as string,
      this.self.ref,
      this.element,
      this.plugins
    );
  }

  assertRehydrationStats({ nodesRemoved: nodes }: { nodesRemoved: number }) {
    let { clearedNodes } = this.delegate.rehydrationStats;
    this.assert.strictEqual(clearedNodes.length, nodes, 'cleared nodes');
  }

  assertExactServerOutput(_expected: string) {
    let output = expect(
      this.serverOutput,
      'must renderServerSide before calling assertServerOutput'
    );
    equalTokens(output, _expected);
  }

  assertServerOutput(..._expected: Content[]) {
    this.assertExactServerOutput(content([OPEN, ..._expected, CLOSE]));
  }
}

const RehydrationTests = matrix(
  { context: RehydrationContext, extends: InitialRenderTests },
  'rehydration2',
  (test) => {
    test('rehydrates into element with pre-existing content', (ctx) => {
      let rootElement = ctx.delegate.serverDoc.createElement('div');
      let extraContent = ctx.delegate.serverDoc.createElement('noscript');
      rootElement.appendChild(extraContent);

      let noScriptString = '<noscript></noscript>';
      let template = '<div>Hi!</div>';
      ctx.renderServerSide(template, {}, rootElement);
      ctx.assertExactServerOutput(content([noScriptString, OPEN, ...template, CLOSE]));
      ctx.renderClientSide(template, {});
      ctx.assertHTML('<noscript></noscript><div>Hi!</div>');
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertStableNodes();
    });

    test('handles non-empty trusted content (triple-curlies)', (ctx) => {
      let template = '<div>{{{this.value}}}</div>';
      let obj: { value: string } = { value: 'foo' };
      ctx.renderServerSide(template, obj);
      ctx.renderClientSide(template, obj);
      ctx.assertHTML('<div>foo</div>');
    });

    test('handles empty trusted content (triple-curlies)', (ctx) => {
      let template = '<div>{{{this.value}}}</div>';
      let obj: { value: string } = { value: '' };
      ctx.renderServerSide(template, obj);
      ctx.renderClientSide(template, obj);
      ctx.assertHTML('<div></div>');
    });

    test('handles empty trusted content (html safe string)', (ctx) => {
      let template = '<div>{{this.value}}</div>';

      let safeString: SafeString = {
        toHTML() {
          return '';
        },
      };
      let obj = { value: safeString };

      ctx.renderServerSide(template, obj);
      ctx.renderClientSide(template, obj);
      ctx.assertHTML('<div></div>');
    });

    test('table with omitted tbody', (ctx) => {
      let template = '<table><tr><td>standards</td></tr></table>';
      ctx.renderServerSide(template, {});
      ctx.assertServerOutput('<table><tbody><tr><td>standards</td></tr></tbody></table>');
      ctx.renderClientSide(template, {});
      ctx.assertHTML('<table><tbody><tr><td>standards</td></tr></tbody></table>');
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertStableNodes();
    });

    test('table with thead', (ctx) => {
      let template = '<table><thead><tr><th>standards</th></tr></thead></table>';
      ctx.renderServerSide(template, {});
      ctx.assertServerOutput('<table><thead><tr><th>standards</th></tr></thead></table>');
      ctx.renderClientSide(template, {});
      ctx.assertHTML('<table><thead><tr><th>standards</th></tr></thead></table>');
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertStableNodes();
    });

    test('table with tfoot', (ctx) => {
      let template = '<table><tfoot><tr><th>standards</th></tr></tfoot></table>';
      ctx.renderServerSide(template, {});
      ctx.assertServerOutput('<table><tfoot><tr><th>standards</th></tr></tfoot></table>');
      ctx.renderClientSide(template, {});
      ctx.assertHTML('<table><tfoot><tr><th>standards</th></tr></tfoot></table>');
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertStableNodes();
    });

    test('mismatched text nodes', (ctx) => {
      let template = '{{this.content}}';
      ctx.renderServerSide(template, { content: 'hello' });
      ctx.assertServerOutput(OPEN, 'hello', CLOSE);

      ctx.renderClientSide(template, { content: 'goodbye' });
      ctx.assertHTML('goodbye');
      // Just repairs the value of the text node
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertStableRerender();
    });

    test('mismatched text nodes (server-render empty)', (ctx) => {
      let template = '{{this.content}} world';
      ctx.renderServerSide(template, { content: '' });
      ctx.assertServerOutput(OPEN, EMPTY, CLOSE, ' world');

      ctx.renderClientSide(template, { content: 'hello' });
      ctx.assertHTML('hello world');
      // Just repairs the value of the text node
      ctx.assertRehydrationStats({ nodesRemoved: 0 });

      // TODO handle % % in the testing DSL
      // this.assertStableNodes();
      ctx.assertStableRerender();
    });

    test('missing closing block within multiple text nodes', (ctx) => {
      let template = '<div>a {{this.b}}{{this.c}}{{this.d}}</div>';
      let context = { b: '', c: '', d: '' };

      ctx.renderServerSide(template, context);

      let b = blockStack();
      ctx.assertServerOutput(
        `<div>a ${b(1)}<!--% %-->${b(1)}${b(1)}<!--% %-->${b(1)}${b(1)}<!--% %-->${b(1)}</div>`
      );

      // remove the first `<!--%-b:1%-->`
      let element = castToBrowser(ctx.element, 'HTML');
      let [div] = ctx.guardArray({ children: element.children }, { min: 1 });
      let commentToRemove = ctx.guardArray({ children: div.childNodes }, { min: 4 })[3];
      div.removeChild(commentToRemove);

      ctx.renderClientSide(template, context);
      ctx.assertHTML('<div>a </div>');
      ctx.assertRehydrationStats({ nodesRemoved: 0 });

      // TODO: handle % % in the testing DSL
      // this.assertStableNodes();
      ctx.assertStableRerender();
    });

    test('resumes correct block after reenabling rehydration', (ctx) => {
      let template = strip`
      <div>
        {{#if this.a}}
          {{#if this.b}}
            {{#if this.c}}
              <inside-c></inside-c>
            {{/if}}
            <after-c></after-c>
          {{/if}}
          <after-b></after-b>
        {{/if}}
        <after-a></after-a>
      </div>
    `;
      let context = { a: false, b: false, c: false };

      ctx.renderServerSide(template, context);

      let b = blockStack();
      ctx.assertServerOutput(`<div>${b(1)}<!---->${b(1)}<after-a></after-a></div>`);

      ctx.renderClientSide(template, { a: true, b: true, c: true });
      ctx.assertHTML(
        '<div><inside-c></inside-c><after-c></after-c><after-b></after-b><after-a></after-a></div>'
      );
      ctx.assertRehydrationStats({ nodesRemoved: 0 });

      // TODO: handle % % in the testing DSL
      // this.assertStableNodes();
      ctx.assertStableRerender();
    });

    test('mismatched elements', (ctx) => {
      let template = '{{#if this.admin}}<div>hi admin</div>{{else}}<p>HAXOR</p>{{/if}}';
      ctx.renderServerSide(template, { admin: true });
      ctx.assertServerOutput(OPEN, '<div>hi admin</div>', CLOSE);

      ctx.renderClientSide(template, { admin: false });
      ctx.assertRehydrationStats({ nodesRemoved: 1 });
      ctx.assertHTML('<p>HAXOR</p>');
      ctx.assertStableRerender();
    });

    test('text nodes surrounding single line handlebars comments', (ctx) => {
      let template = 'hello{{! hmm, why is this here?! }} world';
      ctx.renderServerSide(template, {});
      ctx.assertServerOutput('hello', '<!--%|%-->', ' world');

      ctx.renderClientSide(template, {});
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML('hello world');
      ctx.assertStableRerender();
    });

    test('text nodes surrounding multi line handlebars comments', (ctx) => {
      let template = 'hello{{!-- hmm, why is this here?! --}} world';
      ctx.renderServerSide(template, {});
      ctx.assertServerOutput('hello', '<!--%|%-->', ' world');

      ctx.renderClientSide(template, {});
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML('hello world');
      ctx.assertStableRerender();
    });

    test('text nodes surrounding "stand alone" handlebars comment', (ctx) => {
      let template = '<div></div>\n{{! hmm, why is this here?! }}\n<div></div>';
      ctx.renderServerSide(template, {});
      ctx.assertServerOutput('<div></div>', '\n', '<div></div>');

      ctx.renderClientSide(template, {});
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML('<div></div>\n<div></div>');
      ctx.assertStableRerender();
    });

    test('extra nodes at the end', (ctx) => {
      let template =
        '{{#if this.admin}}<div>hi admin</div>{{else}}<div>HAXOR{{this.stopHaxing}}</div>{{/if}}';
      ctx.renderServerSide(template, { admin: false, stopHaxing: 'stahp' });
      ctx.assertServerOutput(OPEN, '<div>HAXOR', OPEN, 'stahp', CLOSE, '</div>', CLOSE);

      ctx.renderClientSide(template, { admin: true });
      ctx.assertRehydrationStats({ nodesRemoved: 1 });
      ctx.assertHTML('<div>hi admin</div>');
      ctx.assertStableRerender();
    });

    test('missing attributes', (ctx) => {
      let template = '<div data-foo="true"></div>';
      ctx.renderServerSide(template, {});
      ctx.assertServerOutput('<div data-foo="true"></div>');

      // remove the attribute
      let element = castToBrowser(ctx.element, 'HTML');
      let [div] = ctx.guardArray({ children: element.children }, { min: 1 });
      div.removeAttribute('data-foo');

      ctx.renderClientSide(template, {});
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML('<div data-foo="true"></div>');
      ctx.assertStableRerender();
    });

    test('remove extra attributes', (ctx) => {
      let template = '<div data-foo="true"></div>';
      ctx.renderServerSide(template, {});
      ctx.assertServerOutput('<div data-foo="true"></div>');

      // add an extra attribute
      let element = castToBrowser(ctx.element, 'HTML');
      let [div] = ctx.guardArray({ children: element.children }, { min: 1 });
      div.setAttribute('data-bar', 'oops');

      ctx.renderClientSide(template, {});
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML('<div data-foo="true"></div>');
      ctx.assertStableRerender();
    });

    test('updates attribute to current value', (ctx) => {
      let template = '<div class="always-present show-me"></div>';
      ctx.renderServerSide(template, {});
      ctx.assertServerOutput('<div class="always-present show-me"></div>');

      // mutate the attribute
      let element = castToBrowser(ctx.element, 'HTML');
      let [div] = ctx.guardArray({ children: element.children }, { min: 1 });
      div.setAttribute('class', 'zomg');

      ctx.renderClientSide(template, {});
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML('<div class="always-present show-me"></div>');
      ctx.assertStableRerender();
    });

    test('does not mutate attributes that already match', (ctx) => {
      let observer = new MutationObserver((mutationList) => {
        mutationList.forEach((mutation) => {
          let target = castToBrowser(mutation.target, 'HTML');
          ctx.assert.ok(
            false,
            `should not have updated ${mutation.attributeName} on ${target.outerHTML}`
          );
        });
      });

      let template = '<div data-foo="whatever"></div>';
      ctx.renderServerSide(template, {});
      ctx.assertServerOutput('<div data-foo="whatever"></div>');

      observer.observe(castToBrowser(ctx.element, 'HTML'), { attributes: true, subtree: true });

      ctx.renderClientSide(template, {});
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML('<div data-foo="whatever"></div>');
      ctx.assertStableRerender();
    });

    test('Node curlies', (ctx) => {
      let template = '<div>{{this.node}}</div>';

      let doc = ctx.delegate.serverDoc;
      let node = doc.createTextNode('hello');
      ctx.renderServerSide(template, { node });
      ctx.assertServerOutput('<div>', OPEN, 'hello', CLOSE, '</div>');
      doc = ctx.delegate.clientDoc;
      let clientNode = doc.createTextNode('hello');
      ctx.renderClientSide(template, { node: clientNode });
      ctx.assertHTML('<div>hello</div>', 'first clean rerender');
      // Just repairs the value of the text node
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertStableRerender();

      let clientNode2 = doc.createTextNode('goodbye');
      ctx.rerender({ node: clientNode2 });
      ctx.assertHTML('<div>goodbye</div>', 'rerender after node update');
      ctx.assertStableNodes({ except: clientNode });

      ctx.rerender({ node: clientNode });
      ctx.assertHTML('<div>hello</div>', 'back to the beginning');
      ctx.assertStableNodes({ except: clientNode2 });
    });

    test('in-element can rehydrate', (ctx) => {
      let template = strip`
      <outer><prefix></prefix>
      {{#in-element this.remote}}<inner>Wat Wat</inner>{{/in-element}}
      <suffix></suffix></outer>
      `;
      let doc = ctx.delegate.serverDoc;
      let remote = doc.createElement('remote');
      let prefix = doc.createElement('prefix');
      let suffix = doc.createElement('suffix');
      remote.appendChild(prefix);
      remote.appendChild(suffix);

      ctx.renderServerSide(template, { remote });
      let serializedRemote = ctx.delegate.serialize(remote);
      let b = blockStack();
      assertSerializedInElement(
        serializedRemote,
        strip`
      ${b(2)}
      <inner>Wat Wat</inner>
      ${b(2)}
    `
      );

      doc = ctx.delegate.clientDoc;
      let clientRemote = (remote = doc.createElement('remote'));
      let host = doc.createElement('div');
      host.appendChild(ctx.element);
      host.appendChild(clientRemote);
      replaceHTML(clientRemote, serializedRemote);
      ctx.element = assertingElement(host.firstChild);

      ctx.renderClientSide(template, { remote: clientRemote });
      ctx.assertRehydrationStats({ nodesRemoved: 2 });
      ctx.assert.strictEqual(toInnerHTML(clientRemote), '<inner>Wat Wat</inner>');
    });

    test('in-element with insertBefore=null can rehydrate', (ctx) => {
      let template = strip`
      <outer><prefix></prefix>
      {{#in-element this.remote insertBefore=null}}<inner>Wat Wat</inner>{{/in-element}}
      <suffix></suffix></outer>
      `;
      let doc = ctx.delegate.serverDoc;
      let remote = doc.createElement('remote');
      let prefix = doc.createElement('prefix');
      let suffix = doc.createElement('suffix');
      remote.appendChild(prefix);
      remote.appendChild(suffix);

      ctx.renderServerSide(template, { remote });
      let serializedRemote = ctx.delegate.serialize(remote);
      let b = blockStack();
      assertSerializedInElement(
        serializedRemote,
        strip`
      ${b(2)}
      <inner>Wat Wat</inner>
      ${b(2)}
    `
      );

      doc = ctx.delegate.clientDoc;
      let clientRemote = (remote = doc.createElement('remote'));
      let host = doc.createElement('div');
      host.appendChild(ctx.element);
      host.appendChild(clientRemote);
      replaceHTML(clientRemote, serializedRemote);
      ctx.element = assertingElement(host.firstChild);

      ctx.renderClientSide(template, { remote: clientRemote });
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assert.strictEqual(
        toInnerHTML(clientRemote),
        '<prefix></prefix><suffix></suffix><inner>Wat Wat</inner>'
      );
    });

    test('in-element with insertBefore=element can rehydrate', (ctx) => {
      let template = strip`
      <outer><prefix></prefix>
      {{#in-element this.remote insertBefore=this.prefix}}<inner>Wat Wat</inner>{{/in-element}}
      <suffix></suffix></outer>
      `;
      let doc = ctx.delegate.serverDoc;
      let remote = doc.createElement('remote');
      let prefix = doc.createElement('prefix');
      let suffix = doc.createElement('suffix');
      remote.appendChild(prefix);
      remote.appendChild(suffix);

      ctx.renderServerSide(template, { remote, prefix, suffix });
      let serializedRemote = ctx.delegate.serialize(remote);
      let b = blockStack();
      assertSerializedInElement(
        serializedRemote,
        strip`
      ${b(2)}
      <inner>Wat Wat</inner>
      ${b(2)}
      <prefix></prefix>
      <suffix></suffix>
    `
      );

      doc = ctx.delegate.clientDoc;
      let clientRemote = (remote = doc.createElement('remote'));
      let host = doc.createElement('div');
      host.appendChild(ctx.element);
      host.appendChild(clientRemote);
      replaceHTML(clientRemote, serializedRemote);
      ctx.element = assertingElement(host.firstChild);
      let clientPrefix = clientRemote.childNodes[4];

      ctx.renderClientSide(template, { remote: clientRemote, prefix: clientPrefix });
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assert.strictEqual(
        toInnerHTML(clientRemote),
        '<inner>Wat Wat</inner><prefix></prefix><suffix></suffix>'
      );
    });

    test('in-element can rehydrate into pre-existing content', (ctx) => {
      let template = strip`
      <outer>
      {{#in-element this.remote insertBefore=undefined}}<inner>Wat Wat</inner>{{/in-element}}
      </outer>
      `;
      let doc = ctx.delegate.serverDoc;
      let remote = doc.createElement('remote');

      ctx.renderServerSide(template, { remote });
      let serializedRemote = '<preexisting><preexisting>';

      doc = ctx.delegate.clientDoc;
      let clientRemote = (remote = doc.createElement('remote'));
      let host = doc.createElement('div');
      host.appendChild(ctx.element);
      host.appendChild(clientRemote);
      replaceHTML(clientRemote, serializedRemote);
      ctx.element = assertingElement(host.firstChild);

      ctx.renderClientSide(template, { remote: clientRemote });
      ctx.assertRehydrationStats({ nodesRemoved: 1 });
      ctx.assert.strictEqual(toInnerHTML(clientRemote), '<inner>Wat Wat</inner>');
    });

    test('in-element with insertBefore=null can rehydrate into pre-existing content', (ctx) => {
      let template = strip`
      <outer>
      {{#in-element this.remote insertBefore=null}}<inner>Wat Wat</inner>{{/in-element}}
      </outer>
      `;
      let doc = ctx.delegate.serverDoc;
      let remote = doc.createElement('remote');
      let preexisting = doc.createElement('preexisting');
      remote.appendChild(preexisting);

      ctx.renderServerSide(template, { remote, preexisting });
      let serializedRemote = '<preexisting></preexisting>';

      doc = ctx.delegate.clientDoc;
      let clientRemote = (remote = doc.createElement('remote'));
      let host = doc.createElement('div');
      host.appendChild(ctx.element);
      host.appendChild(clientRemote);
      replaceHTML(clientRemote, serializedRemote);
      ctx.element = assertingElement(host.firstChild);

      ctx.renderClientSide(template, { remote: clientRemote });
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assert.strictEqual(
        toInnerHTML(clientRemote),
        '<preexisting></preexisting><inner>Wat Wat</inner>'
      );
    });

    test('in-element with insertBefore=element can rehydrate into pre-existing content', (ctx) => {
      let template = strip`
      <outer>
      {{#in-element this.remote insertBefore=this.preexisting}}<inner>Wat Wat</inner>{{/in-element}}
      </outer>
      `;
      let doc = ctx.delegate.serverDoc;
      let remote = doc.createElement('remote');
      let prefix = doc.createElement('prefix');
      let preexisting = doc.createElement('preexisting');
      remote.appendChild(prefix);
      remote.appendChild(preexisting);

      ctx.renderServerSide(template, { remote, prefix, preexisting });
      let serializedRemote = '<prefix></prefix><preexisting></preexisting>';

      doc = ctx.delegate.clientDoc;
      let clientRemote = (remote = doc.createElement('remote'));
      let host = doc.createElement('div');
      host.appendChild(ctx.element);
      host.appendChild(clientRemote);
      replaceHTML(clientRemote, serializedRemote);
      let clientPreexisting = clientRemote.childNodes[1];
      ctx.element = assertingElement(host.firstChild);

      ctx.renderClientSide(template, {
        remote: clientRemote,
        prefix,
        preexisting: clientPreexisting,
      });
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assert.strictEqual(
        toInnerHTML(clientRemote),
        '<prefix></prefix><inner>Wat Wat</inner><preexisting></preexisting>'
      );
    });

    test('nested in-element can rehydrate', (ctx) => {
      let template = strip`
    <outer>
      {{#in-element this.remoteParent}}
        <inner>{{#in-element this.remoteChild}}Wat Wat{{/in-element}}</inner>
      {{/in-element}}
    </outer>
    `;
      let doc = ctx.delegate.serverDoc;
      let remoteParent = doc.createElement('remote');
      let remoteChild = doc.createElement('other');

      ctx.renderServerSide(template, { remoteParent, remoteChild });
      let serializedParentRemote = ctx.delegate.serialize(remoteParent);
      let serializedRemoteChild = ctx.delegate.serialize(remoteChild);
      let b = blockStack();
      assertSerializedInElement(
        serializedParentRemote,
        strip`
      ${b(2)}
        <inner>
          ${b(3)}<!---->${b(3)}
        </inner>
      ${b(2)}
    `,
        'Serialized parent remote'
      );
      assertSerializedInElement(
        serializedRemoteChild,
        strip`
      ${b(4)}Wat Wat${b(4)}
    `,
        'Serialized nested remote'
      );
      doc = ctx.delegate.clientDoc;
      let clientRemoteParent = doc.createElement('remote');
      let clientRemoteChild = doc.createElement('other');
      let host = doc.createElement('div');
      host.appendChild(ctx.element);
      host.appendChild(clientRemoteParent);
      host.appendChild(clientRemoteChild);

      replaceHTML(clientRemoteParent, serializedParentRemote);
      replaceHTML(clientRemoteChild, serializedRemoteChild);
      ctx.element = assertingElement(host.firstChild);
      ctx.renderClientSide(template, {
        remoteParent: clientRemoteParent,
        remoteChild: clientRemoteChild,
      });
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assert.strictEqual(toInnerHTML(clientRemoteParent), '<inner><!----></inner>');
      ctx.assert.strictEqual(toInnerHTML(clientRemoteChild), 'Wat Wat');
    });

    test('svg elements', (ctx) => {
      let template = '<svg>{{#if this.isTrue}}<circle />{{/if}}</svg><p>Hello</p>';
      ctx.renderServerSide(template, { isTrue: true });
      let b = blockStack();
      ctx.assertHTML(strip`
      ${b(0)}
      <svg>
        ${b(1)}
        <circle />
        ${b(1)}
      </svg>
      <p>Hello</p>
      ${b(0)}
    `);
      ctx.renderClientSide(template, { isTrue: true });
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML(strip`
      <svg>
      <circle />
      </svg>
      <p>Hello</p>
    `);
      ctx.assertStableRerender();
    });

    test('title tag', (ctx) => {
      let template =
        '<title>{{this.pageTitle}} some {{{this.other}}}{{this.thing}} <b>hey!</b></title>';
      ctx.renderServerSide(template, { pageTitle: 'kiwi', other: 'other', thing: 'thing' });
      let b = blockStack();
      ctx.assertHTML(strip`
      ${b(0)}
      <title>
        kiwi some otherthing <b>hey!</b>
      </title>
      ${b(0)}
    `);
      ctx.renderClientSide(template, { pageTitle: 'kiwi', other: 'other', thing: 'thing' });
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML(strip`
      <title>
        kiwi some otherthing <b>hey!</b>
      </title>
    `);
      ctx.assertStableRerender();
    });

    test('script tag', (ctx) => {
      let template = strip`
      <script type="application/ld+json">{{this.data}}</script>
      <script type="application/ld+json">{{this.otherData}}</script>
    `;
      ctx.renderServerSide(template, { data: '{ "status": "ok" }', otherData: '{ "code": 200 }' });
      let b = blockStack();
      ctx.assertHTML(strip`
      ${b(0)}
      <script type="application/ld+json">
        { "status": "ok" }
      </script>

      <script type="application/ld+json">
        { "code": 200 }
      </script>
      ${b(0)}
    `);
      ctx.renderClientSide(template, { data: '{ "status": "ok" }', otherData: '{ "code": 200 }' });
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML(strip`
      <script type="application/ld+json">
        { "status": "ok" }
      </script>

      <script type="application/ld+json">
        { "code": 200 }
      </script>
    `);
      ctx.assertStableRerender();
    });

    test('style tag', (ctx) => {
      let template = '<style>{{this.selector}} { color: #fff; }</style>';
      ctx.renderServerSide(template, { selector: 'div' });
      let b = blockStack();
      ctx.assertHTML(strip`
      ${b(0)}
      <style>
        div { color: #fff; }
      </style>
      ${b(0)}
    `);
      ctx.renderClientSide(template, { selector: 'div' });
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML(strip`
      <style>
        div { color: #fff; }
      </style>
    `);
      ctx.assertStableRerender();
    });

    test('clearing bounds', (ctx) => {
      let template = strip`
      {{#if this.isTrue}}
        {{#each this.items key="id" as |item i|}}
          <p>{{item}}-{{i}}</p>
        {{/each}}
      {{/if}}
    `;
      ctx.renderServerSide(template, { isTrue: true, items: [1, 2] });
      let b = blockStack();
      ctx.assertHTML(strip`
      ${b(0)}
      ${b(1)}
      ${b(2)}
      ${b(3)}
      ${b(4)}
      <p>
        ${b(5)}
        1
        ${b(5)}
        -
        ${b(5)}
        0
        ${b(5)}
      </p>
      ${b(4)}
      ${b(4)}
      <p>
        ${b(5)}
        2
        ${b(5)}
        -
        ${b(5)}
        1
        ${b(5)}
      </p>
      ${b(4)}
      ${b(3)}
      ${b(2)}
      ${b(1)}
      ${b(0)}
    `);

      ctx.renderClientSide(template, { isTrue: false, items: [3, 4] });
      // Removes the block and each <p>
      ctx.assertRehydrationStats({ nodesRemoved: 2 });
      ctx.assertHTML('<!---->');
      ctx.assertStableRerender();
    });

    test('top-level clearing bounds', (ctx) => {
      let template = strip`
      <top>
      {{#if this.isTrue}}
        <inside>
        {{#each this.items key="id" as |item i|}}
          <p>{{item}}-{{i}}</p>
        {{/each}}
        </inside>
      {{/if}}
      </top>
      {{#if this.isFalse}}
        {{#each this.items key="id" as |item i|}}
          <p>{{item}}-{{i}}</p>
        {{/each}}
      {{/if}}
    `;
      ctx.renderServerSide(template, { isTrue: true, items: [1, 2], isFalse: false });
      let b = blockStack();
      ctx.assertHTML(strip`
      ${b(0)}
      <top>
        ${b(1)}
        <inside>
          ${b(2)}
          ${b(3)}
          ${b(4)}
          <p>
            ${b(5)}
            1
            ${b(5)}
            -
            ${b(5)}
            0
            ${b(5)}
          </p>
          ${b(4)}
          ${b(4)}
          <p>
            ${b(5)}
            2
            ${b(5)}
            -
            ${b(5)}
            1
            ${b(5)}
          </p>
          ${b(4)}
          ${b(3)}
          ${b(2)}
        </inside>
        ${b(1)}
      </top>
      ${b(1)}
      <!---->
      ${b(1)}
      ${b(0)}
    `);

      ctx.renderClientSide(template, { isTrue: false, items: [3, 4], isFalse: true });
      // Clears block markers for both and removes `inside`
      ctx.assertRehydrationStats({ nodesRemoved: 1 });
      ctx.assertHTML('<top><!----></top><p>3-0</p><p>4-1</p>');
      ctx.assertStableRerender();
    });

    test('#each rehydration', (ctx) => {
      let template = "{{#each this.items key='id' as |item|}}<p>{{item}}</p>{{/each}}";
      ctx.renderServerSide(template, { items: [1, 2, 3] });
      let b = blockStack();
      ctx.assertHTML(strip`
      ${b(0)}
      ${b(1)}
      ${b(2)}
      ${b(3)}
      <p>
        ${b(4)}
        1
        ${b(4)}
      </p>
      ${b(3)}
      ${b(3)}
      <p>
        ${b(4)}
        2
        ${b(4)}
      </p>
      ${b(3)}
      ${b(3)}
      <p>
        ${b(4)}
        3
        ${b(4)}
      </p>
      ${b(3)}
      ${b(2)}
      ${b(1)}
      ${b(0)}
    `);

      ctx.renderClientSide(template, { items: [1, 2, 4] });
      ctx.assertRehydrationStats({ nodesRemoved: 0 });
      ctx.assertHTML(strip`
      <p>1</p>
      <p>2</p>
      <p>4</p>
    `);
      ctx.assertStableRerender();
    });
  }
);

RehydrationTests({
  delegate: RehydrationDelegate,
  template: 'all',
});

// On the server, elements come after block start boundaries.
const SERVER_ELEMENT_OFFSET = 2;

// the Dynamic test type is using {{component 'foo'}} style invocation
// and therefore an extra node is added delineating the block start
const SERVER_DYNAMIC_OFFSET = 3;

@suite('Rehydrating components')
class RehydratingComponents extends RehydrationContext {
  _buildComponent(blueprint: ComponentBlueprint, properties: Dict<unknown> = {}) {
    let template = this.buildComponent(blueprint);
    if (this.testType === 'Dynamic' && properties['componentName'] === undefined) {
      properties['componentName'] = blueprint.name || GLIMMER_TEST_COMPONENT;
    }
    return template;
  }

  assertServerComponent(html: string, attrs?: Dict) {
    let elementIndex = this.testType === 'Dynamic' ? SERVER_DYNAMIC_OFFSET : SERVER_ELEMENT_OFFSET;

    let element = assertingElement(this.element.childNodes[elementIndex]);

    switch (this.testType) {
      case 'TemplateOnly':
        assertElementShape(element, 'div', attrs ?? {}, html);
        break;

      case 'Glimmer':
        assertElementShape(element, 'div', attrs ?? {}, html);
        break;
      case 'Curly':
        assertEmberishElement(element, 'div', attrs, html);
        break;
      case 'Dynamic':
        assertEmberishElement(element, 'div', attrs, html);
        break;
    }
  }

  override renderServerSide(blueprint: ComponentBlueprint, properties: Dict<unknown> = {}) {
    let template = this._buildComponent(blueprint, properties);
    super.renderServerSide(template, properties);
  }

  override renderClientSide(blueprint: ComponentBlueprint, properties: Dict<unknown> = {}) {
    let template = this._buildComponent(blueprint, properties);
    super.renderClientSide(template, properties);
  }

  @render
  'Component invocations'() {
    let layout = 'Hello {{@name}}';
    let args = { name: 'this.name' };
    this.renderServerSide(
      {
        layout,
        args,
      },
      { name: 'Filewatcher' }
    );
    let b = blockStack();
    let id = this.testType === 'Dynamic' ? 3 : 2;
    this.assertServerComponent(`Hello ${b(id)}Filewatcher${b(id)}`);

    this.renderClientSide(
      {
        layout,
        args,
      },
      { name: 'Filewatcher' }
    );
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertComponent('Hello Filewatcher');
    this.assertStableRerender();
  }

  @render
  'Mismatched Component invocations'() {
    let layout = 'Hello {{@name}}';
    let args = { name: 'this.name' };
    this.renderServerSide(
      {
        layout,
        args,
      },
      { name: 'Filewatcher' }
    );
    let b = blockStack();
    let id = this.testType === 'Dynamic' ? 3 : 2;
    this.assertServerComponent(`Hello ${b(id)}Filewatcher${b(id)}`);

    this.renderClientSide(
      {
        layout,
        args,
      },
      { name: 'Chad' }
    );
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertComponent('Hello Chad');
    this.assertStableRerender();
  }

  @render
  '<p> invoking a block which emits a <div>'() {
    let componentToRender = {
      layout: '<p>hello {{#if @show}}<div>world!</div>{{/if}}</p>',
      args: { show: 'this.show' },
    };

    this.renderServerSide(componentToRender, { show: true });
    let b = blockStack();

    let id = this.testType === 'Dynamic' ? 3 : 2;

    // assert that we are in a "browser corrected" state (note the `</p>` before the `<div>world!</div>`)
    if (isIE11) {
      // IE11 doesn't behave the same as modern browsers
      this.assertServerComponent(`<p>hello ${b(id)}<div>world!</div>${b(id)}<p></p>`);
    } else {
      this.assertServerComponent(`<p>hello ${b(id)}</p><div>world!</div>${b(id)}<p></p>`);
    }

    this.renderClientSide(componentToRender, { show: true });
    this.assertComponent('<p>hello <div>world!</div></p>');

    this.assertRehydrationStats({ nodesRemoved: 2 });
    this.assertStableNodes();
  }

  @render
  'Component invocations with block params'() {
    let layout = 'Hello {{yield @name}}';
    let template = '{{this.name}}';
    let blockParams = ['name'];
    let args = { name: 'this.name' };

    this.renderServerSide(
      {
        layout,
        template,
        args,
        blockParams,
      },
      { name: 'Filewatcher' }
    );
    let b = blockStack();
    let id = this.testType === 'Dynamic' ? 3 : 2;
    this.assertServerComponent(`Hello ${b(id)}Filewatcher${b(id)}`);

    this.renderClientSide(
      {
        layout,
        template,
        args,
        blockParams,
      },
      { name: 'Filewatcher' }
    );
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertComponent('Hello Filewatcher');
    this.assertStableRerender();
  }

  @render
  'Mismatched Component invocations with block params'() {
    let layout = 'Hello {{yield @name}}';
    let template = '{{this.name}}';
    let blockParams = ['name'];
    let args = { name: 'this.name' };

    this.renderServerSide(
      {
        layout,
        template,
        args,
        blockParams,
      },
      { name: 'Filewatcher' }
    );
    let b = blockStack();
    let id = this.testType === 'Dynamic' ? 3 : 2;
    this.assertServerComponent(`Hello ${b(id)}Filewatcher${b(id)}`);

    this.renderClientSide(
      {
        layout,
        template,
        args,
        blockParams,
      },
      { name: 'Chad' }
    );
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertComponent('Hello Chad');
    this.assertStableRerender();
  }

  @render
  'Component invocations with template'() {
    let layout = 'Hello {{yield}}';
    let template = 'Filewatcher';
    this.renderServerSide(
      {
        layout,
        template,
      },
      { name: 'Filewatcher' }
    );
    this.assertServerComponent(`Hello <!--%|%-->Filewatcher`);

    this.renderClientSide({
      layout,
      template,
    });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertComponent('Hello Filewatcher');
    this.assertStableRerender();
  }

  @render
  'Mismatched Component invocations with template'() {
    let layout = 'Hello {{yield}}';
    let template = 'Filewatcher';
    this.renderServerSide({
      layout,
      template,
    });
    this.assertServerComponent(`Hello <!--%|%-->Filewatcher`);

    this.renderClientSide({
      layout,
      template: 'Chad',
    });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertComponent('Hello Chad');
    this.assertStableRerender();
  }

  @render
  'Component invocations with empty args'() {
    let layout = 'Hello {{@foo}}';
    this.renderServerSide({
      layout,
    });
    let b = blockStack();
    let id = this.testType === 'Dynamic' ? 3 : 2;
    this.assertServerComponent(`Hello ${b(id)}<!--% %-->${b(id)}`);

    this.renderClientSide({
      layout,
    });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertComponent('Hello ');
    this.assertStableRerender();
  }

  @render
  'Multiple invocations'() {
    let name;
    let template;

    let emberishComponent = false;
    if (this.testType === 'Dynamic' || this.testType === 'Curly') {
      name = 'foo-bar';
      template = '{{#foo-bar}}World{{/foo-bar}}';
      emberishComponent = true;
    } else {
      name = 'FooBar';
      template = '<FooBar>World</FooBar>';
    }

    this.register.component(this.testType, name, 'Hello {{yield}}');
    let layout = `{{yield}}`;
    this.renderServerSide({
      layout,
      template,
    });
    let b = blockStack();
    if (emberishComponent) {
      let wrapper = assertingElement(firstElementChild(this.element));

      // injects wrapper elements
      this.assert.strictEqual(wrapper.getAttribute('class'), 'ember-view');
      this.assert.strictEqual(toTextContent(wrapper), 'Hello World');
      // this.assert.strictEqual(this.element.textContent, 'Hello World');
    } else {
      this.assertServerComponent(`${b(2)}Hello <!--%|%-->World${b(2)}`);
    }

    this.renderClientSide({
      layout,
      template,
    });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assert.strictEqual(toTextContent(this.element), 'Hello World');
    this.assertStableRerender();
  }

  @render
  'Mismatched Multiple invocations'() {
    let name;
    let template;

    let emberishComponent = false;
    if (this.testType === 'Dynamic' || this.testType === 'Curly') {
      name = 'foo-bar';
      template = '{{#foo-bar}}World{{/foo-bar}}';
      emberishComponent = true;
    } else {
      name = 'FooBar';
      template = '<FooBar>World</FooBar>';
    }

    this.register.component(this.testType, name, 'Hello {{yield}}');
    let layout = `{{yield}}`;
    this.renderServerSide({
      layout,
      template,
    });
    let b = blockStack();
    if (emberishComponent) {
      let wrapper = assertingElement(firstElementChild(this.element));
      // injects wrapper elements
      this.assert.strictEqual(wrapper.getAttribute('class'), 'ember-view');
      this.assert.strictEqual(toTextContent(this.element), 'Hello World');
    } else {
      this.assertServerComponent(`${b(2)}Hello <!--%|%-->World${b(2)}`);
    }

    if (this.testType === 'Dynamic' || this.testType === 'Curly') {
      template = '{{#foo-bar}}Chad{{/foo-bar}}';
    } else {
      template = '<FooBar>Chad</FooBar>';
    }

    this.renderClientSide({
      layout,
      template,
    });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assert.strictEqual(toTextContent(this.element), 'Hello Chad');
    this.assertStableRerender();
  }

  @render
  'interacting with builtins'() {
    let layout = strip`
      <ul>
        {{#each @items key="id" as |item i|}}
          {{#if item.show}}
            <li>{{item.name}}</li>
          {{else}}
            {{yield i}}
          {{/if}}
        {{/each}}
      </ul>`;
    this.register.helper(
      'even',
      (params: ReadonlyArray<unknown>) => (params[0] as number) % 2 === 0
    );
    let template = '{{#if (even i)}}<FooBar @count={{i}} />{{/if}}';
    this.register.component('TemplateOnly', 'FooBar', '<li>{{@count}}</li>');
    let blockParams = ['i'];
    let args = { items: 'this.items' };

    this.renderServerSide(
      {
        layout,
        template,
        blockParams,
        args,
      },
      {
        items: [
          { show: true, name: 'Industry' },
          { show: false, name: 'Standard' },
          { show: false, name: 'Components' },
        ],
      }
    );

    let b = blockStack();

    let id = (num: number) => (this.testType === 'Dynamic' ? num + 1 : num);

    this.assertServerComponent(strip`
      <ul>
        ${b(id(2))}
        ${b(id(3))}
        ${b(id(4))}
        ${b(id(5))}
        <li>
          ${b(id(6))}
          Industry
          ${b(id(6))}
        </li>
        ${b(id(5))}
        ${b(id(4))}
        ${b(id(4))}
        ${b(id(5))}
        ${b(id(6))}
        <!---->
        ${b(id(6))}
        ${b(id(5))}
        ${b(id(4))}
        ${b(id(4))}
        ${b(id(5))}
        ${b(id(6))}
        ${b(id(7))}
        <li>
          ${b(id(8))}
          2
          ${b(id(8))}
        </li>
        ${b(id(7))}
        ${b(id(6))}
        ${b(id(5))}
        ${b(id(4))}
        ${b(id(3))}
        ${b(id(2))}
      </ul>
    `);

    this.renderClientSide(
      {
        layout,
        template,
        blockParams,
        args,
      },
      {
        items: [
          { show: true, name: 'Industry' },
          { show: false, name: 'Standard' },
          { show: false, name: 'Components' },
        ],
      }
    );

    this.assertComponent('<ul><li>Industry</li><!----><li>2</li></ul>');
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertStableRerender();
  }

  @render
  'mismatched interacting with builtins'() {
    let layout = strip`
      <ul>
        {{#each @items key="id" as |item i|}}
          {{#if item.show}}
            <li>{{item.name}}</li>
          {{else}}
            {{yield i}}
          {{/if}}
        {{/each}}
      </ul>`;
    this.register.helper(
      'even',
      (params: ReadonlyArray<unknown>) => (params[0] as number) % 2 === 0
    );
    let template = '{{#if (even i)}}<FooBar @count={{i}} />{{/if}}';
    this.register.component('TemplateOnly', 'FooBar', '<li>{{@count}}</li>');
    let blockParams = ['i'];
    let args = { items: 'this.items' };

    this.renderServerSide(
      {
        layout,
        template,
        blockParams,
        args,
      },
      {
        items: [
          { show: true, name: 'Industry' },
          { show: false, name: 'Standard' },
          { show: false, name: 'Components' },
        ],
      }
    );

    let b = blockStack();

    let id = (num: number) => (this.testType === 'Dynamic' ? num + 1 : num);

    this.assertServerComponent(strip`
      <ul>
        ${b(id(2))}
        ${b(id(3))}
        ${b(id(4))}
        ${b(id(5))}
        <li>
          ${b(id(6))}
          Industry
          ${b(id(6))}
        </li>
        ${b(id(5))}
        ${b(id(4))}
        ${b(id(4))}
        ${b(id(5))}
        ${b(id(6))}
        <!---->
        ${b(id(6))}
        ${b(id(5))}
        ${b(id(4))}
        ${b(id(4))}
        ${b(id(5))}
        ${b(id(6))}
        ${b(id(7))}
        <li>
          ${b(id(8))}
          2
          ${b(id(8))}
        </li>
        ${b(id(7))}
        ${b(id(6))}
        ${b(id(5))}
        ${b(id(4))}
        ${b(id(3))}
        ${b(id(2))}
      </ul>
    `);

    this.renderClientSide(
      {
        layout,
        template,
        blockParams,
        args,
      },
      {
        items: [
          { show: true, name: 'Industry' },
          { show: true, name: 'Standard' },
          { show: true, name: 'Components' },
        ],
      }
    );

    this.assertRehydrationStats({ nodesRemoved: 1 });
    this.assertComponent('<ul><li>Industry</li><li>Standard</li><li>Components</li></ul>');
  }

  @render
  'mismatched blocks interacting with builtins'() {
    let layout = strip`
      <ul>
        {{#each @items key="id" as |item i|}}
          {{#if item.show}}
            <li>{{item.name}}</li>
          {{else}}
            {{yield i}}
          {{/if}}
        {{/each}}
      </ul>
      <ul>
        {{#each @things key="id" as |item i|}}
          {{#if item.show}}
            <li>{{item.name}}</li>
          {{else}}
            {{yield i}}
          {{/if}}
        {{/each}}
      </ul>
    `;
    this.register.helper(
      'even',
      (params: ReadonlyArray<unknown>) => (params[0] as number) % 2 === 0
    );
    let template = '{{#if (even i)}}<FooBar @count={{i}} />{{/if}}';
    this.register.component('TemplateOnly', 'FooBar', '<li>{{@count}}</li>');
    let blockParams = ['i'];
    let args = { items: 'this.items', things: 'this.things' };

    this.renderServerSide(
      {
        layout,
        template,
        blockParams,
        args,
      },
      {
        items: [
          { show: true, name: 'Industry' },
          { show: false, name: 'Standard' },
          { show: false, name: 'Components' },
        ],
      }
    );

    let b = blockStack();

    let id = (num: number) => (this.testType === 'Dynamic' ? num + 1 : num);

    this.assertServerComponent(strip`
      <ul>
        ${b(id(2))}
        ${b(id(3))}
        ${b(id(4))}
        ${b(id(5))}
        <li>
          ${b(id(6))}
          Industry
          ${b(id(6))}
        </li>
        ${b(id(5))}
        ${b(id(4))}
        ${b(id(4))}
        ${b(id(5))}
        ${b(id(6))}
        <!---->
        ${b(id(6))}
        ${b(id(5))}
        ${b(id(4))}
        ${b(id(4))}
        ${b(id(5))}
        ${b(id(6))}
        ${b(id(7))}
        <li>
          ${b(id(8))}
          2
          ${b(id(8))}
        </li>
        ${b(id(7))}
        ${b(id(6))}
        ${b(id(5))}
        ${b(id(4))}
        ${b(id(3))}
        ${b(id(2))}
      </ul>
      <ul>
        ${b(id(2))}
        <!---->
        ${b(id(2))}
      </ul>
    `);

    this.renderClientSide(
      {
        layout,
        template,
        blockParams,
        args,
      },
      {
        things: [
          { show: true, name: 'Industry' },
          { show: true, name: 'Standard' },
          { show: false, name: 'Components' },
        ],
      }
    );

    this.assertRehydrationStats({ nodesRemoved: 2 });
    this.assertComponent('<ul><!----></ul><ul><li>Industry</li><li>Standard</li><li>2</li></ul>');
  }
}

jitSuite(DynamicInitialRenderSuite, {
  test: ['error-recovery'],
});

componentSuite(RehydratingComponents, RehydrationDelegate);
