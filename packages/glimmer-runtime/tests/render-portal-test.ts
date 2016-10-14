import {
  TestEnvironment,
  stripTight,
  equalsElement,
  EmberishCurlyComponent
 } from "glimmer-test-helpers";

import {
  assertAppended,
  assertElementIsEmberishElement,
  EmberishRootView
} from './ember-component-test';

import { CLASS_META, setProperty as set } from 'glimmer-object-reference';

let view, env;

function rerender() {
  view.rerender();
}

function appendViewFor(template: string, context: Object = {}) {
  class MyRootView extends EmberishRootView {
    protected env = env;
    protected template = env.compile(template);
  }

  view = new MyRootView(context);
  MyRootView[CLASS_META].seal();

  env.begin();
  view.appendTo('#qunit-fixture');
  env.commit();

  return view;
}

QUnit.module('Render Portal', {
  setup() {
    env = new TestEnvironment();
  }
});

QUnit.test('basic', function(assert) {
  let externalElement = document.createElement('div');

  appendViewFor(
    stripTight`{{#-render-portal externalElement}}[{{foo}}]{{/-render-portal}}`,
    { externalElement, foo: 'Yippie!' }
  );

  equalsElement(externalElement, 'div', {}, stripTight`[Yippie!]`);
  assertAppended('<!--portal-->');

  set(view, 'foo', 'Double Yips!');
  rerender();

  equalsElement(externalElement, 'div', {}, stripTight`[Double Yips!]`);
  assertAppended('<!--portal-->');

  set(view, 'foo', 'Yippie!');
  rerender();

  equalsElement(externalElement, 'div', {}, stripTight`[Yippie!]`);
  assertAppended('<!--portal-->');
});

QUnit.test('initialized falsey', function(assert) {

  appendViewFor(
    stripTight`{{#-render-portal externalElement}}[{{foo}}]{{/-render-portal}}`,
    { externalElement: null, foo: 'Yippie!' }
  );

  assertAppended('<!--portal-->[Yippie!]');
});

QUnit.test('changing to falsey', function(assert) {
  let first = document.createElement('div');
  let second = document.createElement('div');

  appendViewFor(
    stripTight`
      |{{foo}}|
      {{#-render-portal first}}[{{foo}}]{{/-render-portal}}
      {{#-render-portal second}}[{{bar}}]{{/-render-portal}}
    `,
    { first, second: null, foo: 'Yippie 1!', bar: 'Bar 1!' }
  );

  equalsElement(first, 'div', {}, `[Yippie 1!]`);
  equalsElement(second, 'div', {}, ``);
  assertAppended('|Yippie 1!|<!--portal--><!--portal-->[Bar 1!]');

  set(view, 'foo', 'Double Yips 1!');
  set(view, 'bar', 'Bar 2!');
  rerender();

  equalsElement(first, 'div', {}, `[Double Yips 1!]`);
  equalsElement(second, 'div', {}, ``);
  assertAppended('|Double Yips 1!|<!--portal--><!--portal-->[Bar 2!]');

  set(view, 'foo', 'Double Yips 2!');
  set(view, 'bar', 'Bar 3!');
  set(view, 'first', null);
  rerender();

  equalsElement(first, 'div', {}, ``);
  equalsElement(second, 'div', {}, ``);
  assertAppended('|Double Yips 2!|<!--portal-->[Double Yips 2!]<!--portal-->[Bar 3!]');

  set(view, 'foo', 'Double Yips 3!');
  set(view, 'bar', 'Bar 4!');
  set(view, 'second', second);
  rerender();

  equalsElement(first, 'div', {}, ``);
  equalsElement(second, 'div', {}, `[Bar 4!]`);
  assertAppended('|Double Yips 3!|<!--portal-->[Double Yips 3!]<!--portal-->');

  set(view, 'foo', 'Yippie 2!');
  set(view, 'bar', 'Bar 5!');
  rerender();

  equalsElement(first, 'div', {}, ``);
  equalsElement(second, 'div', {}, `[Bar 5!]`);
  assertAppended('|Yippie 2!|<!--portal-->[Yippie 2!]<!--portal-->');

  set(view, 'foo', 'Yippie 3!');
  set(view, 'bar', 'Bar 6!');
  set(view, 'first', first);
  set(view, 'second', null);
  rerender();

  equalsElement(first, 'div', {}, `[Yippie 3!]`);
  equalsElement(second, 'div', {}, ``);
  assertAppended('|Yippie 3!|<!--portal--><!--portal-->[Bar 6!]');
});

QUnit.test('with pre-existing content', function(assert) {
  let externalElement = document.createElement('div');
  let initialContent = externalElement.innerHTML = '<p>Hello there!</p>';

  appendViewFor(
    stripTight`{{#-render-portal externalElement}}[{{foo}}]{{/-render-portal}}`,
    { externalElement, foo: 'Yippie 1!' }
  );

  assertAppended('<!--portal-->');
  equalsElement(externalElement, 'div', {}, `${initialContent}[Yippie 1!]`);

  set(view, 'foo', 'Double Yips 1!');
  rerender();

  assertAppended('<!--portal-->');
  equalsElement(externalElement, 'div', {}, `${initialContent}[Double Yips 1!]`);

  set(view, 'foo', 'Yippie 2!');
  rerender();

  assertAppended('<!--portal-->');
  equalsElement(externalElement, 'div', {}, `${initialContent}[Yippie 2!]`);

  set(view, 'foo', 'Yippie 3!');
  set(view, 'externalElement', null);
  rerender();

  assertAppended('<!--portal-->[Yippie 3!]');
  equalsElement(externalElement, 'div', {}, `${initialContent}`);

  set(view, 'foo', 'Yippie 4!');
  set(view, 'externalElement', externalElement);
  rerender();

  assertAppended('<!--portal-->');
  equalsElement(externalElement, 'div', {}, `${initialContent}[Yippie 4!]`);
});

