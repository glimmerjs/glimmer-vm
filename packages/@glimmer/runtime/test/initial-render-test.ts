import { Opaque, Dict, Option } from "@glimmer/interfaces";
import {
  module,
  test,
  EMPTY,
  OPEN,
  CLOSE,
  TestEnvironment,
  equalTokens,
  Content,
  content,
  InitialRenderSuite,
  RehydrationDelegate,
  rawModule,
  strip,
  blockStack,
  ComponentBlueprint,
  GLIMMER_TEST_COMPONENT,
  assertEmberishElement
} from "@glimmer/test-helpers";
import { expect } from "@glimmer/util";

class RenderTests extends InitialRenderSuite {
  name = 'client';
  protected env: TestEnvironment = new TestEnvironment();
}

class AbstractRehydrationTests extends InitialRenderSuite {
  name = 'rehydration';
  protected delegate: RehydrationDelegate;
  protected serverOutput: Option<string>;

  renderServerSide(template: string | ComponentBlueprint, context: Dict<Opaque>): void {
    this.serverOutput = this.delegate.renderServerSide(template as string, context, () => this.takeSnapshot());
    this.element.innerHTML = this.serverOutput;
  }

  renderClientSide(template: string | ComponentBlueprint, context: Dict<Opaque>): void {
    this.context = context;
    this.renderResult = this.delegate.renderClientSide(template as string, context, this.element);
  }

  assertRehydrationStats({ blocksRemoved: blocks, nodesRemoved: nodes}: { blocksRemoved: number, nodesRemoved: number }) {
    let { clearedNodes, clearedBlocks } = this.delegate.rehydrationStats;
    this.assert.equal(clearedBlocks.length, blocks, `cleared ${clearedBlocks.length} blocks, ${clearedBlocks.join(', ')}`);
    this.assert.equal(clearedNodes.length, nodes, 'cleared nodes');
  }

  assertServerOutput(..._expected: Content[]) {
    let output = expect(this.serverOutput, 'must renderServerSide before calling assertServerOutput');
    equalTokens(output, content([OPEN, ..._expected, CLOSE]));
  }
}

class Rehydration extends AbstractRehydrationTests {
  @test "mismatched text nodes"() {
    let template = '{{content}}';
    this.renderServerSide(template, { content: 'hello' });
    this.assertServerOutput("hello");

    this.renderClientSide(template, { content: 'goodbye' });
    this.assertHTML("goodbye");
    // Just repairs the value of the text node
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assertStableRerender();
  }

