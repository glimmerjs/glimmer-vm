import {
  TestEnvironment,
  stripTight,
  equalsElement,
  EmberishCurlyComponent,
  BasicComponent,
  RenderTests,
  module,
  test
 } from "@glimmer/test-helpers";

import {
  assertAppended,
  assertElementIsEmberishElement,
  EmberishRootView
} from './ember-component-test';

import { setProperty as set } from '@glimmer/object-reference';

let view: EmberishRootView;
let env: TestEnvironment;

function rerender() {
  view.rerender();
}

function appendViewFor(template: string, context: Object = {}) {
  view = new EmberishRootView(env, template, context);

  env.begin();
  view.appendTo('#qunit-fixture');
  env.commit();

  return view;
}

QUnit.module('Targeting a remote element', {
  beforeEach() {
    env = new TestEnvironment();
  }
});

class InElementTests extends RenderTests {
  @test "Renders curlies into external element"() {
    let externalElement = document.createElement("div");
    this.render("{{#-in-element externalElement}}[{{foo}}]{{/-in-element}}", { externalElement, foo: "Yippie!" });
    equalsElement(externalElement, "div", {}, "[Yippie!]");
    this.assertStableRerender();

    this.rerender({ foo: "Double Yups!" });
    equalsElement(externalElement, "div", {}, "[Double Yups!]");
    this.assertStableNodes();

    this.rerender({ foo: "Yippie!" });
    equalsElement(externalElement, "div", {}, "[Yippie!]");
    this.assertStableNodes();
  }

  @test "Changing to falsey"() {
    let first = document.createElement("div");
    let second = document.createElement("div");

    this.render(
      stripTight`
        |{{foo}}|
        {{#-in-element first}}[{{foo}}]{{/-in-element}}
        {{#-in-element second}}[{{foo}}]{{/-in-element}}
      `,
      { first, second: null, foo: "Yippie!" }
    );

    equalsElement(first, "div", {}, "[Yippie!]");
    equalsElement(second, "div", {}, "");
    this.assertHTML("|Yippie!|<!----><!---->");
    this.assertStableRerender();

    this.rerender({ foo: "Double Yips!" });
    equalsElement(first, "div", {}, "[Double Yips!]");
    equalsElement(second, "div", {}, "");
    this.assertHTML("|Double Yips!|<!----><!---->");
    this.assertStableNodes();

    this.rerender({ first: null });
    equalsElement(first, "div", {}, "");
    equalsElement(second, "div", {}, "");
    this.assertHTML("|Double Yips!|<!----><!---->");
    this.assertStableRerender();

    this.rerender({ second });
    equalsElement(first, "div", {}, "");
    equalsElement(second, "div", {}, "[Double Yips!]");
    this.assertHTML("|Double Yips!|<!----><!---->");
    this.assertStableRerender();

    this.rerender({ first, second: null, foo: "Yippie!" });
    equalsElement(first, "div", {}, "[Yippie!]");
    equalsElement(second, "div", {}, "");
    this.assertHTML("|Yippie!|<!----><!---->");
    this.assertStableRerender();
  }

  @test "With pre-existing content"() {
    let externalElement = document.createElement("div");
    let initialContent = externalElement.innerHTML = "<p>Hello there!</p>";

    this.render(
      stripTight`{{#-in-element externalElement}}[{{foo}}]{{/-in-element}}`,
      { externalElement, foo: "Yippie!" }
    );

    equalsElement(externalElement, "div", {}, `${initialContent}[Yippie!]`);
    this.assertHTML("<!---->");
    this.assertStableRerender();

    this.rerender({ foo: "Double Yips!" });
    equalsElement(externalElement, "div", {}, `${initialContent}[Double Yips!]`);
    this.assertHTML("<!---->");
    this.assertStableNodes();

    this.rerender({ externalElement: null });
    equalsElement(externalElement, "div", {}, `${initialContent}`);
    this.assertHTML("<!---->");
    this.assertStableRerender();

    this.rerender({ externalElement, foo: "Yippie!" });
    equalsElement(externalElement, "div", {}, `${initialContent}[Yippie!]`);
    this.assertHTML("<!---->");
    this.assertStableRerender();
  }

