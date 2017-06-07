import { Opaque, Option, Dict } from "@glimmer/interfaces";
import { Template, RenderResult, RenderOptions, IteratorResult } from "@glimmer/runtime";
import { TestEnvironment, equalTokens, TestDynamicScope } from "@glimmer/test-helpers";
import { UpdatableReference } from "@glimmer/object-reference";
import { expect, dict } from "@glimmer/util";

type NodesSnapshot = Node[];

abstract class RenderTest {
  protected abstract element: HTMLElement;

  protected assert = QUnit.assert;
  protected context = dict<Opaque>();
  protected renderResult: Option<RenderResult> = null;
  private snapshot: NodesSnapshot = [];

  constructor(protected env = new TestEnvironment()) {}

  @test "HTML text content"() {
    this.render("content");
    this.assertHTML("content");
    this.assertStableRerender();
  }

  @test "HTML tags"() {
    this.render("<h1>hello!</h1><div>content</div>");
    this.assertHTML("<h1>hello!</h1><div>content</div>");
    this.assertStableRerender();
  }

  @test "HTML attributes"() {
    this.render("<div class='foo' id='bar'>content</div>");
    this.assertHTML("<div class='foo' id='bar'>content</div>");
    this.assertStableRerender();
  }

  @test "HTML tag with empty attribute"() {
    this.render("<div class=''>content</div>");
    this.assertHTML("<div class=''>content</div>");
    this.assertStableRerender();
  }

  @test "HTML boolean attribute 'disabled'"(assert: typeof QUnit.assert) {
    this.render('<input disabled>');
    this.assertHTML("<input disabled>");

    // TODO: What is the point of this test? (Note that it wouldn't work with SimpleDOM)
    // assertNodeProperty(root.firstChild, 'input', 'disabled', true);

    this.assertStableRerender();
  }

  @test "Quoted attribute null values do not disable"() {
    this.render('<input disabled="{{isDisabled}}">', { isDisabled: null });
    this.assertHTML('<input>');
    this.assertStableRerender();

    // TODO: What is the point of this test? (Note that it wouldn't work with SimpleDOM)
    // assertNodeProperty(root.firstChild, 'input', 'disabled', false);

    this.rerender({ isDisabled: true });
    this.assertHTML('<input disabled>');
    this.assertStableNodes();

    // TODO: ??????????
    this.rerender({ isDisabled: false });
    this.assertHTML('<input disabled>');
    this.assertStableNodes();

    this.rerender({ isDisabled: null });
    this.assertHTML('<input>');
    this.assertStableNodes();
  }

  @test "Unquoted attribute null values do not disable"() {
    this.render('<input disabled={{isDisabled}}>', { isDisabled: null });
    this.assertHTML('<input>');
    this.assertStableRerender();

    // TODO: What is the point of this test? (Note that it wouldn't work with SimpleDOM)
    // assertNodeProperty(root.firstChild, 'input', 'disabled', false);

    this.rerender({ isDisabled: true });
    this.assertHTML('<input disabled>');
    this.assertStableRerender();

    this.rerender({ isDisabled: false });
    this.assertHTML('<input>');
    this.assertStableRerender();

    this.rerender({ isDisabled: null });
    this.assertHTML('<input>');
    this.assertStableRerender();
  }

  @test "Quoted attribute string values"() {
    this.render("<img src='{{src}}'>", { src: 'image.png' });
    this.assertHTML("<img src='image.png'>");
    this.assertStableRerender();

    this.rerender({ src: 'newimage.png' });
    this.assertHTML("<img src='newimage.png'>");
    this.assertStableNodes();

    this.rerender({ src: '' });
    this.assertHTML("<img src=''>");
    this.assertStableNodes();

    this.rerender({ src: 'image.png' });
    this.assertHTML("<img src='image.png'>");
    this.assertStableNodes();
  }

  @test "HTML comments"() {
    this.render('<div><!-- Just passing through --></div>');
    this.assertHTML('<div><!-- Just passing through --></div>');
    this.assertStableRerender();
  }

  @test "HTML comments with multi-line mustaches"() {
    this.render('<div><!-- {{#each foo as |bar|}}\n{{bar}}\n\n{{/each}} --></div>');
    this.assertHTML('<div><!-- {{#each foo as |bar|}}\n{{bar}}\n\n{{/each}} --></div>');
    this.assertStableRerender();
  }

  @test "Text curlies"() {
    this.render('<div>{{title}}<span>{{title}}</span></div>', { title: 'hello' });
    this.assertHTML('<div>hello<span>hello</span></div>');
    this.assertStableRerender();

    this.rerender({ title: 'goodbye' });
    this.assertHTML('<div>goodbye<span>goodbye</span></div>');
    this.assertStableNodes();

    this.rerender({ title: '' });
    this.assertHTML('<div><span></span></div>');
    this.assertStableNodes();

    this.rerender({ title: 'hello' });
    this.assertHTML('<div>hello<span>hello</span></div>');
    this.assertStableNodes();
  }

