import type { Dict, Nullable, SimpleElement } from '@glimmer/interfaces';
import type { SafeString } from '@glimmer/runtime';
import type { ComponentBlueprint, Content } from '@glimmer-workspace/integration-tests';
import { castToBrowser, expect } from '@glimmer/debug-util';
import {
  assertElementShape,
  assertEmberishElement,
  assertingElement,
  assertSerializedInElement,
  blockStack,
  CLOSE,
  componentSuite,
  content,
  EMPTY,
  equalTokens,
  firstElementChild,
  GLIMMER_TEST_COMPONENT,
  InitialRenderSuite,
  jitSuite,
  OPEN,
  RehydrationDelegate,
  replaceHTML,
  strip,
  suite,
  test,
  toInnerHTML,
  toTextContent,
} from '@glimmer-workspace/integration-tests';

class RenderTests extends InitialRenderSuite {
  static override suiteName = 'initial render (client)';
  override name = 'client';
}

class AbstractRehydrationTests extends InitialRenderSuite {
  override name = 'rehydration';
  declare protected delegate: RehydrationDelegate;
  declare protected serverOutput: Nullable<string>;

  renderServerSide(
    template: string | ComponentBlueprint,
    context: Dict,
    element: SimpleElement | undefined = undefined
  ): void {
    this.serverOutput = this.delegate.renderServerSide(
      template as string,
      context,
      () => this.takeSnapshot(),
      element
    );
    replaceHTML(this.element, this.serverOutput);
  }

