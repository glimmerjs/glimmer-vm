import type {
  ComponentDefinitionState,
  Dict,
  DynamicScope,
  Helper,
  Maybe,
  Nullable,
  RenderResult,
  SimpleElement,
  SimpleNode,
} from '@glimmer/interfaces';
import type { ASTPluginBuilder } from '@glimmer/syntax';
import type { NTuple } from '@glimmer-workspace/test-utils';
import { expect, isPresent, localAssert, unwrap } from '@glimmer/debug-util';
import { destroy } from '@glimmer/destroyable';
import { inTransaction } from '@glimmer/runtime';
import { clearElement, dict } from '@glimmer/util';
import { dirtyTagFor } from '@glimmer/validator';

import type { ComponentBlueprint, ComponentKind, ComponentTypes } from './components';
import type { UserHelper } from './helpers';
import type { TestModifierConstructor } from './modifiers';
import type RenderDelegate from './render-delegate';
import type { NodesSnapshot } from './snapshot';

import { CURLY_TEST_COMPONENT, GLIMMER_TEST_COMPONENT } from './components';
import { assertElementShape, assertEmberishElement } from './dom/assertions';
import { assertingElement, toInnerHTML } from './dom/simple-utils';
import { equalTokens, isServerMarker, normalizeSnapshot } from './snapshot';
import { defineComponent } from './test-helpers/define';

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

  expect(name: string, count = 1) {
    this.expected[name] = count;
    const prev = this.actual[name] ?? 0;
    this.actual[name] = prev + 1;
  }

  assert() {
    QUnit.assert.deepEqual(this.actual, this.expected, 'TODO');
  }
}

export class RenderTest implements IRenderTest {
  testType: ComponentKind = 'unknown';

  protected element: SimpleElement;
  assert = QUnit.assert;
  protected context: Dict = dict();
  protected renderResult: Nullable<RenderResult> = null;
  protected helpers = dict<UserHelper>();
  protected snapshot: NodesSnapshot = [];
  readonly count = new Count();

  constructor(protected delegate: RenderDelegate) {
    this.element = delegate.getInitialElement();
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
    this.delegate.registerPlugin(plugin);
  }

  registerHelper(name: string, helper: UserHelper): void {
    this.delegate.registerHelper(name, helper);
  }

  registerInternalHelper(name: string, helper: Helper): void {
    this.delegate.registerInternalHelper(name, helper);
  }

  registerModifier(name: string, ModifierClass: TestModifierConstructor): void {
    this.delegate.registerModifier(name, ModifierClass);
  }

  registerComponent<K extends ComponentKind>(
    type: K,
    name: string,
    layout: string,
    Class?: ComponentTypes[K]
  ): void {
    this.delegate.registerComponent(type, this.testType, name, layout, Class);
  }

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

