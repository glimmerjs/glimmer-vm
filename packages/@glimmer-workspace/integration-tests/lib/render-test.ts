import type {
  Dict,
  DynamicScope,
  Helper,
  Maybe,
  Nullable,
  Reactive,
  RenderResult,
  SimpleElement,
  SimpleNode,
} from '@glimmer/interfaces';
import type { ASTPluginBuilder } from '@glimmer/syntax';
import type { NTuple } from '@glimmer-workspace/test-utils';
import { destroy } from '@glimmer/destroyable';
import { hasFlagWith } from '@glimmer/local-debug-flags';
import { ReadonlyCell } from '@glimmer/reference';
import { inTransaction, renderComponent, renderSync } from '@glimmer/runtime';
import { clearElement, dict, expect, isPresent, LOCAL_LOGGER, unwrap } from '@glimmer/util';
import { dirtyTagFor } from '@glimmer/validator';

import type {ComponentBlueprint, ComponentKind, ComponentTypes} from './components';
import type {ComponentDelegate} from './components/delegate';
import type { UserHelper } from './helpers';
import type { TestModifierConstructor } from './modifiers';
import type RenderDelegate from './render-delegate';
import type { DomDelegate, LogRender } from './render-delegate';
import type {NodesSnapshot} from './snapshot';
import type {DeclaredComponentType, TypeFor} from './test-helpers/constants';
import type { RenderTestState } from './test-helpers/module';

import {
  GLIMMER_TEST_COMPONENT
} from './components';
import {
  buildInvoke,
  buildTemplate,
  CurlyDelegate,
  DynamicDelegate,
  getDelegate,
  GlimmerDelegate
} from './components/delegate';
import { assertingElement, toInnerHTML } from './dom/simple-utils';
import { BuildDomDelegate } from './modes/jit/dom';
import {
  registerComponent,
  registerHelper,
  registerInternalHelper,
  registerModifier,
} from './modes/jit/register';
import { equalTokens, isServerMarker,  normalizeSnapshot } from './snapshot';
import {
  KIND_FOR,
  TYPE_FOR
} from './test-helpers/constants';
import { Woops } from './test-helpers/error';
import { RecordedEvents } from './test-helpers/recorded';

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type Present<T> = Exclude<T, null | undefined>;

export interface IRenderTest {
  readonly testType: ComponentKind;
  readonly context: RenderTestState;
  readonly beforeEach?: () => void;
  readonly afterEach?: () => void;
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
    this.#events.finalize();

    // don't print anything if the counts match
    if (QUnit.equiv(this.expected, this.actual)) return;

    QUnit.assert.deepEqual(this.actual, this.expected, "Expected and actual counts don't match");
  }
}

export class Self {
  #properties: Dict;
  readonly ref: Reactive<Dict>;