  renderClientSide(template: string | ComponentBlueprint, context: Dict): void {
    this.context = context;
    this.renderResult = this.delegate.renderClientSide(template as string, context, this.element);
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

class Rehydration extends AbstractRehydrationTests {
  static override suiteName = 'rehydration';

  @test
  'rehydrates into element with pre-existing content'() {
    let rootElement = this.delegate.serverDoc.createElement('div');
    let extraContent = this.delegate.serverDoc.createElement('noscript');
    rootElement.appendChild(extraContent);

    let noScriptString = '<noscript></noscript>';
    let template = '<div>Hi!</div>';
    this.renderServerSide(template, {}, rootElement);
    this.assertExactServerOutput(content([noScriptString, OPEN, template, CLOSE]));
    this.renderClientSide(template, {});
    this.assertHTML('<noscript></noscript><div>Hi!</div>');
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertStableNodes();
  }

  @test
  'handles non-empty trusted content (triple-curlies)'() {
    let template = '<div>{{{this.value}}}</div>';
    let obj: { value: string } = { value: 'foo' };
    this.renderServerSide(template, obj);
    this.renderClientSide(template, obj);
    this.assertHTML('<div>foo</div>');
  }

  @test
  'handles empty trusted content (triple-curlies)'() {
    let template = '<div>{{{this.value}}}</div>';
    let obj: { value: string } = { value: '' };
    this.renderServerSide(template, obj);
    this.renderClientSide(template, obj);
    this.assertHTML('<div></div>');
  }

  @test
  'handles empty trusted content (html safe string)'() {
    let template = '<div>{{this.value}}</div>';

    let safeString: SafeString = {
      toHTML() {
        return '';
      },
    };
    let obj = { value: safeString };

    this.renderServerSide(template, obj);
    this.renderClientSide(template, obj);
    this.assertHTML('<div></div>');
  }

  @test
  'table with omitted tbody'() {
    let template = '<table><tr><td>standards</td></tr></table>';
    this.renderServerSide(template, {});
    this.assertServerOutput('<table><tbody><tr><td>standards</td></tr></tbody></table>');
    this.renderClientSide(template, {});
    this.assertHTML('<table><tbody><tr><td>standards</td></tr></tbody></table>');
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertStableNodes();
  }

  @test
  'table with thead'() {
    let template = '<table><thead><tr><th>standards</th></tr></thead></table>';
    this.renderServerSide(template, {});
    this.assertServerOutput('<table><thead><tr><th>standards</th></tr></thead></table>');
    this.renderClientSide(template, {});
    this.assertHTML('<table><thead><tr><th>standards</th></tr></thead></table>');
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertStableNodes();
  }

  @test
  'table with tfoot'() {
    let template = '<table><tfoot><tr><th>standards</th></tr></tfoot></table>';
    this.renderServerSide(template, {});
    this.assertServerOutput('<table><tfoot><tr><th>standards</th></tr></tfoot></table>');
    this.renderClientSide(template, {});
    this.assertHTML('<table><tfoot><tr><th>standards</th></tr></tfoot></table>');
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertStableNodes();
  }

  @test
  'mismatched text nodes'() {
    let template = '{{this.content}}';
    this.renderServerSide(template, { content: 'hello' });
    this.assertServerOutput(OPEN, 'hello', CLOSE);

    this.renderClientSide(template, { content: 'goodbye' });
    this.assertHTML('goodbye');
    // Just repairs the value of the text node
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertStableRerender();
  }

  @test
  'mismatched text nodes (server-render empty)'() {
    let template = '{{this.content}} world';
    this.renderServerSide(template, { content: '' });
    this.assertServerOutput(OPEN, EMPTY, CLOSE, ' world');

    this.renderClientSide(template, { content: 'hello' });
    this.assertHTML('hello world');
    // Just repairs the value of the text node
    this.assertRehydrationStats({ nodesRemoved: 0 });

    // TODO handle % % in the testing DSL
    // this.assertStableNodes();
    this.assertStableRerender();
  }

  @test
  'missing closing block within multiple text nodes'() {
    let template = '<div>a {{this.b}}{{this.c}}{{this.d}}</div>';
    let context = { b: '', c: '', d: '' };

    this.renderServerSide(template, context);

    let b = blockStack();
    this.assertServerOutput(
      `<div>a ${b(1)}<!--% %-->${b(1)}${b(1)}<!--% %-->${b(1)}${b(1)}<!--% %-->${b(1)}</div>`
    );

    // remove the first `<!--%-b:1%-->`
    let element = castToBrowser(this.element, 'HTML');
    let [div] = this.guardArray({ children: element.children }, { min: 1 });
    let commentToRemove = this.guardArray({ children: div.childNodes }, { min: 4 })[3];
    div.removeChild(commentToRemove);

    this.renderClientSide(template, context);
    this.assertHTML('<div>a </div>');
    this.assertRehydrationStats({ nodesRemoved: 0 });

    // TODO: handle % % in the testing DSL
    // this.assertStableNodes();
    this.assertStableRerender();
  }

  @test
  'resumes correct block after reenabling rehydration'() {
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

    this.renderServerSide(template, context);

    let b = blockStack();
    this.assertServerOutput(`<div>${b(1)}<!---->${b(1)}<after-a></after-a></div>`);

    this.renderClientSide(template, { a: true, b: true, c: true });
    this.assertHTML(
      '<div><inside-c></inside-c><after-c></after-c><after-b></after-b><after-a></after-a></div>'
    );
    this.assertRehydrationStats({ nodesRemoved: 0 });

    // TODO: handle % % in the testing DSL
    // this.assertStableNodes();
    this.assertStableRerender();
  }

  @test
  'mismatched elements'() {
    let template = '{{#if this.admin}}<div>hi admin</div>{{else}}<p>HAXOR</p>{{/if}}';
    this.renderServerSide(template, { admin: true });
    this.assertServerOutput(OPEN, '<div>hi admin</div>', CLOSE);

    this.renderClientSide(template, { admin: false });
    this.assertRehydrationStats({ nodesRemoved: 1 });
    this.assertHTML('<p>HAXOR</p>');
    this.assertStableRerender();
  }

  @test
  'text nodes surrounding single line handlebars comments'() {
    let template = 'hello{{! hmm, why is this here?! }} world';
    this.renderServerSide(template, {});
    this.assertServerOutput('hello', '<!--%|%-->', ' world');

    this.renderClientSide(template, {});
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML('hello world');
    this.assertStableRerender();
  }

  @test
  'text nodes surrounding multi line handlebars comments'() {
    let template = 'hello{{!-- hmm, why is this here?! --}} world';
    this.renderServerSide(template, {});
    this.assertServerOutput('hello', '<!--%|%-->', ' world');

    this.renderClientSide(template, {});
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML('hello world');
    this.assertStableRerender();
  }

  @test
  'text nodes surrounding "stand alone" handlebars comment'() {
    let template = '<div></div>\n{{! hmm, why is this here?! }}\n<div></div>';
    this.renderServerSide(template, {});
    this.assertServerOutput('<div></div>', '\n', '<div></div>');

    this.renderClientSide(template, {});
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML('<div></div>\n<div></div>');
    this.assertStableRerender();
  }

  @test
  'extra nodes at the end'() {
    let template =
      '{{#if this.admin}}<div>hi admin</div>{{else}}<div>HAXOR{{this.stopHaxing}}</div>{{/if}}';
    this.renderServerSide(template, { admin: false, stopHaxing: 'stahp' });
    this.assertServerOutput(OPEN, '<div>HAXOR', OPEN, 'stahp', CLOSE, '</div>', CLOSE);

    this.renderClientSide(template, { admin: true });
    this.assertRehydrationStats({ nodesRemoved: 1 });
    this.assertHTML('<div>hi admin</div>');
    this.assertStableRerender();
  }

  @test
  'missing attributes'() {
    let template = '<div data-foo="true"></div>';
    this.renderServerSide(template, {});
    this.assertServerOutput('<div data-foo="true"></div>');

    // remove the attribute
    let element = castToBrowser(this.element, 'HTML');
    let [div] = this.guardArray({ children: element.children }, { min: 1 });
    div.removeAttribute('data-foo');

    this.renderClientSide(template, {});
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML('<div data-foo="true"></div>');
    this.assertStableRerender();
  }

  @test
  'remove extra attributes'() {
    let template = '<div data-foo="true"></div>';
    this.renderServerSide(template, {});
    this.assertServerOutput('<div data-foo="true"></div>');

    // add an extra attribute
    let element = castToBrowser(this.element, 'HTML');
    let [div] = this.guardArray({ children: element.children }, { min: 1 });
    div.setAttribute('data-bar', 'oops');

    this.renderClientSide(template, {});
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML('<div data-foo="true"></div>');
    this.assertStableRerender();
  }

  @test
  'updates attribute to current value'() {
    let template = '<div class="always-present show-me"></div>';
    this.renderServerSide(template, {});
    this.assertServerOutput('<div class="always-present show-me"></div>');

    // mutate the attribute
    let element = castToBrowser(this.element, 'HTML');
    let [div] = this.guardArray({ children: element.children }, { min: 1 });
    div.setAttribute('class', 'zomg');

    this.renderClientSide(template, {});
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML('<div class="always-present show-me"></div>');
    this.assertStableRerender();
  }

  @test
  'does not mutate attributes that already match'() {
    let observer = new MutationObserver((mutationList) => {
      mutationList.forEach((mutation) => {
        let target = castToBrowser(mutation.target, 'HTML');
        this.assert.ok(
          false,
          `should not have updated ${mutation.attributeName} on ${target.outerHTML}`
        );
      });
    });

    let template = '<div data-foo="whatever"></div>';
    this.renderServerSide(template, {});
    this.assertServerOutput('<div data-foo="whatever"></div>');

    observer.observe(castToBrowser(this.element, 'HTML'), { attributes: true, subtree: true });

    this.renderClientSide(template, {});
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML('<div data-foo="whatever"></div>');
    this.assertStableRerender();
  }

  @test
  'Node curlies'() {
    let template = '<div>{{this.node}}</div>';

    let doc = this.delegate.serverDoc;
    let node = doc.createTextNode('hello');
    this.renderServerSide(template, { node });
    this.assertServerOutput('<div>', OPEN, 'hello', CLOSE, '</div>');
    doc = this.delegate.clientDoc;
    let clientNode = doc.createTextNode('hello');
    this.context = { node: clientNode };
    this.renderClientSide(template, { node: clientNode });
    this.assertHTML('<div>hello</div>', 'first clean rerender');
    // Just repairs the value of the text node
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertStableRerender();

    let clientNode2 = doc.createTextNode('goodbye');
    this.rerender({ node: clientNode2 });
    this.assertHTML('<div>goodbye</div>', 'rerender after node update');
    this.assertStableNodes({ except: clientNode });

    this.rerender({ node: clientNode });
    this.assertHTML('<div>hello</div>', 'back to the beginning');
    this.assertStableNodes({ except: clientNode2 });
  }

  @test
  'in-element can rehydrate'() {
    let template = strip`
      <outer><prefix></prefix>
      {{#in-element this.remote}}<inner>Wat Wat</inner>{{/in-element}}
      <suffix></suffix></outer>
      `;
    let doc = this.delegate.serverDoc;
    let remote = doc.createElement('remote');
    let prefix = doc.createElement('prefix');
    let suffix = doc.createElement('suffix');
    remote.appendChild(prefix);
    remote.appendChild(suffix);

    this.renderServerSide(template, { remote });
    let serializedRemote = this.delegate.serialize(remote);
    let b = blockStack();
    assertSerializedInElement(
      serializedRemote,
      strip`
      ${b(2)}
      <inner>Wat Wat</inner>
      ${b(2)}
    `
    );

    doc = this.delegate.clientDoc;
    let clientRemote = (remote = doc.createElement('remote'));
    let host = doc.createElement('div');
    host.appendChild(this.element);
    host.appendChild(clientRemote);
    replaceHTML(clientRemote, serializedRemote);
    this.element = assertingElement(host.firstChild);

    this.renderClientSide(template, { remote: clientRemote });
    this.assertRehydrationStats({ nodesRemoved: 2 });
    this.assert.strictEqual(toInnerHTML(clientRemote), '<inner>Wat Wat</inner>');
  }

  @test
  'in-element with insertBefore=null can rehydrate'() {
    let template = strip`
      <outer><prefix></prefix>
      {{#in-element this.remote insertBefore=null}}<inner>Wat Wat</inner>{{/in-element}}
      <suffix></suffix></outer>
      `;
    let doc = this.delegate.serverDoc;
    let remote = doc.createElement('remote');
    let prefix = doc.createElement('prefix');
    let suffix = doc.createElement('suffix');
    remote.appendChild(prefix);
    remote.appendChild(suffix);

    this.renderServerSide(template, { remote });
    let serializedRemote = this.delegate.serialize(remote);
    let b = blockStack();
    assertSerializedInElement(
      serializedRemote,
      strip`
      ${b(2)}
      <inner>Wat Wat</inner>
      ${b(2)}
    `
    );

    doc = this.delegate.clientDoc;
    let clientRemote = (remote = doc.createElement('remote'));
    let host = doc.createElement('div');
    host.appendChild(this.element);
    host.appendChild(clientRemote);
    replaceHTML(clientRemote, serializedRemote);
    this.element = assertingElement(host.firstChild);

    this.renderClientSide(template, { remote: clientRemote });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assert.strictEqual(
      toInnerHTML(clientRemote),
      '<prefix></prefix><suffix></suffix><inner>Wat Wat</inner>'
    );
  }

  @test
  'in-element with insertBefore=element can rehydrate'() {
    let template = strip`
      <outer><prefix></prefix>
      {{#in-element this.remote insertBefore=this.prefix}}<inner>Wat Wat</inner>{{/in-element}}
      <suffix></suffix></outer>
      `;
    let doc = this.delegate.serverDoc;
    let remote = doc.createElement('remote');
    let prefix = doc.createElement('prefix');
    let suffix = doc.createElement('suffix');
    remote.appendChild(prefix);
    remote.appendChild(suffix);

    this.renderServerSide(template, { remote, prefix, suffix });
    let serializedRemote = this.delegate.serialize(remote);
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

    doc = this.delegate.clientDoc;
    let clientRemote = (remote = doc.createElement('remote'));
    let host = doc.createElement('div');
    host.appendChild(this.element);
    host.appendChild(clientRemote);
    replaceHTML(clientRemote, serializedRemote);
    this.element = assertingElement(host.firstChild);
    let clientPrefix = clientRemote.childNodes[4];

    this.renderClientSide(template, { remote: clientRemote, prefix: clientPrefix });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assert.strictEqual(
      toInnerHTML(clientRemote),
      '<inner>Wat Wat</inner><prefix></prefix><suffix></suffix>'
    );
  }

  @test
  'in-element can rehydrate into pre-existing content'() {
    let template = strip`
      <outer>
      {{#in-element this.remote insertBefore=undefined}}<inner>Wat Wat</inner>{{/in-element}}
      </outer>
      `;
    let doc = this.delegate.serverDoc;
    let remote = doc.createElement('remote');

    this.renderServerSide(template, { remote });
    let serializedRemote = '<preexisting><preexisting>';

    doc = this.delegate.clientDoc;
    let clientRemote = (remote = doc.createElement('remote'));
    let host = doc.createElement('div');
    host.appendChild(this.element);
    host.appendChild(clientRemote);
    replaceHTML(clientRemote, serializedRemote);
    this.element = assertingElement(host.firstChild);

    this.renderClientSide(template, { remote: clientRemote });
    this.assertRehydrationStats({ nodesRemoved: 1 });
    this.assert.strictEqual(toInnerHTML(clientRemote), '<inner>Wat Wat</inner>');
  }

  @test
  'in-element with insertBefore=null can rehydrate into pre-existing content'() {
    let template = strip`
      <outer>
      {{#in-element this.remote insertBefore=null}}<inner>Wat Wat</inner>{{/in-element}}
      </outer>
      `;
    let doc = this.delegate.serverDoc;
    let remote = doc.createElement('remote');
    let preexisting = doc.createElement('preexisting');
    remote.appendChild(preexisting);

    this.renderServerSide(template, { remote, preexisting });
    let serializedRemote = '<preexisting></preexisting>';

    doc = this.delegate.clientDoc;
    let clientRemote = (remote = doc.createElement('remote'));
    let host = doc.createElement('div');
    host.appendChild(this.element);
    host.appendChild(clientRemote);
    replaceHTML(clientRemote, serializedRemote);
    this.element = assertingElement(host.firstChild);

    this.renderClientSide(template, { remote: clientRemote });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assert.strictEqual(
      toInnerHTML(clientRemote),
      '<preexisting></preexisting><inner>Wat Wat</inner>'
    );
  }

  @test
  'in-element with insertBefore=element can rehydrate into pre-existing content'() {
    let template = strip`
      <outer>
      {{#in-element this.remote insertBefore=this.preexisting}}<inner>Wat Wat</inner>{{/in-element}}
      </outer>
      `;
    let doc = this.delegate.serverDoc;
    let remote = doc.createElement('remote');
    let prefix = doc.createElement('prefix');
    let preexisting = doc.createElement('preexisting');
    remote.appendChild(prefix);
    remote.appendChild(preexisting);

    this.renderServerSide(template, { remote, prefix, preexisting });
    let serializedRemote = '<prefix></prefix><preexisting></preexisting>';

    doc = this.delegate.clientDoc;
    let clientRemote = (remote = doc.createElement('remote'));
    let host = doc.createElement('div');
    host.appendChild(this.element);
    host.appendChild(clientRemote);
    replaceHTML(clientRemote, serializedRemote);
    let clientPreexisting = clientRemote.childNodes[1];
    this.element = assertingElement(host.firstChild);

    this.renderClientSide(template, {
      remote: clientRemote,
      prefix,
      preexisting: clientPreexisting,
    });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assert.strictEqual(
      toInnerHTML(clientRemote),
      '<prefix></prefix><inner>Wat Wat</inner><preexisting></preexisting>'
    );
  }

  @test
  'nested in-element can rehydrate'() {
    let template = strip`
    <outer>
      {{#in-element this.remoteParent}}
        <inner>{{#in-element this.remoteChild}}Wat Wat{{/in-element}}</inner>
      {{/in-element}}
    </outer>
    `;
    let doc = this.delegate.serverDoc;
    let remoteParent = doc.createElement('remote');
    let remoteChild = doc.createElement('other');

    this.renderServerSide(template, { remoteParent, remoteChild });
    let serializedParentRemote = this.delegate.serialize(remoteParent);
    let serializedRemoteChild = this.delegate.serialize(remoteChild);
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
    doc = this.delegate.clientDoc;
    let clientRemoteParent = doc.createElement('remote');
    let clientRemoteChild = doc.createElement('other');
    let host = doc.createElement('div');
    host.appendChild(this.element);
    host.appendChild(clientRemoteParent);
    host.appendChild(clientRemoteChild);

    replaceHTML(clientRemoteParent, serializedParentRemote);
    replaceHTML(clientRemoteChild, serializedRemoteChild);
    this.element = assertingElement(host.firstChild);
    this.renderClientSide(template, {
      remoteParent: clientRemoteParent,
      remoteChild: clientRemoteChild,
    });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assert.strictEqual(toInnerHTML(clientRemoteParent), '<inner><!----></inner>');
    this.assert.strictEqual(toInnerHTML(clientRemoteChild), 'Wat Wat');
  }

  @test
  'svg elements'() {
    let template = '<svg>{{#if this.isTrue}}<circle />{{/if}}</svg><p>Hello</p>';
    this.renderServerSide(template, { isTrue: true });
    let b = blockStack();
    this.assertHTML(strip`
      ${b(0)}
      <svg>
        ${b(1)}
        <circle />
        ${b(1)}
      </svg>
      <p>Hello</p>
      ${b(0)}
    `);
    this.renderClientSide(template, { isTrue: true });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML(strip`
      <svg>
      <circle />
      </svg>
      <p>Hello</p>
    `);
    this.assertStableRerender();
  }

  @test
  'title tag'() {
    let template =
      '<title>{{this.pageTitle}} some {{{this.other}}}{{this.thing}} <b>hey!</b></title>';
    this.renderServerSide(template, { pageTitle: 'kiwi', other: 'other', thing: 'thing' });
    let b = blockStack();
    this.assertHTML(strip`
      ${b(0)}
      <title>
        kiwi some otherthing <b>hey!</b>
      </title>
      ${b(0)}
    `);
    this.renderClientSide(template, { pageTitle: 'kiwi', other: 'other', thing: 'thing' });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML(strip`
      <title>
        kiwi some otherthing <b>hey!</b>
      </title>
    `);
    this.assertStableRerender();
  }

  @test
  'script tag'() {
    let template = strip`
      <script type="application/ld+json">{{this.data}}</script>
      <script type="application/ld+json">{{this.otherData}}</script>
    `;
    this.renderServerSide(template, { data: '{ "status": "ok" }', otherData: '{ "code": 200 }' });
    let b = blockStack();
    this.assertHTML(strip`
      ${b(0)}
      <script type="application/ld+json">
        { "status": "ok" }
      </script>

      <script type="application/ld+json">
        { "code": 200 }
      </script>
      ${b(0)}
    `);
    this.renderClientSide(template, { data: '{ "status": "ok" }', otherData: '{ "code": 200 }' });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML(strip`
      <script type="application/ld+json">
        { "status": "ok" }
      </script>

      <script type="application/ld+json">
        { "code": 200 }
      </script>
    `);
    this.assertStableRerender();
  }

  @test
  'style tag'() {
    let template = '<style>{{this.selector}} { color: #fff; }</style>';
    this.renderServerSide(template, { selector: 'div' });
    let b = blockStack();
    this.assertHTML(strip`
      ${b(0)}
      <style>
        div { color: #fff; }
      </style>
      ${b(0)}
    `);
    this.renderClientSide(template, { selector: 'div' });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML(strip`
      <style>
        div { color: #fff; }
      </style>
    `);
    this.assertStableRerender();
  }

  @test
  'clearing bounds'() {
    let template = strip`
      {{#if this.isTrue}}
        {{#each this.items key="id" as |item i|}}
          <p>{{item}}-{{i}}</p>
        {{/each}}
      {{/if}}
    `;
    this.renderServerSide(template, { isTrue: true, items: [1, 2] });
    let b = blockStack();
    this.assertHTML(strip`
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

    this.renderClientSide(template, { isTrue: false, items: [3, 4] });
    // Removes the block and each <p>
    this.assertRehydrationStats({ nodesRemoved: 2 });
    this.assertHTML('<!---->');
    this.assertStableRerender();
  }

  @test
  'top-level clearing bounds'() {
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
    this.renderServerSide(template, { isTrue: true, items: [1, 2], isFalse: false });
    let b = blockStack();
    this.assertHTML(strip`
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

    this.renderClientSide(template, { isTrue: false, items: [3, 4], isFalse: true });
    // Clears block markers for both and removes `inside`
    this.assertRehydrationStats({ nodesRemoved: 1 });
    this.assertHTML('<top><!----></top><p>3-0</p><p>4-1</p>');
    this.assertStableRerender();
  }

  @test
  '#each rehydration'() {
    let template = "{{#each this.items key='id' as |item|}}<p>{{item}}</p>{{/each}}";
    this.renderServerSide(template, { items: [1, 2, 3] });
    let b = blockStack();
    this.assertHTML(strip`
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

    this.renderClientSide(template, { items: [1, 2, 4] });
    this.assertRehydrationStats({ nodesRemoved: 0 });
    this.assertHTML(strip`
      <p>1</p>
      <p>2</p>
      <p>4</p>
    `);
    this.assertStableRerender();
  }
}

class RehydratingComponents extends AbstractRehydrationTests {
  _buildComponent(blueprint: ComponentBlueprint, properties: Dict = {}) {
    let template = this.buildComponent(blueprint);
    if (this.testType === 'Dynamic' && properties['componentName'] === undefined) {
      properties['componentName'] = blueprint.name || GLIMMER_TEST_COMPONENT;
    }
    return template;
  }

  assertServerComponent(html: string, attrs: object = {}) {
    // the Dynamic test type is using {{component 'foo'}} style invocation
    // and therefore an extra node is added delineating the block start
    let elementIndex = this.testType === 'Dynamic' ? 3 : 2;
    let element = assertingElement(this.element.childNodes[elementIndex]);

    if (this.testType === 'Glimmer') {
      assertElementShape(element, 'div', attrs, html);
    } else {
      assertEmberishElement(element, 'div', attrs, html);
    }
  }

  override renderServerSide(blueprint: ComponentBlueprint, properties: Dict = {}) {
    let template = this._buildComponent(blueprint, properties);
    super.renderServerSide(template, properties);
  }

  override renderClientSide(blueprint: ComponentBlueprint, properties: Dict = {}) {
    let template = this._buildComponent(blueprint, properties);
    super.renderClientSide(template, properties);
  }

  @test
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

  @test
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

  @test
  '<p> invoking a block which emits a <div>'() {
    let componentToRender = {
      layout: '<p>hello {{#if @show}}<div>world!</div>{{/if}}</p>',
      args: { show: 'this.show' },
    };

    this.renderServerSide(componentToRender, { show: true });
    let b = blockStack();

    let id = this.testType === 'Dynamic' ? 3 : 2;

    this.assertServerComponent(`<p>hello ${b(id)}</p><div>world!</div>${b(id)}<p></p>`);

    this.renderClientSide(componentToRender, { show: true });
    this.assertComponent('<p>hello <div>world!</div></p>');

    this.assertRehydrationStats({ nodesRemoved: 2 });
    this.assertStableNodes();
  }

  @test
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

  @test
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

  @test
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

  @test
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

  @test
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

  @test
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

    this.registerComponent(this.testType, name, 'Hello {{yield}}');
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

  @test
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

    this.registerComponent(this.testType, name, 'Hello {{yield}}');
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

  @test
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
    this.registerHelper(
      'even',
      (params: ReadonlyArray<unknown>) => (params[0] as number) % 2 === 0
    );
    let template = '{{#if (even i)}}<FooBar @count={{i}} />{{/if}}';
    this.registerComponent('TemplateOnly', 'FooBar', '<li>{{@count}}</li>');
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

  @test
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
    this.registerHelper(
      'even',
      (params: ReadonlyArray<unknown>) => (params[0] as number) % 2 === 0
    );
    let template = '{{#if (even i)}}<FooBar @count={{i}} />{{/if}}';
    this.registerComponent('TemplateOnly', 'FooBar', '<li>{{@count}}</li>');
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

  @test
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
    this.registerHelper(
      'even',
      (params: ReadonlyArray<unknown>) => (params[0] as number) % 2 === 0
    );
    let template = '{{#if (even i)}}<FooBar @count={{i}} />{{/if}}';
    this.registerComponent('TemplateOnly', 'FooBar', '<li>{{@count}}</li>');
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

suite(Rehydration, RehydrationDelegate);
jitSuite(RenderTests);
componentSuite(RehydratingComponents, RehydrationDelegate);