    return Object.keys(args)
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
      .join(' ');
  }

  private buildBlockParams(blockParams: string[]): string {
    return blockParams.length > 0 ? ` as |${blockParams.join(' ')}|` : '';
  }

  private buildElse(elseBlock: string | undefined): string {
    return elseBlock ? `{{else}}${elseBlock}` : '';
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
      `generated glimmer layout as <${tag} ${layoutAttrs} ...attributes>${layout}</${tag}>`
    );
    this.delegate.registerComponent(
      'Glimmer',
      this.testType,
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
    this.delegate.registerComponent('Curly', this.testType, name, layout);
    invocation = invocation.join('');
    this.assert.ok(true, `generated curly invocation as ${invocation}`);
    return invocation;
  }

  private buildTemplateOnlyComponent(blueprint: ComponentBlueprint): string {
    let { layout, name = GLIMMER_TEST_COMPONENT } = blueprint;
    let invocation = this.buildAngleBracketComponent(blueprint);
    this.assert.ok(true, `generated fragment layout as ${layout}`);
    this.delegate.registerComponent('TemplateOnly', this.testType, name, layout);
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
    this.delegate.registerComponent('Curly', this.testType, name, layout);
    invocation = invocation.join('');
    this.assert.ok(true, `generated dynamic invocation as ${invocation}`);

    return invocation;
  }

  shouldBeVoid(tagName: string) {
    clearElement(this.element);
    let html = '<' + tagName + " data-foo='bar'><p>hello</p>";
    this.delegate.renderTemplate(html, this.context, this.element, () => this.takeSnapshot());

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

  render(template: string | ComponentBlueprint, properties: Dict = {}): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      QUnit.assert.ok(true, `Rendering ${template} with ${JSON.stringify(properties)}`);
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

    this.setProperties(properties);

    this.renderResult = this.delegate.renderTemplate(template, this.context, this.element, () =>
      this.takeSnapshot()
    );
  }

  renderComponent(
    component: ComponentDefinitionState,
    args: Dict = {},
    dynamicScope?: DynamicScope
  ): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      QUnit.assert.ok(true, `Rendering ${String(component)} with ${JSON.stringify(args)}`);
    } catch {
      // couldn't stringify, possibly has a circular dependency
    }

    localAssert(
      !!this.delegate.renderComponent,
      'Attempted to render a component, but the delegate did not implement renderComponent'
    );

    this.renderResult = this.delegate.renderComponent(component, args, this.element, dynamicScope);
  }

  rerender(properties: Dict = {}): void {
    try {
      QUnit.assert.ok(true, `rerender ${JSON.stringify(properties)}`);
    } catch {
      // couldn't stringify, possibly has a circular dependency
    }

    this.setProperties(properties);

    let result = expect(this.renderResult, 'the test should call render() before rerender()');

    try {
      result.env.begin();
      result.rerender();
    } finally {
      result.env.commit();
    }
  }

  destroy(): void {
    let result = expect(this.renderResult, 'the test should call render() before destroy()');

    inTransaction(result.env, () => destroy(result));
  }

  private assertEachCompareResults(
    items: (number | string | [string | number, string | number])[]
  ) {
    [...(this.element as unknown as HTMLElement).querySelectorAll('.test-item')].forEach(
      (el, index) => {
        let key = Array.isArray(items[index]) ? items[index][0] : index;
        let value = Array.isArray(items[index]) ? items[index][1] : items[index];

        QUnit.assert.equal(el.textContent, `${key}.${value}`, `Comparing the rendered key.value`);
      }
    );
  }

  protected assertReactivity<T>(
    Klass: new (...args: any[]) => { get value(): T; update: () => void },
    shouldUpdate = true,
    message?: string
  ) {
    let instance: TestComponent | undefined;
    let count = 0;

    class TestComponent extends Klass {
      constructor(...args: unknown[]) {
        super(...args);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        instance = this;
      }

      override get value() {
        count++;

        return super.value;
      }
    }

    if (message) {
      QUnit.assert.ok(true, message);
    }

    let comp = defineComponent({}, `<div class="test">{{this.value}}</div>`, {
      strictMode: true,
      definition: TestComponent,
    });

    this.renderComponent(comp);

    QUnit.assert.equal(count, 1, `The count is 1`);

    if (!instance) {
      throw new Error('The instance is not defined');
    }

    instance.update();

    this.rerender();

    QUnit.assert.equal(
      count,
      shouldUpdate ? 2 : 1,
      shouldUpdate ? `The count is updated` : `The could should not update`
    );

    this.assertStableRerender();
  }

  protected assertEachInReactivity(
    Klass: new (...args: any[]) => {
      collection: (string | number)[] | Map<unknown, string | number>;
      update: () => void;
    }
  ) {
    let instance: TestComponent | undefined;

    class TestComponent extends Klass {
      constructor(...args: unknown[]) {
        super(...args);
        // eslint-disable-next-line
        instance = this;
      }
    }

    let comp = defineComponent(
      {},
      `
        <ul>
          {{#each-in this.collection as |lhs rhs|}}
            <li class="test-item">{{lhs}}.{{rhs}}</li>
          {{/each-in}}
        </ul>
`,
      {
        strictMode: true,
        definition: TestComponent,
      }
    );

    this.renderComponent(comp);

    if (!instance) {
      throw new Error('The instance is not defined');
    }

    let { collection } = instance;

    this.assertEachCompareResults(
      Symbol.iterator in collection
        ? Array.from(collection as string[])
        : Object.entries(collection)
    );

    instance.update();

    this.rerender();

    this.assertEachCompareResults(
      Symbol.iterator in collection
        ? Array.from(collection as string[])
        : Object.entries(collection)
    );
  }

  protected assertEachReactivity(
    Klass: new (...args: any[]) => {
      collection:
        | (string | number)[]
        | Set<number | string>
        | Map<unknown, unknown>
        | Record<string, unknown>;
      update: () => void;
    }
  ) {
    let instance: TestComponent | undefined;

    class TestComponent extends Klass {
      constructor(...args: any[]) {
        super(...args);
        // eslint-disable-next-line
        instance = this;
      }
    }

    let comp = defineComponent(
      {},
      `
        <ul>
          {{#each this.collection as |value index|}}
            <li class="test-item">{{index}}.{{value}}</li>
          {{/each}}
        </ul>
`,
      {
        strictMode: true,
        definition: TestComponent,
      }
    );

    this.renderComponent(comp);

    if (!instance) {
      throw new Error('The instance is not defined');
    }

    function getEntries() {
      if (!instance) return [];

      return Array.from(instance.collection as (string | number)[]);
    }

    this.assertEachCompareResults((getEntries() as string[]).map((v, i) => [i, v]));

    instance.update();

    this.rerender();

    this.assertEachCompareResults((getEntries() as string[]).map((v, i) => [i, v]));

    this.assertStableRerender();
  }

  protected set(key: string, value: unknown): void {
    this.context[key] = value;
    dirtyTagFor(this.context, key);
  }

  protected setProperties(properties: Dict): void {
    for (let key in properties) {
      this.set(key, properties[key]);
    }
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

  protected assertComponent(content: string, attrs: object = {}) {
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