  constructor(properties: Dict) {
    this.#properties = properties;
    this.ref = ReadonlyCell(this.#properties, 'this');
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

export class RenderTestContext implements IRenderTest {
  readonly events = new RecordedEvents();
  readonly name?: string;

  readonly self = new Self({});
  #element: SimpleElement;
  readonly assert = QUnit.assert;
  protected renderResult: Nullable<RenderResult> = null;
  protected helpers = dict<UserHelper>();
  protected snapshot: NodesSnapshot = [];
  readonly dom: DomDelegate;
  readonly context: RenderTestState;

  readonly plugins: ASTPluginBuilder[] = [];
  readonly #delegate: ComponentDelegate<DeclaredComponentType>;

  constructor(
    protected delegate: RenderDelegate,
    context: RenderTestState
  ) {
    this.#element = delegate.dom.getInitialElement(delegate.dom.document);
    this.context = context;
    this.dom = new BuildDomDelegate(delegate.dom);

    this.#delegate = getDelegate(context.types.template);
  }

  get element() {
    return this.#element;
  }

  set element(element: SimpleElement) {
    this.#element = element;
  }

  declare readonly beforeEach?: () => void;
  declare readonly afterEach?: () => void;

  get testType(): ComponentKind {
    return KIND_FOR[this.context.types.template];
  }

  get invoker(): ComponentDelegate {
    return getDelegate(this.context.types.invoker);
  }

  get invokeAs(): DeclaredComponentType {
    return this.context.types.invoker;
  }

  getInitialElement(): SimpleElement {
    return this.element;
  }

  getClearedElement(): SimpleElement {
    (this.element as unknown as HTMLElement).innerHTML = '';
    return this.element;
  }

  clearElement() {
    (this.element as unknown as HTMLElement).innerHTML = '';
  }

  get assertingElement() {
    return assertingElement(this.element.firstChild);
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

  readonly register = {
    plugin: (plugin: ASTPluginBuilder) => {
      this.plugins.push(plugin);
    },

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
      kind: K,
      name: string,
      layout: Nullable<string>,
      Class?: ComponentTypes[TypeFor<K>]
    ): void => {
      for (const registry of this.delegate.registries) {
        registerComponent(registry, TYPE_FOR[kind], name, layout, Class);
      }
    },
  };

  readonly build = {
    glimmer: (blueprint: ComponentBlueprint) => this.buildGlimmerComponent(blueprint),
    curly: (blueprint: ComponentBlueprint) => this.buildCurlyComponent(blueprint),
    dynamic: (blueprint: ComponentBlueprint) => this.buildDynamicComponent(blueprint),
    templateOnly: (blueprint: ComponentBlueprint) => this.buildTemplateOnlyComponent(blueprint),
  };

  buildComponent(blueprint: ComponentBlueprint): string {
    switch (this.testType) {
      case 'Glimmer':
        return this.buildGlimmerComponent(blueprint);
      case 'Curly':
        return this.buildCurlyComponent(blueprint);
      case 'Dynamic':
        return this.buildDynamicComponent(blueprint);
      case 'TemplateOnly':
        return this.buildTemplateOnlyComponent(blueprint);

      default:
        throw new Error(`Invalid test type ${this.testType}`);
    }
  }

  #buildInvoke(blueprint: ComponentBlueprint): { name: string; invocation: string } {
    return buildInvoke(getDelegate(this.context.types.invoker), blueprint);
  }

  #buildComponent(templateDelegate: ComponentDelegate<any>, blueprint: ComponentBlueprint): string {
    const template = buildTemplate(templateDelegate, blueprint);
    const { name, invocation } = this.#buildInvoke(blueprint);

    this.register.component(this.testType, name, template);
    return invocation;
  }

  private buildGlimmerComponent(blueprint: ComponentBlueprint): string {
    return this.#buildComponent(GlimmerDelegate, blueprint);
  }

  private buildCurlyComponent(blueprint: ComponentBlueprint): string {
    return this.#buildComponent(CurlyDelegate, blueprint);
  }

  private buildTemplateOnlyComponent(blueprint: ComponentBlueprint): string {
    return this.buildGlimmerComponent(blueprint);
    // let { layout, name = GLIMMER_TEST_COMPONENT } = blueprint; let invocation =
    // this.buildAngleBracketComponent(blueprint); this.assert.ok(true, `generated fragment layout
    // as ${layout}`); this.register.component('TemplateOnly', name, `${layout}`);
    // this.assert.ok(true, `generated fragment invocation as ${invocation}`); return invocation;
  }

  private buildDynamicComponent(blueprint: ComponentBlueprint): string {
    return this.#buildComponent(DynamicDelegate, blueprint);
  }

  shouldBeVoid(tagName: string) {
    clearElement(this.element);
    let html = '<' + tagName + " data-foo='bar'><p>hello</p>";
    this.delegate.renderTemplate(
      html,
      this.self,
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
    if (typeof template === 'object') {
      let blueprint = template;
      template = this.buildComponent(blueprint);

      if (this.testType === 'Dynamic' && properties['componentName'] === undefined) {
        properties['componentName'] = blueprint.name || GLIMMER_TEST_COMPONENT;
      }
    }

    this.self.initialize(properties);

    this.#log({
      template,
      self: this.self,
      element: this.element,
    });

    this.renderResult = this.delegate.renderTemplate(
      template,
      this.self,
      this.element,
      () => this.takeSnapshot(),
      this.plugins
    );
  }

