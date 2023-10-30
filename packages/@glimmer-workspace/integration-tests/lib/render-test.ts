import { destroy } from '@glimmer/destroyable';
import type {
  Dict,
  DynamicScope,
  Helper,
  Maybe,
  Nullable,
  Reference,
  RenderResult,
  SimpleElement,
  SimpleNode,
} from '@glimmer/interfaces';
import { inTransaction, renderComponent, renderSync } from '@glimmer/runtime';
import type { ASTPluginBuilder } from '@glimmer/syntax';
import { clearElement, dict, expect, isPresent, unwrap } from '@glimmer/util';
import { dirtyTagFor } from '@glimmer/validator';
import type { NTuple } from '@glimmer-workspace/test-utils';

import {
  type ComponentBlueprint,
  type ComponentKind,
  type ComponentTypes,
  CURLY_TEST_COMPONENT,
  GLIMMER_TEST_COMPONENT,
} from './components';
import { assertElementShape, assertEmberishElement } from './dom/assertions';
import { assertingElement, toInnerHTML } from './dom/simple-utils';
import type { UserHelper } from './helpers';
import type { TestModifierConstructor } from './modifiers';
import type RenderDelegate from './render-delegate';
import { equalTokens, isServerMarker, type NodesSnapshot, normalizeSnapshot } from './snapshot';
import {
  registerComponent,
  registerHelper,
  registerInternalHelper,
  registerModifier,
} from './modes/jit/register';
import { RecordedEvents } from './test-helpers/recorded';
import { createConstRef } from '@glimmer/reference';
import type { DomDelegate } from './render-delegate';
import { BuildDomDelegate } from './modes/jit/dom';

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type Present<T> = Exclude<T, null | undefined>;

export interface IRenderTest {
  readonly count: Count;
  testType: ComponentKind;
  beforeEach?(): void;
  afterEach?(): void;
}

export class Count {
  private expected: Record<string, number> = {};
  private actual: Record<string, number> = {};
  readonly #events: RecordedEvents;

  constructor(events: RecordedEvents) {
    this.#events = events;
  }

  expect(name: string, count = 1) {
    this.expected[name] = count;
    const prev = this.actual[name] ?? 0;
    this.actual[name] = prev + 1;
  }

  assert() {
    QUnit.assert.deepEqual(this.actual, this.expected, 'TODO');
    this.#events.finalize();
  }
}

class Self {
  #properties: Dict;
  readonly ref: Reference<Dict>;