QUnit.test('updating remote element', function(assert) {
  let first = document.createElement('div');
  let second = document.createElement('div');

  appendViewFor(
    stripTight`{{#-render-portal targetElement}}[{{foo}}]{{/-render-portal}}`,
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

QUnit.test('changing targets maintains referential integrity', function(assert) {
  let first = document.createElement('div');
  first.setAttribute('id', 'first');
  let second = document.createElement('div');
  second.setAttribute('id', 'second');
  let element;
  let cachedElement;

  function getViewElementById(id) {
    if (view.element) {
      let viewElement = view.element.matches('#stable-div') ? view.element
        : view.element.querySelector(`${id}`);

      if (viewElement) {
        return viewElement;
      }
    }

    return null;
  }

  appendViewFor(
    stripTight`
      {{#-render-portal element}}<div id="stable-div">{{foo}}</div>{{/-render-portal}}
    `,
    {
      element: null,
      foo: 'Yippie!'
    }
  );

  assertAppended('<!--portal--><div id="stable-div">Yippie!</div>');
  equalsElement(first, 'div', { id: 'first' }, ``);
  equalsElement(second, 'div', { id: 'second' }, ``);
  cachedElement = getViewElementById('stable-div');

  set(view, 'element', first);
  rerender();

  assertAppended('<!--portal-->');
  equalsElement(first, 'div', { id: 'first' }, `<div id="stable-div">Yippie!</div>`);
  equalsElement(second, 'div', { id: 'second' }, ``);
  element = first.querySelector(`#stable-div`);
  assert.ok(element === cachedElement, 'Moving from in-place maintained integrity');

  set(view, 'element', second);
  rerender();

  equalsElement(first, 'div', { id: 'first' }, ``);
  equalsElement(second, 'div', { id: 'second' }, `<div id="stable-div">Yippie!</div>`);
  element = second.querySelector(`#stable-div`);
  assert.equal(element, cachedElement, 'Moving to new destination maintained integrity');
});

QUnit.test('inside an `{{if}}', function(assert) {
  let first = document.createElement('div');
  let second = document.createElement('div');

  appendViewFor(
    stripTight`
      {{#if showFirst}}
        {{#-render-portal first}}[{{foo}}]{{/-render-portal}}
      {{/if}}
      {{#if showSecond}}
        {{#-render-portal second}}[{{foo}}]{{/-render-portal}}
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

QUnit.test('multiple', function(assert) {
  let firstElement = document.createElement('div');
  let secondElement = document.createElement('div');

  appendViewFor(
    stripTight`
      {{#-render-portal firstElement}}
        [{{foo}}]
      {{/-render-portal}}
      {{#-render-portal secondElement}}
        [{{bar}}]
      {{/-render-portal}}
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

QUnit.test('nesting', function(assert) {
  let firstElement = document.createElement('div');
  let secondElement = document.createElement('div');

  appendViewFor(
    stripTight`
      {{#-render-portal firstElement}}
        [{{foo}}]
        {{#-render-portal secondElement}}
          [{{bar}}]
        {{/-render-portal}}
      {{/-render-portal}}
      `,
    {
      firstElement,
      secondElement,
      foo: 'Hello!',
      bar: 'World!'
    }
  );

  equalsElement(firstElement, 'div', {}, stripTight`[Hello!]<!--portal-->`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);

  set(view, 'foo', 'GoodBye!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[GoodBye!]<!--portal-->`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);

  set(view, 'bar', 'Folks!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[GoodBye!]<!--portal-->`);
  equalsElement(secondElement, 'div', {}, stripTight`[Folks!]`);

  set(view, 'bar', 'World!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[GoodBye!]<!--portal-->`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);

  set(view, 'foo', 'Hello!');
  rerender();

  equalsElement(firstElement, 'div', {}, stripTight`[Hello!]<!--portal-->`);
  equalsElement(secondElement, 'div', {}, stripTight`[World!]`);
});

QUnit.test('components are destroyed', function(assert) {
  let destroyed = 0;
  let DestroyMeComponent = EmberishCurlyComponent.extend({
    destroy() {
      this._super();
      destroyed++;
    }
  });

  env.registerEmberishCurlyComponent('destroy-me', DestroyMeComponent as any, 'destroy me!');

  let externalElement = document.createElement('div');

  appendViewFor(
    stripTight`
      {{#if showExternal}}
        {{#-render-portal externalElement}}[{{destroy-me}}]{{/-render-portal}}
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

  assertElementIsEmberishElement(externalElement.firstElementChild, 'div', { }, 'destroy me!');
  assert.equal(destroyed, 0, 'component was destroyed');

  set(view, 'showExternal', false);
  rerender();

  equalsElement(externalElement, 'div', {}, stripTight``);
  assert.equal(destroyed, 1, 'component was destroyed');
});