  rerender(properties: Dict<unknown> = {}, message?: string): void {
    try {
      QUnit.assert.ok(true, `rerender ${message ?? JSON.stringify(properties)}`);
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

  #log(render: LogRender) {
    const { template, properties: addedProperties } = this.delegate.wrap(render.template);

    QUnit.assert.ok(true, `Rendering ${String(template)}`);

    if (hasFlagWith('enable_internals_logging', 'render')) {
      const properties = { ...render.self.inner, ...addedProperties };
      LOCAL_LOGGER.groupCollapsed(`%c[render] Rendering ${template}`, 'font-weight: normal');
      LOCAL_LOGGER.debug('element   ', render.element);
      LOCAL_LOGGER.debug('properties', { ...render.self.inner, ...properties });
      LOCAL_LOGGER.groupEnd();
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

  assertError(template: string, value: string, { ok, err }: { ok: string; err: string }) {
    const woops = Woops.error(value);
    this.render.template(template, { result: woops, handleError: woops.handleError });

    this.assertHTML(err);
    this.assertStableRerender();

    // @fixme the next step is making these tests pass -- it may be a problem in the reactive error
    // system, so writing some tests around this scenario is probably the next thing to do.
    // ---
    // woops.isError = false;
    // this.rerender(undefined, `an ok value`);
    // this.assertHTML(ok, `after rerendering an ok value`);
  }

  assertOk(template: string, value: string, { ok, err }: { ok: string; err: string }) {
    const woops = Woops.noop(value);
    this.render.template(template, { result: woops, handleError: woops.handleError });

    this.assertHTML(ok);
    this.assertStableRerender();

    woops.isError = true;
    this.rerender(undefined, `an error`);
    this.assertHTML(err, `after rerendering an error`);
  }

  assertStableRerender() {
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

  guardArray<T extends Maybe<unknown>[], K extends string>(desc: { [P in K]: T }): {
    [K in keyof T]: Present<T[K]>;
  };
  guardArray<T, K extends string, N extends number>(
    desc: { [P in K]: Iterable<T> | ArrayLike<T> },
    options: { min: N }
  ): Expand<NTuple<N, Present<T>>>;
  guardArray<T, U extends T, K extends string, N extends number>(
    desc: { [P in K]: Iterable<T> | ArrayLike<T> },
    options: { min: N; condition: (value: T) => value is U }
  ): Expand<NTuple<N, U>>;
  guardArray<T, K extends string, A extends ArrayLike<T>>(desc: { [P in K]: A }): Expand<
    NTuple<A['length'], Present<T>>
  >;
  guardArray<T, K extends string>(desc: {
    [P in K]: Iterable<T> | ArrayLike<T>;
  }): Present<T>[];
  guardArray<T, K extends string, U extends T>(
    desc: {
      [P in K]: Iterable<T> | ArrayLike<T>;
    },
    options: { condition: (value: T) => value is U; min?: number }
  ): U[];
  guardArray(
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

  assertHTML(html: string, elementOrMessage?: SimpleElement | string, message?: string) {
    if (typeof elementOrMessage === 'object') {
      equalTokens(elementOrMessage || this.element, html, message ? `${html} (${message})` : html);
    } else {
      equalTokens(this.element, html, elementOrMessage ? `${html} (${elementOrMessage})` : html);
    }
    this.takeSnapshot();
  }

  assertComponent(content: string, attrs: Dict = {}) {
    this.#delegate.assert(this.assertingElement, 'div', attrs, content);

    this.takeSnapshot();
  }

  private runTask<T>(callback: () => T): T {
    return callback();
  }

  assertStableNodes(
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
