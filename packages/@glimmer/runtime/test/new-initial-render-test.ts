import { Opaque } from "@glimmer/interfaces";
import { Template, RenderResult, RenderOptions, IteratorResult } from "@glimmer/runtime";
import { TestEnvironment, equalTokens, TestDynamicScope } from "@glimmer/test-helpers";
import { UpdatableReference } from "@glimmer/object-reference";

abstract class RenderTest {
  protected abstract rootElement: HTMLElement;
  protected assert = QUnit.assert;

  constructor(protected env = new TestEnvironment()) {}

  @test "HTML text content"() {
    this.render(this.compile("content"), {});
    equalTokens(this.rootElement, "content");
  }

  @test "HTML tags"() {
    this.render(this.compile("<h1>hello!</h1><div>content</div>"), {});
    equalTokens(this.rootElement, "<h1>hello!</h1><div>content</div>");
  }

  protected compile(template: string): Template<Opaque> {
    return this.env.compile(template);
  }

  protected abstract render(template: Template<Opaque>, context: Opaque): RenderResult;
}

module("Initial Render Tests", class extends RenderTest {
  protected rootElement: HTMLDivElement;

  constructor(env = new TestEnvironment()) {
    super(env);
    this.rootElement = env.getDOM().createElement('div') as HTMLDivElement;
  }

  render(template: Template<Opaque>, context: Opaque): RenderResult {
    return renderTemplate(this.env, template, {
      self: new UpdatableReference(context),
      parentNode: this.rootElement,
      dynamicScope: new TestDynamicScope()
    });
  }
});

module("Rehydration Tests", class extends RenderTest {
  protected rootElement: HTMLDivElement;

  constructor(env = new TestEnvironment()) {
    super(env);
    this.rootElement = env.getDOM().createElement('div') as HTMLDivElement;
  }

  render(template: Template<Opaque>, context: Opaque): RenderResult {
    // Server-side render
    renderTemplate(new TestEnvironment(), template, {
      self: new UpdatableReference(context),
      parentNode: this.rootElement,
      dynamicScope: new TestDynamicScope()
    });

    // Client-side rehydration
    return renderTemplate(this.env, template, {
      self: new UpdatableReference(context),
      parentNode: this.rootElement,
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