  @test "With nextSibling"() {
    let externalElement = document.createElement("div");
    externalElement.innerHTML = "<b>Hello</b><em>there!</em>";

    this.render(
      stripTight`{{#-in-element externalElement nextSibling=nextSibling}}[{{foo}}]{{/-in-element}}`,
      { externalElement, nextSibling: externalElement.lastChild, foo: "Yippie!" }
    );

    equalsElement(externalElement, "div", {}, "<b>Hello</b>[Yippie!]<em>there!</em>");
    this.assertHTML("<!---->");
    this.assertStableRerender();

    this.rerender({ foo: "Double Yips!" });
    equalsElement(externalElement, "div", {}, "<b>Hello</b>[Double Yips!]<em>there!</em>");
    this.assertHTML("<!---->");
    this.assertStableNodes();

    this.rerender({ nextSibling: null });
    equalsElement(externalElement, "div", {}, "<b>Hello</b><em>there!</em>[Double Yips!]");
    this.assertHTML("<!---->");
    this.assertStableRerender();

    this.rerender({ externalElement: null });
    equalsElement(externalElement, "div", {}, "<b>Hello</b><em>there!</em>");
    this.assertHTML("<!---->");
    this.assertStableRerender();

    this.rerender({ externalElement, nextSibling: externalElement.lastChild, foo: "Yippie!" });
    equalsElement(externalElement, "div", {}, "<b>Hello</b>[Yippie!]<em>there!</em>");
    this.assertHTML("<!---->");
    this.assertStableRerender();
  }
};

QUnit.test('updating remote element', function() {
  let first = document.createElement('div');
  let second = document.createElement('div');

  appendViewFor(
    stripTight`{{#-in-element targetElement}}[{{foo}}]{{/-in-element}}`,
    {
      targetElement: first,
      foo: 'Yippie!'
    }
  );

  equalsElement(first, 'div', {}, `[Yippie!]`);
  equalsElement(second, 'div', {}, ``);

  set(view, 'foo', 'Double Yips!');
  rerender();

  equalsElement(first, 'div', {}, `[Double Yips!]`);
  equalsElement(second, 'div', {}, ``);

  set(view, 'foo', 'Yippie!');
  rerender();

  equalsElement(first, 'div', {}, `[Yippie!]`);
  equalsElement(second, 'div', {}, ``);

  set(view, 'targetElement', second);
  rerender();

  equalsElement(first, 'div', {}, ``);
  equalsElement(second, 'div', {}, `[Yippie!]`);

  set(view, 'foo', 'Double Yips!');
  rerender();

  equalsElement(first, 'div', {}, ``);
  equalsElement(second, 'div', {}, `[Double Yips!]`);

  set(view, 'foo', 'Yippie!');
  rerender();

  equalsElement(first, 'div', {}, ``);
  equalsElement(second, 'div', {}, `[Yippie!]`);
});

QUnit.test('inside an `{{if}}', function() {
  let first = document.createElement('div');
  let second = document.createElement('div');

  appendViewFor(
    stripTight`
      {{#if showFirst}}
        {{#-in-element first}}[{{foo}}]{{/-in-element}}
      {{/if}}
      {{#if showSecond}}
        {{#-in-element second}}[{{foo}}]{{/-in-element}}
      {{/if}}
    `,
    {
      first,
      second,
      showFirst: true,
      showSecond: false,
      foo: 'Yippie!'
    }
  );

  equalsElement(first, 'div', {}, stripTight`[Yippie!]`);
  equalsElement(second, 'div', {}, stripTight``);

  set(view, 'showFirst', false);
  rerender();

  equalsElement(first, 'div', {}, stripTight``);
  equalsElement(second, 'div', {}, stripTight``);

  set(view, 'showSecond', true);
  rerender();

  equalsElement(first, 'div', {}, stripTight``);
  equalsElement(second, 'div', {}, stripTight`[Yippie!]`);

  set(view, 'foo', 'Double Yips!');
  rerender();

  equalsElement(first, 'div', {}, stripTight``);
  equalsElement(second, 'div', {}, stripTight`[Double Yips!]`);

  set(view, 'showSecond', false);
  rerender();

  equalsElement(first, 'div', {}, stripTight``);
  equalsElement(second, 'div', {}, stripTight``);

  set(view, 'showFirst', true);
  rerender();

  equalsElement(first, 'div', {}, stripTight`[Double Yips!]`);
  equalsElement(second, 'div', {}, stripTight``);

  set(view, 'foo', 'Yippie!');
  rerender();

  equalsElement(first, 'div', {}, stripTight`[Yippie!]`);
  equalsElement(second, 'div', {}, stripTight``);
});