  protected compile(template: string): Template<Opaque> {
    return this.env.compile(template);
  }

  render(template: string, properties: Dict<Opaque> = {}): void {
    this.setProperties(properties);

    this.renderResult = this.renderTemplate(this.compile(template));
  }

  protected abstract renderTemplate(template: Template<Opaque>): RenderResult;

  rerender(properties: Dict<Opaque> = {}): void {
    this.setProperties(properties);

    this.env.begin();
    expect(this.renderResult, 'the test should call render() before rerender()').rerender();
    this.env.commit();
  }

  protected set(key: string, value: Opaque): void {
    this.context[key] = value;
  }

  protected setProperties(properties: Dict<Opaque>): void {
    Object.assign(this.context, properties);
  }

  private takeSnapshot() {
    let snapshot: Node[] = this.snapshot = [];

    let node = this.element.firstChild;

    while (node && node !== this.element) {
      snapshot.push(node);

      if (node.firstChild) {
        node = node.firstChild;
      } else if (node.nextSibling) {
        node = node.nextSibling;
      } else {
        node = node.parentNode!.nextSibling;
      }
    }

    return snapshot;
  }

  protected assertStableRerender() {
    this.takeSnapshot();
    this.runTask(() => this.rerender());
    this.assertStableNodes();
  }

  protected assertHTML(html: string) {
    equalTokens(this.element, html);
  }

  private runTask<T>(callback: () => T): T {
    return callback();
  }

  protected assertStableNodes() {
    let oldSnapshot = this.snapshot;
    let newSnapshot = this.takeSnapshot();

    this.assert.strictEqual(newSnapshot.length, oldSnapshot.length, 'Same number of nodes');

    for (let i = 0; i < oldSnapshot.length; i++) {
      this.assertSameNode(newSnapshot[i], oldSnapshot[i]);
    }
  }

  private assertSameNode(actual: Node, expected: Node) {
    this.assert.strictEqual(actual, expected, 'DOM node stability');
  }
}

module("Initial Render Tests", class extends RenderTest {
  protected element: HTMLDivElement;

  constructor(env = new TestEnvironment()) {
    super(env);
    this.element = env.getDOM().createElement('div') as HTMLDivElement;
  }

  renderTemplate(template: Template<Opaque>): RenderResult {
    return renderTemplate(this.env, template, {
      self: new UpdatableReference(this.context),
      parentNode: this.element,
      dynamicScope: new TestDynamicScope()
    });
  }
});

module("Rehydration Tests", class extends RenderTest {
  protected element: HTMLDivElement;

  constructor(env = new TestEnvironment()) {
    super(env);
    this.element = env.getDOM().createElement('div') as HTMLDivElement;
  }

  renderTemplate(template: Template<Opaque>) {
    // Emulate server-side render
    renderTemplate(new TestEnvironment(), template, {
      self: new UpdatableReference(this.context),
      parentNode: this.element,
      dynamicScope: new TestDynamicScope()
    });

    // Remove adjacent/empty text nodes
    this.element.normalize();

    // Client-side rehydration
    return renderTemplate(this.env, template, {
      self: new UpdatableReference(this.context),
      parentNode: this.element,
      dynamicScope: new TestDynamicScope(),
      rehydrate: true
    });
  }
});

function test(_target: Object, _name: string, descriptor: PropertyDescriptor): PropertyDescriptor | void {
  let testFunction = descriptor.value as Function;
  descriptor.enumerable = true;
  testFunction['isTest'] = true;
}

function module(name: string, klass: typeof RenderTest & Function): void {
  QUnit.module(`[NEW] ${name}`);

  for (let prop in klass.prototype) {
    const test = klass.prototype[prop];

    if (isTestFunction(test)) {
      QUnit.test(prop, assert => test.call(new klass(), assert));
    }
  }
}

function isTestFunction(value: any): value is (this: RenderTest, assert: typeof QUnit.assert) => void {
  return typeof value === 'function' && value.isTest;
}

function renderTemplate(env: TestEnvironment, template: Template<Opaque>, options: RenderOptions) {
  env.begin();

  let templateIterator = template.render(options);

  let iteratorResult: IteratorResult<RenderResult>;

  do {
    iteratorResult = templateIterator.next();
  } while (!iteratorResult.done);

  let result = iteratorResult.value;

  env.commit();

  return result;
}

function isMarker(node: Node) {
  if (node instanceof Comment && node.textContent === '') {
    return true;
  }

  if (node instanceof Text && node.textContent === '') {
    return true;
  }

  return false;
}