  @test "mismatched text nodes (server-render empty)"() {
    let template = "{{content}} world";
    this.renderServerSide(template, { content: '' });
    this.assertServerOutput(EMPTY, " world");

    this.renderClientSide(template, { content: 'hello' });
    this.assertHTML("hello world");
    // Just repairs the value of the text node
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });

    // TODO: handle %empty% in the testing DSL
    // this.assertStableNodes();
    this.assertStableRerender();
  }

  @test "mismatched elements"() {
    let template = "{{#if admin}}<div>hi admin</div>{{else}}<p>HAXOR</p>{{/if}}";
    this.renderServerSide(template, { admin: true });
    this.assertServerOutput(OPEN, "<div>hi admin</div>", CLOSE);

    this.renderClientSide(template, { admin: false });
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 1 });
    this.assertHTML("<p>HAXOR</p>");
    this.assertStableRerender();
  }

  @test "extra nodes at the end"() {
    let template = "{{#if admin}}<div>hi admin</div>{{else}}<div>HAXOR{{stopHaxing}}</div>{{/if}}";
    this.renderServerSide(template, { admin: false, stopHaxing: 'stahp' });
    this.assertServerOutput(OPEN, "<div>HAXOR<!--%sep%-->stahp</div>", CLOSE);

    this.renderClientSide(template, { admin: true });
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 1 });
    this.assertHTML("<div>hi admin</div>");
    this.assertStableRerender();
  }

  @test "Node curlies"() {
    let template = '<div>{{node}}</div>';

    let env = this.delegate.serverEnv;
    let node = env.getAppendOperations().createTextNode('hello');
    this.renderServerSide(template, { node });
    this.assertServerOutput('<div>hello</div>');

    env = this.delegate.clientEnv;
    let clientNode = env.getDOM().createTextNode('hello');
    this.context = { node: clientNode };
    this.renderClientSide(template, { node: clientNode });
    this.assertHTML('<div>hello</div>', 'first clean rerender');
    // Just repairs the value of the text node
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assertStableRerender();

    let clientNode2 = env.getDOM().createTextNode('goodbye');
    this.rerender({ node: clientNode2 });
    this.assertHTML('<div>goodbye</div>', 'rerender after node update');
    this.assertStableNodes({ except: clientNode as Text });

    this.rerender({ node: clientNode });
    this.assertHTML('<div>hello</div>', 'back to the beginning');
    this.assertStableNodes({ except: clientNode2 as Text });
  }

  @test "in-element can rehydrate"() {
    let template = '<outer>{{#in-element remote}}<inner>Wat Wat</inner>{{/in-element}}</outer>';
    let env = this.delegate.serverEnv;
    let remote = env.getAppendOperations().createElement('remote');

    this.renderServerSide(template, { remote });
    let serializedRemote = this.delegate.serialize(remote);
    this.assert.equal(serializedRemote, strip`
      <script id="%cursor:0%"></script>
      <!--%+block:2%--><inner>Wat Wat</inner><!--%-block:2%-->
    `);
    env = this.delegate.clientEnv;
    let clientRemote = remote = env.getDOM().createElement('remote') as HTMLElement;
    let host = env.getDOM().createElement('div') as HTMLElement;
    host.appendChild(this.element);
    host.appendChild(clientRemote);
    clientRemote.innerHTML = serializedRemote;
    this.element = host.firstChild as HTMLElement;

    this.renderClientSide(template, { remote: clientRemote });
    // The removal is the serialized cursor e.g. <script id="%cursor:1%"></script>
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 1 });
    this.assert.equal(clientRemote.innerHTML, '<inner>Wat Wat</inner>');
  }

  @test "svg elements"() {
    let template = '<svg>{{#if isTrue}}<circle />{{/if}}</svg><p>Hello</p>';
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
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assertHTML(strip`
      <svg>
      <circle />
      </svg>
      <p>Hello</p>
    `);
    this.assertStableRerender();
  }

  @test "clearing bounds"() {
    let template = strip`
      {{#if isTrue}}
        {{#each items key="id" as |item i|}}
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
    this.assertRehydrationStats({ blocksRemoved: 1, nodesRemoved: 2 });
    this.assertHTML('<!---->');
    this.assertStableRerender();
  }

  @test "top-level clearing bounds"() {
    let template = strip`
      <top>
      {{#if isTrue}}
        <inside>
        {{#each items key="id" as |item i|}}
          <p>{{item}}-{{i}}</p>
        {{/each}}
        </inside>
      {{/if}}
      </top>
      {{#if isFalse}}
        {{#each items key="id" as |item i|}}
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
    this.assertRehydrationStats({ blocksRemoved: 2, nodesRemoved: 1 });
    this.assertHTML('<top><!----></top><p>3-0</p><p>4-1</p>');
    this.assertStableRerender();
  }

  @test "#each rehydration"() {
    let template = "{{#each items key='id' as |item|}}<p>{{item}}</p>{{/each}}";
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
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assertHTML(strip`
      <p>1</p>
      <p>2</p>
      <p>4</p>
    `);
    this.assertStableRerender();
  }
}

class RehydratingComponents extends AbstractRehydrationTests {
  _buildComponent(blueprint: ComponentBlueprint, properties: Dict<Opaque> = {}) {
    let template = this.buildComponent(blueprint);
    if (this.testType === "Dynamic" && properties["componentName"] === undefined) {
      properties["componentName"] = blueprint.name || GLIMMER_TEST_COMPONENT;
    }
    return template;
  }

  assertServerComponent(html: string, attrs: Object = {}) {
    if (this.testType === 'Dynamic') {
      assertEmberishElement(this.element.childNodes[3] as HTMLElement, 'div', attrs, html);
    } else {
      assertEmberishElement(this.element.childNodes[2] as HTMLElement, 'div', attrs, html);
    }
  }

  renderServerSide(blueprint: ComponentBlueprint, properties: Dict<Opaque> = {}) {
    let template = this._buildComponent(blueprint, properties);
    super.renderServerSide(template, properties);
  }

  renderClientSide(blueprint: ComponentBlueprint, properties: Dict<Opaque> = {}) {
    let template = this._buildComponent(blueprint, properties);
    super.renderClientSide(template, properties);
  }

  @test
  "Component invocations"() {
    let layout = 'Hello {{@name}}';
    let args = { name: 'name' };
    this.renderServerSide({
      layout,
      args,
    }, { name: 'Filewatcher' });
    let b = blockStack();
    let id = this.testType === 'Dynamic' ? 3 : 2;
    this.assertServerComponent(`Hello ${b(id)}Filewatcher${b(id)}`);

    this.renderClientSide({
      layout,
      args,
    }, { name: 'Filewatcher' });
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assertComponent('Hello Filewatcher');
    this.assertStableRerender();
  }

  @test
  "Mismatched Component invocations"() {
    let layout = 'Hello {{@name}}';
    let args = { name: 'name' };
    this.renderServerSide({
      layout,
      args,
    }, { name: 'Filewatcher' });
    let b = blockStack();
    let id = this.testType === 'Dynamic' ? 3 : 2;
    this.assertServerComponent(`Hello ${b(id)}Filewatcher${b(id)}`);

    this.renderClientSide({
      layout,
      args,
    }, { name: 'Chad' });
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assertComponent('Hello Chad');
    this.assertStableRerender();
  }

  @test
  "Component invocations with block params"() {
    let layout = 'Hello {{yield @name}}';
    let template = '{{name}}';
    let blockParams = ['name'];
    let args = { name: 'name' };

    this.renderServerSide({
      layout,
      template,
      args,
      blockParams
    }, { name: 'Filewatcher' });
    let b = blockStack();
    let id = this.testType === 'Dynamic' ? 3 : 2;
    this.assertServerComponent(`Hello ${b(id)}Filewatcher${b(id)}`);

    this.renderClientSide({
      layout,
      template,
      args,
      blockParams
    }, { name: 'Filewatcher' });
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assertComponent('Hello Filewatcher');
    this.assertStableRerender();
  }

  @test
  "Mismatched Component invocations with block params"() {
    let layout = 'Hello {{yield @name}}';
    let template = '{{name}}';
    let blockParams = ['name'];
    let args = { name: 'name' };

    this.renderServerSide({
      layout,
      template,
      args,
      blockParams
    }, { name: 'Filewatcher' });
    let b = blockStack();
    let id = this.testType === 'Dynamic' ? 3 : 2;
    this.assertServerComponent(`Hello ${b(id)}Filewatcher${b(id)}`);

    this.renderClientSide({
      layout,
      template,
      args,
      blockParams
    }, { name: 'Chad' });
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assertComponent('Hello Chad');
    this.assertStableRerender();
  }

  @test
  "Component invocations with template"() {
    let layout = 'Hello {{yield}}';
    let template = 'Filewatcher';
    this.renderServerSide({
      layout,
      template
    }, { name: 'Filewatcher' });
    this.assertServerComponent(`Hello <!--%sep%-->Filewatcher`);

    this.renderClientSide({
      layout,
      template
    });
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assertComponent('Hello Filewatcher');
    this.assertStableRerender();
  }

  @test
  "Mismatched Component invocations with template"() {
    let layout = 'Hello {{yield}}';
    let template = 'Filewatcher';
    this.renderServerSide({
      layout,
      template
    });
    this.assertServerComponent(`Hello <!--%sep%-->Filewatcher`);

    this.renderClientSide({
      layout,
      template: 'Chad'
    });
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assertComponent('Hello Chad');
    this.assertStableRerender();
  }

  @test
  "Component invocations with empty args"() {
    let layout = 'Hello {{@foo}}';
    this.renderServerSide({
      layout,
    });
    let b = blockStack();
    let id = this.testType === 'Dynamic' ? 3 : 2;
    this.assertServerComponent(`Hello ${b(id)}<!--%empty%-->${b(id)}`);

    this.renderClientSide({
      layout
    });
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assertComponent('Hello ');
    this.assertStableRerender();
  }

  @test
  "Multiple invocations"() {
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
      template
    });
    let b = blockStack();
    if (emberishComponent) {
      // injects wrapper elements
      this.assert.ok(this.element.querySelector('div'));
      this.assert.ok(this.element.querySelector('.ember-view'));
      this.assert.equal(this.element.textContent, 'Hello World');
    } else {
      this.assertServerComponent(`${b(2)}Hello <!--%sep%-->World${b(2)}`);
    }

    this.renderClientSide({
      layout,
      template
    });
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assert.equal(this.element.textContent, 'Hello World');
    this.assertStableRerender();
  }

  @test
  "Mismatched Multiple invocations"() {
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
      template
    });
    let b = blockStack();
    if (emberishComponent) {
      // injects wrapper elements
      this.assert.ok(this.element.querySelector('div'));
      this.assert.ok(this.element.querySelector('.ember-view'));
      this.assert.equal(this.element.textContent, 'Hello World');
    } else {
      this.assertServerComponent(`${b(2)}Hello <!--%sep%-->World${b(2)}`);
    }

    if (this.testType === 'Dynamic' || this.testType === 'Curly') {
      template = '{{#foo-bar}}Chad{{/foo-bar}}';
    } else {
      template = '<FooBar>Chad</FooBar>';
    }

    this.renderClientSide({
      layout,
      template
    });
    this.assertRehydrationStats({ blocksRemoved: 0, nodesRemoved: 0 });
    this.assert.equal(this.element.textContent, 'Hello Chad');
    this.assertStableRerender();
  }
}

rawModule("Rehydration Tests", Rehydration, RehydrationDelegate);
rawModule('Rehydrating components', RehydratingComponents, RehydrationDelegate, { componentModule: true });
module("Initial Render Tests", RenderTests);