QUnit.test('multiple', function() {
  let firstElement = document.createElement('div');
  let secondElement = document.createElement('div');

  appendViewFor(
    stripTight`
      {{#-in-element firstElement}}
        [{{foo}}]
      {{/-in-element}}
      {{#-in-element secondElement}}
        [{{bar}}]
      {{/-in-element}}
      `,
    {
      firstElement,
      secondElement,
      foo: 'Hello!',
      bar: 'World!'
    }
  );

  equalsElement(firstElement, 'div', {}, stripTight`[Hello!]`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);

  set(view, 'foo', 'GoodBye!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[GoodBye!]`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);

  set(view, 'bar', 'Folks!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[GoodBye!]`);
  equalsElement(secondElement, 'div', {}, stripTight`[Folks!]`);

  set(view, 'bar', 'World!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[GoodBye!]`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);

  set(view, 'foo', 'Hello!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[Hello!]`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);
});

QUnit.test('inside a loop', function() {
  class FooBar extends BasicComponent { }

  env.registerBasicComponent('foo-bar', FooBar, `<p>{{@value}}</p>`);

  let roots = [
    { id: 0, element: document.createElement('div'), value: 'foo' },
    { id: 1, element: document.createElement('div'), value: 'bar' },
    { id: 2, element: document.createElement('div'), value: 'baz' },
  ];

  appendViewFor(
    stripTight`
      {{~#each roots key="id" as |root|~}}
        {{~#-in-element root.element ~}}
          {{component 'foo-bar' value=root.value}}
        {{~/-in-element~}}
      {{~/each}}
      `,
    {
      roots
    }
  );

  equalsElement(roots[0].element, 'div', {}, '<p>foo</p>');
  equalsElement(roots[1].element, 'div', {}, '<p>bar</p>');
  equalsElement(roots[2].element, 'div', {}, '<p>baz</p>');

  set(roots[0], 'value', 'qux!');
  rerender();

  equalsElement(roots[0].element, 'div', {}, '<p>qux!</p>');
  equalsElement(roots[1].element, 'div', {}, '<p>bar</p>');
  equalsElement(roots[2].element, 'div', {}, '<p>baz</p>');

  set(roots[1], 'value', 'derp');
  rerender();

  equalsElement(roots[0].element, 'div', {}, '<p>qux!</p>');
  equalsElement(roots[1].element, 'div', {}, '<p>derp</p>');
  equalsElement(roots[2].element, 'div', {}, '<p>baz</p>');

  set(roots[0], 'value', 'foo');
  set(roots[1], 'value', 'bar');
  rerender();

  equalsElement(roots[0].element, 'div', {}, '<p>foo</p>');
  equalsElement(roots[1].element, 'div', {}, '<p>bar</p>');
  equalsElement(roots[2].element, 'div', {}, '<p>baz</p>');
});

QUnit.test('nesting', function() {
  let firstElement = document.createElement('div');
  let secondElement = document.createElement('div');

  appendViewFor(
    stripTight`
      {{#-in-element firstElement}}
        [{{foo}}]
        {{#-in-element secondElement}}
          [{{bar}}]
        {{/-in-element}}
      {{/-in-element}}
      `,
    {
      firstElement,
      secondElement,
      foo: 'Hello!',
      bar: 'World!'
    }
  );

  equalsElement(firstElement, 'div', {}, stripTight`[Hello!]<!---->`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);

  set(view, 'foo', 'GoodBye!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[GoodBye!]<!---->`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);

  set(view, 'bar', 'Folks!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[GoodBye!]<!---->`);
  equalsElement(secondElement, 'div', {}, stripTight`[Folks!]`);

  set(view, 'bar', 'World!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[GoodBye!]<!---->`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);

  set(view, 'foo', 'Hello!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[Hello!]<!---->`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);
});

QUnit.test('components are destroyed', function(assert) {
  let destroyed = 0;
  let DestroyMeComponent = EmberishCurlyComponent.extend({
    destroy(this: EmberishCurlyComponent) {
      this._super();
      destroyed++;
    }
  });

  env.registerEmberishCurlyComponent('destroy-me', DestroyMeComponent as any, 'destroy me!');

  let externalElement = document.createElement('div');

  appendViewFor(
    stripTight`
      {{#if showExternal}}
        {{#-in-element externalElement}}[{{destroy-me}}]{{/-in-element}}
      {{/if}}
    `,
    {
      externalElement,
      showExternal: false,
    }
  );

  equalsElement(externalElement, 'div', {}, stripTight``);
  assert.equal(destroyed, 0, 'component was destroyed');

  set(view, 'showExternal', true);
  rerender();

  assertElementIsEmberishElement(externalElement.firstElementChild!, 'div', { }, 'destroy me!');
  assert.equal(destroyed, 0, 'component was destroyed');

  set(view, 'showExternal', false);
  rerender();

  equalsElement(externalElement, 'div', {}, stripTight``);
  assert.equal(destroyed, 1, 'component was destroyed');
});

module("#-in-element Test", InElementTests);
