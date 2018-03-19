import { Interpreter } from './interpreter';
import { SerializedTemplateBlock } from '@glimmer/wire-format';
import { TemplateCompiler } from '@glimmer/compiler';
import { preprocess } from '@glimmer/syntax';
import { test } from '@glimmer/test-helpers';
import * as SimpleDOM from 'simple-dom';
import { Simple, Opaque, Dict } from '@glimmer/interfaces';
import { dict } from '@glimmer/util';

@module('[glimmer-compiler] Interpreter Test')
class InterpreterTest {
  protected serializer: SimpleDOM.HTMLSerializer;
  constructor() {
    this.serializer = new SimpleDOM.HTMLSerializer(SimpleDOM.voidMap);
  }

  get assert() {
    return QUnit.assert;
  }

  assertHTML(element: Simple.Element, html: string) {
    let serialized = this.serializer.serializeChildren(element);
    this.assert.equal(serialized, html);
  }

  main(template: string, context: Opaque = null) {
    let i = new Interpreter({
      main: compile(template)
    }, {});

    return i.main(context);
  }

  templates(t: { main: string } & Dict<string>, context: Opaque) {
    let templates = dict<SerializedTemplateBlock>();

    for (let name in t) {
      templates[name] = compile(t[name]);
    }

    let i = new Interpreter(templates, {});

    return i.main(context);
  }

  assertHtmlRoundTrip(text: string) {
    this.assertHTML(this.main(text), text);
  }

  assertInterpolated(template: string, context: Opaque, result: string) {
    this.assertHTML(this.main(template, context), result);
  }

  @test "simple text"() {
    this.assertHtmlRoundTrip('hello world');
  }

  @test "simple HTML"() {
    this.assertHtmlRoundTrip('<p>hello <span>world</span></p>');
  }

  @test "HTML with attributes"() {
    this.assertHtmlRoundTrip(`
       <p class="outer world">
         hello <span rel="world">world</span>
       </p>
    `);
  }

  @test "simple curly"() {
    this.assertInterpolated(
      'hello {{world}}',
      { world: 'world' },
      'hello world'
    );
  }

  @test "curlies in HTML text"() {
    this.assertInterpolated(`<p class="outer world">
      hello <span rel="world">{{world}}</span>
    </p>`,
    { world: 'world' },
    `<p class="outer world">
      hello <span rel="world">world</span>
    </p>`);
  }

  @test "curlies in attribute positions"() {
    this.assertInterpolated(`<p class="{{outer}} {{world}}">
      hello <span rel="{{world}}">{{world}}</span>
    </p>`,
    { outer: 'Outer', world: 'World' },
    `<p class="Outer World">
      hello <span rel="World">World</span>
    </p>`);
  }

  @test "simple components"() {
    let main = this.templates({
      main: `<Let @item={{this.value}} as |item|>{{this.hello}} - {{item}}</Let>`,
      Let: `{{yield @item}}`
    }, { hello: 'Hello', value: 'World' });

    this.assertHTML(main, 'Hello - World');
  }

  @test "nested components"() {
    // TODO: pass upvars in correctly
    let main = this.templates({
      main: `<Let @item={{this.person}} as |person|><Let @item={{person.name}} as |name|>{{this.hello}} - {{name.first}}</Let></Let>`,
      Let: `{{yield @item}}`
    }, { person: { name: { first: 'Tom' } }, hello: 'Hello' });

    this.assertHTML(main, 'Hello - Tom');
  }
}

function compile(template: string): SerializedTemplateBlock {
  let ast = preprocess(template);
  return TemplateCompiler.compile(ast).toJSON();
}

function module(desc: string) {
  return (klass: typeof InterpreterTest) => {
    QUnit.module(desc);

    for (let prop in klass.prototype) {
      const test = klass.prototype[prop];

      if (isTestFunction(test)) {
        QUnit.test(prop, assert => test.call(new klass(), assert));
      }
    }
  };
}

function isTestFunction(
  value: any
): value is (this: any, assert: typeof QUnit.assert) => void {
  return typeof value === 'function' && value.isTest;
}