  constructor(properties: Dict) {
    this.#properties = properties;
    this.ref = createConstRef(this.#properties, 'this');
  }

  get inner(): Dict {
    return this.#properties;
  }

  set(key: string, value: unknown): void {
    this.#properties[key] = value;
    dirtyTagFor(this.#properties, key);
  }

  delete(key: string): void {
    delete this.#properties[key];
    dirtyTagFor(this.#properties, key);
  }

  initialize(properties: Dict): void {
    for (const [key, value] of Object.entries(properties)) {
      this.set(key, value);
    }

    for (const key of Object.keys(this.#properties)) {
      if (!(key in properties)) {
        this.delete(key);
      }
    }
  }

  update(properties: Dict): void {
    for (const [key, value] of Object.entries(properties)) {
      this.set(key, value);
    }
  }
}

export class RenderTest implements IRenderTest {
  testType: ComponentKind = 'unknown';
  readonly events = new RecordedEvents();

  readonly self = new Self({});
  protected element: SimpleElement;
  protected assert = QUnit.assert;
  protected renderResult: Nullable<RenderResult> = null;
  protected helpers = dict<UserHelper>();
  protected snapshot: NodesSnapshot = [];
  readonly count: Count;
  readonly dom: DomDelegate;

  readonly plugins: ASTPluginBuilder[] = [];

  constructor(protected delegate: RenderDelegate) {
    this.element = delegate.dom.getInitialElement(delegate.dom.document);
    this.count = new Count(this.events);
    this.dom = new BuildDomDelegate(delegate.dom);
  }

  getInitialElement(): SimpleElement {
    return this.element;
  }

  capture<T>() {
    let instance: T;
    return {
      capture: (value: T) => (instance = value),
      get captured(): T {
        return unwrap(instance);
      },
    };
  }

  registerPlugin(plugin: ASTPluginBuilder): void {
    this.plugins.push(plugin);
  }

  readonly register = {
    helper: (name: string, helper: UserHelper) => {
      for (const registry of this.delegate.registries) {
        registerHelper(registry, name, helper);
      }
    },

    internalHelper: (name: string, helper: Helper) => {
      for (const registry of this.delegate.registries) {
        registerInternalHelper(registry, name, helper);
      }
    },

    modifier: (name: string, ModifierClass: TestModifierConstructor) => {
      for (const registry of this.delegate.registries) {
        registerModifier(registry, name, ModifierClass);
      }
    },

    component: <K extends ComponentKind>(
      type: K,
      name: string,
      layout: Nullable<string>,
      Class?: ComponentTypes[K]
    ): void => {
      for (const registry of this.delegate.registries) {
        registerComponent(registry, type, name, layout, Class);
      }
    },
  };

  buildComponent(blueprint: ComponentBlueprint): string {
    let invocation = '';
    switch (this.testType) {
      case 'Glimmer':
        invocation = this.buildGlimmerComponent(blueprint);
        break;
      case 'Curly':
        invocation = this.buildCurlyComponent(blueprint);
        break;
      case 'Dynamic':
        invocation = this.buildDynamicComponent(blueprint);
        break;
      case 'TemplateOnly':
        invocation = this.buildTemplateOnlyComponent(blueprint);
        break;

      default:
        throw new Error(`Invalid test type ${this.testType}`);
    }

    return invocation;
  }

  private buildArgs(args: Dict): string {
    let { testType } = this;
    let sigil = '';
    let needsCurlies = false;

    if (testType === 'Glimmer' || testType === 'TemplateOnly') {
      sigil = '@';
      needsCurlies = true;
    }

    return `${Object.keys(args)
      .map((arg) => {
        let rightSide: string;

        let value = args[arg] as Maybe<string[]>;
        if (needsCurlies) {
          let isString = value && (value[0] === "'" || value[0] === '"');
          if (isString) {
            rightSide = `${value}`;
          } else {
            rightSide = `{{${value}}}`;
          }
        } else {
          rightSide = `${value}`;
        }

        return `${sigil}${arg}=${rightSide}`;
      })
      .join(' ')}`;
  }

  private buildBlockParams(blockParams: string[]): string {
    return `${blockParams.length > 0 ? ` as |${blockParams.join(' ')}|` : ''}`;
  }

  private buildElse(elseBlock: string | undefined): string {
    return `${elseBlock ? `{{else}}${elseBlock}` : ''}`;
  }

  private buildAttributes(attrs: Dict = {}): string {
    return Object.keys(attrs)
      .map((attr) => `${attr}=${attrs[attr]}`)
      .join(' ');
  }

  private buildAngleBracketComponent(blueprint: ComponentBlueprint): string {
    let {
      args = {},
      attributes = {},
      template,
      name = GLIMMER_TEST_COMPONENT,
      blockParams = [],
    } = blueprint;

    let invocation: string | string[] = [];

    invocation.push(`<${name}`);

    let componentArgs = this.buildArgs(args);

    if (componentArgs !== '') {
      invocation.push(componentArgs);
    }

    let attrs = this.buildAttributes(attributes);
    if (attrs !== '') {
      invocation.push(attrs);
    }

    let open = invocation.join(' ');
    invocation = [open];

    if (template) {
      let block: string | string[] = [];
      let params = this.buildBlockParams(blockParams);
      if (params !== '') {
        block.push(params);
      }
      block.push(`>`);
      block.push(template);
      block.push(`</${name}>`);
      invocation.push(block.join(''));
    } else {
      invocation.push(' ');
      invocation.push(`/>`);
    }

    return invocation.join('');
  }

  private buildGlimmerComponent(blueprint: ComponentBlueprint): string {
    let { tag = 'div', layout, name = GLIMMER_TEST_COMPONENT } = blueprint;
    let invocation = this.buildAngleBracketComponent(blueprint);
    let layoutAttrs = this.buildAttributes(blueprint.layoutAttributes);
    this.assert.ok(
      true,
      `generated glimmer layout as ${`<${tag} ${layoutAttrs} ...attributes>${layout}</${tag}>`}`
    );
    this.register.component(
      'Glimmer',
      name,
      `<${tag} ${layoutAttrs} ...attributes>${layout}</${tag}>`
    );
    this.assert.ok(true, `generated glimmer invocation as ${invocation}`);
    return invocation;
  }

  private buildCurlyBlockTemplate(
    name: string,
    template: string,
    blockParams: string[],
    elseBlock?: string
  ): string {
    let block: string[] = [];
    block.push(this.buildBlockParams(blockParams));
    block.push('}}');
    block.push(template);
    block.push(this.buildElse(elseBlock));
    block.push(`{{/${name}}}`);
    return block.join('');
  }

  private buildCurlyComponent(blueprint: ComponentBlueprint): string {
    let {
      args = {},
      layout,
      template,
      attributes,
      else: elseBlock,
      name = CURLY_TEST_COMPONENT,
      blockParams = [],
    } = blueprint;

    if (attributes) {
      throw new Error('Cannot pass attributes to curly components');
    }

    let invocation: string[] | string = [];

    if (template) {
      invocation.push(`{{#${name}`);
    } else {
      invocation.push(`{{${name}`);
    }

    let componentArgs = this.buildArgs(args);

    if (componentArgs !== '') {
      invocation.push(' ');
      invocation.push(componentArgs);
    }

    if (template) {
      invocation.push(this.buildCurlyBlockTemplate(name, template, blockParams, elseBlock));
    } else {
      invocation.push('}}');
    }
    this.assert.ok(true, `generated curly layout as ${layout}`);
    this.register.component('Curly', name, layout);
    invocation = invocation.join('');
    this.assert.ok(true, `generated curly invocation as ${invocation}`);
    return invocation;
  }

  private buildTemplateOnlyComponent(blueprint: ComponentBlueprint): string {
    let { layout, name = GLIMMER_TEST_COMPONENT } = blueprint;
    let invocation = this.buildAngleBracketComponent(blueprint);
    this.assert.ok(true, `generated fragment layout as ${layout}`);
    this.register.component('TemplateOnly', name, `${layout}`);
    this.assert.ok(true, `generated fragment invocation as ${invocation}`);
    return invocation;
  }

  private buildDynamicComponent(blueprint: ComponentBlueprint): string {
    let {
      args = {},
      layout,
      template,
      attributes,
      else: elseBlock,
      name = GLIMMER_TEST_COMPONENT,
      blockParams = [],
    } = blueprint;

    if (attributes) {
      throw new Error('Cannot pass attributes to curly components');
    }

    let invocation: string | string[] = [];
    if (template) {
      invocation.push('{{#component this.componentName');
    } else {
      invocation.push('{{component this.componentName');
    }

    let componentArgs = this.buildArgs(args);

    if (componentArgs !== '') {
      invocation.push(' ');
      invocation.push(componentArgs);
    }

    if (template) {
      invocation.push(this.buildCurlyBlockTemplate('component', template, blockParams, elseBlock));
    } else {
      invocation.push('}}');
    }

    this.assert.ok(true, `generated dynamic layout as ${layout}`);
    this.register.component('Curly', name, layout);
    invocation = invocation.join('');
    this.assert.ok(true, `generated dynamic invocation as ${invocation}`);

    return invocation;
  }

  shouldBeVoid(tagName: string) {
    clearElement(this.element);
    let html = '<' + tagName + " data-foo='bar'><p>hello</p>";
    this.delegate.renderTemplate(
      html,
      this.self.ref,
      this.element,
      () => this.takeSnapshot(),
      this.plugins
    );

    let tag = '<' + tagName + ' data-foo="bar">';
    let closing = '</' + tagName + '>';
    let extra = '<p>hello</p>';
    html = toInnerHTML(this.element);

    QUnit.assert.pushResult({
      result: html === tag + extra || html === tag + closing + extra,
      actual: html,
      expected: tag + closing + extra,
      message: tagName + ' should be a void element',
    });
  }

  readonly render = {
    template: (template: string | ComponentBlueprint, properties: Dict<unknown> = {}) =>
      this.#renderTemplate(template, properties),

    component: (
      component: object,
      args: Record<string, unknown> = {},
      {
        into: element = this.element,
        dynamicScope,
      }: { into?: SimpleElement; dynamicScope?: DynamicScope } = {}
    ): void => {
      let cursor = { element, nextSibling: null };

      let { program, runtime } = this.delegate.context;
      let builder = this.delegate.getElementBuilder(runtime.env, cursor);
      let iterator = renderComponent(runtime, builder, program, {}, component, args, dynamicScope);

      this.renderResult = renderSync(runtime.env, iterator);
    },
  };

  #renderTemplate(template: string | ComponentBlueprint, properties: Dict<unknown> = {}): void {
    try {
      QUnit.assert.ok(true, `Rendering ${String(template)} with ${JSON.stringify(properties)}`);
    } catch {
      // couldn't stringify, possibly has a circular dependency
    }

    if (typeof template === 'object') {
      let blueprint = template;
      template = this.buildComponent(blueprint);

      if (this.testType === 'Dynamic' && properties['componentName'] === undefined) {
        properties['componentName'] = blueprint.name || GLIMMER_TEST_COMPONENT;
      }
    }

    this.self.initialize(properties);

    this.renderResult = this.delegate.renderTemplate(
      template,
      this.self.ref,
      this.element,
      () => this.takeSnapshot(),
      this.plugins
    );
  }

  rerender(properties: Dict<unknown> = {}): void {
    try {
      QUnit.assert.ok(true, `rerender ${JSON.stringify(properties)}`);
    } catch {
      // couldn't stringify, possibly has a circular dependency
    }

    this.self.update(properties);

    let result = expect(this.renderResult, 'the test should call render() before rerender()');

    try {
      this.events.record('env:begin');
      result.env.begin();
      result.rerender();
    } finally {
      result.env.commit();
      this.events.record('env:commit');
    }
  }

  destroy(): void {
    let result = expect(this.renderResult, 'the test should call render() before destroy()');

    inTransaction(result.env, () => destroy(result));
  }

  protected takeSnapshot(): NodesSnapshot {
    let snapshot: NodesSnapshot = (this.snapshot = []);

    let node = this.element.firstChild;
    let upped = false;

    while (node && node !== this.element) {
      if (upped) {
        if (node.nextSibling) {
          node = node.nextSibling;
          upped = false;
        } else {
          snapshot.push('up');
          node = node.parentNode;
        }
      } else {
        if (!isServerMarker(node)) snapshot.push(node);

        if (node.firstChild) {
          snapshot.push('down');
          node = node.firstChild;
        } else if (node.nextSibling) {
          node = node.nextSibling;
        } else {
          snapshot.push('up');
          node = node.parentNode;
          upped = true;
        }
      }
    }

    return snapshot;
  }

  protected assertStableRerender() {
    this.takeSnapshot();
    this.runTask(() => this.rerender());
    this.assertStableNodes();
  }

  protected guard(condition: any, message: string): asserts condition {
    if (condition) {
      this.assert.ok(condition, message);
    } else {
      throw Error(`Guard Failed: message`);
    }
  }

  protected guardWith<T, U extends T, K extends string>(
    desc: { [P in K]: T },
    { condition }: { condition: (value: T) => value is U }
  ): U {
    let [description, value] = Object.entries(desc)[0] as [string, T];

    if (condition(value)) {
      this.assert.ok(
        condition(value),
        `${description} satisfied ${condition.name ?? '{anonymous guard}'}`
      );
      return value;
    } else {
      throw Error(
        `Guard Failed: ${description} didn't satisfy ${condition.name ?? '{anonymous guard}'}`
      );
    }
  }

  protected guardPresent<T, K extends string>(desc: { [P in K]: T }): Present<T> {
    let [description, value] = Object.entries(desc)[0] as [string, T];

    let missing = value === undefined || value === null;

    if (missing) {
      throw Error(`Guard Failed: ${description} was not present (was ${String(value)})`);
    }

    this.assert.ok(!missing, `${description} was present`);

    return value as Present<T>;
  }

  protected guardArray<T extends Maybe<unknown>[], K extends string>(desc: { [P in K]: T }): {
    [K in keyof T]: Present<T[K]>;
  };
  protected guardArray<T, K extends string, N extends number>(
    desc: { [P in K]: Iterable<T> | ArrayLike<T> },
    options: { min: N }
  ): Expand<NTuple<N, Present<T>>>;
  protected guardArray<T, U extends T, K extends string, N extends number>(
    desc: { [P in K]: Iterable<T> | ArrayLike<T> },
    options: { min: N; condition: (value: T) => value is U }
  ): Expand<NTuple<N, U>>;
  protected guardArray<T, K extends string, A extends ArrayLike<T>>(desc: { [P in K]: A }): Expand<
    NTuple<A['length'], Present<T>>
  >;
  protected guardArray<T, K extends string>(desc: {
    [P in K]: Iterable<T> | ArrayLike<T>;
  }): Present<T>[];
  protected guardArray<T, K extends string, U extends T>(
    desc: {
      [P in K]: Iterable<T> | ArrayLike<T>;
    },
    options: { condition: (value: T) => value is U; min?: number }
  ): U[];
  protected guardArray(
    desc: Record<string, Iterable<unknown> | ArrayLike<unknown>>,
    options?: {
      min?: Maybe<number>;
      condition?: (value: unknown) => boolean;
    }
  ): unknown[] {
    let [message, list] = Object.entries(desc)[0] as [string, unknown[]];

    let array: unknown[] = Array.from(list);
    let condition: (value: unknown) => boolean;

    if (typeof options?.min === 'number') {
      if (array.length < options.min) {
        throw Error(
          `Guard Failed: expected to have at least ${options.min} (of ${message}), but got ${array.length}`
        );
      }

      array = array.slice(0, options.min);
      condition = (value) => value !== null && value !== undefined;
      message = `${message}: ${options.min} present elements`;
    } else if (options?.condition) {
      condition = options.condition;
    } else {
      condition = isPresent;
      message = `${message}: all are present`;
    }

    let succeeds = array.every(condition);

    if (succeeds) {
      this.assert.ok(succeeds, message);
    } else {
      throw Error(`Guard Failed: ${message}`);
    }

    return array;
  }

  protected assertHTML(html: string, elementOrMessage?: SimpleElement | string, message?: string) {
    if (typeof elementOrMessage === 'object') {
      equalTokens(elementOrMessage || this.element, html, message ? `${html} (${message})` : html);
    } else {
      equalTokens(this.element, html, elementOrMessage ? `${html} (${elementOrMessage})` : html);
    }
    this.takeSnapshot();
  }

  protected assertComponent(content: string, attrs: Object = {}) {
    let element = assertingElement(this.element.firstChild);

    switch (this.testType) {
      case 'Glimmer':
        assertElementShape(element, 'div', attrs, content);
        break;
      default:
        assertEmberishElement(element, 'div', attrs, content);
    }

    this.takeSnapshot();
  }

  private runTask<T>(callback: () => T): T {
    return callback();
  }

  protected assertStableNodes(
    { except: _except }: { except: SimpleNode | SimpleNode[] } = {
      except: [],
    }
  ) {
    let except: Array<SimpleNode>;

    if (Array.isArray(_except)) {
      except = uniq(_except);
    } else {
      except = [_except];
    }

    let { oldSnapshot, newSnapshot } = normalizeSnapshot(
      this.snapshot,
      this.takeSnapshot(),
      except
    );

    this.assert.deepEqual(oldSnapshot, newSnapshot, 'DOM nodes are stable');
  }
}

function uniq(arr: any[]) {
  return arr.reduce((accum, val) => {
    if (accum.indexOf(val) === -1) accum.push(val);
    return accum;
  }, []);
}
