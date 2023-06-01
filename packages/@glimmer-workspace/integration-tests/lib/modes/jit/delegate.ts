import type {
  CapturedRenderNode,
  CompileTimeCompilationContext,
  Cursor,
  DOMTreeBuilder,
  Dict,
  DynamicScope,
  ElementNamespace,
  Environment,
  HandleResult,
  Helper,
  MinimalChild,
  MinimalElement,
  Nullable,
  RenderResult,
  RuntimeContext,
  SimpleDocument,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleText,
} from '@glimmer/interfaces';
import { programCompilationContext } from '@glimmer/opcode-compiler';
import { artifacts, RuntimeOpImpl } from '@glimmer/program';
import { createConstRef, type Reference } from '@glimmer/reference';
import {
  array,
  concat,
  type CurriedValue,
  type EnvironmentDelegate,
  fn,
  get,
  hash,
  on,
  renderComponent,
  renderSync,
  runtimeContext,
  BrowserTreeBuilder,
} from '@glimmer/runtime';
import type { ASTPluginBuilder, PrecompileOptions } from '@glimmer/syntax';
import { castToBrowser, castToSimple, expect, unwrapTemplate } from '@glimmer/util';

import { BaseEnvironment as BaseEnvironment } from '../../base-env';
import { preprocess } from '../../compile';
import type { ComponentKind, ComponentTypes } from '../../components';
import type { UserHelper } from '../../helpers';
import type { TestModifierConstructor } from '../../modifiers';
import type RenderDelegate from '../../render-delegate';
import type { RenderDelegateOptions } from '../../render-delegate';
import JitCompileTimeLookup from './compilation-context';
import {
  componentHelper,
  registerComponent,
  registerHelper,
  registerInternalHelper,
  registerModifier,
} from './register';
import { TestJitRegistry } from './registry';
import { renderTemplate } from './render';
import { TestJitRuntimeResolver } from './resolver';

export interface JitTestDelegateContext {
  runtime: RuntimeContext;
  program: CompileTimeCompilationContext;
}

export function JitDelegateContext(
  document: SimpleDocument,
  resolver: TestJitRuntimeResolver,
  environment: EnvironmentDelegate
): JitTestDelegateContext {
  let sharedArtifacts = artifacts();
  let context = programCompilationContext(
    sharedArtifacts,
    new JitCompileTimeLookup(resolver),
    (heap) => new RuntimeOpImpl(heap)
  );
  let runtime = runtimeContext({ document: document }, environment, sharedArtifacts, resolver);
  return { runtime, program: context };
}

export class JitRenderDelegate implements RenderDelegate {
  static readonly isEager = false;
  static style = 'jit';

  protected registry: TestJitRegistry;
  protected resolver: TestJitRuntimeResolver;

  private plugins: ASTPluginBuilder[] = [];
  private _context: JitTestDelegateContext | null = null;
  private self: Nullable<Reference> = null;
  private doc: SimpleDocument;
  private env: EnvironmentDelegate;

  constructor({
    doc,
    env,
    resolver = (registry) => new TestJitRuntimeResolver(registry),
  }: RenderDelegateOptions = {}) {
    this.registry = new TestJitRegistry();
    this.resolver = resolver(this.registry);
    this.doc = castToSimple(doc ?? document);
    this.env = { ...(env ?? BaseEnvironment) };
    this.registry.register('modifier', 'on', on);
    this.registry.register('helper', 'fn', fn);
    this.registry.register('helper', 'hash', hash);
    this.registry.register('helper', 'array', array);
    this.registry.register('helper', 'get', get);
    this.registry.register('helper', 'concat', concat);
  }

  get context(): JitTestDelegateContext {
    if (this._context === null) {
      this._context = JitDelegateContext(this.doc, this.resolver, this.env);
    }

    return this._context;
  }

  getCapturedRenderTree(): CapturedRenderNode[] {
    return expect(
      this.context.runtime.env.debugRenderTree,
      'Attempted to capture the DebugRenderTree during tests, but it was not created. Did you enable it in the environment?'
    ).capture();
  }

  getInitialElement(): SimpleElement {
    return isBrowserTestDocument(this.doc)
      ? castToSimple(castToBrowser(this.doc).querySelector('#qunit-fixture')!)
      : this.createElement('div');
  }

  createElement(tagName: string): SimpleElement {
    return this.doc.createElement(tagName);
  }

  createTextNode(content: string): SimpleText {
    return this.doc.createTextNode(content);
  }

  createElementNS(namespace: ElementNamespace, tagName: string): SimpleElement {
    return this.doc.createElementNS(namespace, tagName);
  }

  createDocumentFragment(): SimpleDocumentFragment {
    return this.doc.createDocumentFragment();
  }

  createCurriedComponent(name: string): CurriedValue | null {
    return componentHelper(this.registry, name, this.context.program.constants);
  }

  registerPlugin(plugin: ASTPluginBuilder): void {
    this.plugins.push(plugin);
  }

  registerComponent<K extends 'TemplateOnly' | 'Glimmer', L extends ComponentKind>(
    type: K,
    _testType: L,
    name: string,
    layout: string,
    Class?: ComponentTypes[K]
  ): void;
  registerComponent<K extends 'Curly' | 'Dynamic', L extends ComponentKind>(
    type: K,
    _testType: L,
    name: string,
    layout: Nullable<string>,
    Class?: ComponentTypes[K]
  ): void;
  registerComponent<K extends ComponentKind, L extends ComponentKind>(
    type: K,
    _testType: L,
    name: string,
    layout: Nullable<string>,
    Class?: ComponentTypes[K]
  ) {
    registerComponent(this.registry, type, name, layout, Class);
  }

  registerModifier(name: string, ModifierClass: TestModifierConstructor): void {
    registerModifier(this.registry, name, ModifierClass);
  }

  registerHelper(name: string, helper: UserHelper): void {
    registerHelper(this.registry, name, helper);
  }

  registerInternalHelper(name: string, helper: Helper) {
    registerInternalHelper(this.registry, name, helper);
  }

  getElementBuilder(environment: Environment, cursor: Cursor): DOMTreeBuilder {
    return BrowserTreeBuilder._forCursor_([
      cursor.element as MinimalElement,
      cursor.nextSibling as MinimalChild,
      null,
    ]);
  }

  getSelf(_environment: Environment, context: unknown): Reference {
    if (!this.self) {
      this.self = createConstRef(context, 'this');
    }

    return this.self;
  }

  compileTemplate(template: string): HandleResult {
    let compiled = preprocess(template, this.precompileOptions);

    return unwrapTemplate(compiled).asLayout().compile(this.context.program);
  }

  renderTemplate(template: string, context: Dict<unknown>, element: SimpleElement): RenderResult {
    let cursor = { element, nextSibling: null };

    let { env } = this.context.runtime;

    return renderTemplate(
      template,
      this.context,
      this.getSelf(env, context),
      this.getElementBuilder(env, cursor),
      this.precompileOptions
    );
  }

  renderComponent(
    component: object,
    args: Record<string, unknown>,
    element: SimpleElement,
    dynamicScope?: DynamicScope
  ): RenderResult {
    let cursor = { element, nextSibling: null };
    let { program, runtime } = this.context;
    let builder = this.getElementBuilder(runtime.env, cursor);
    let iterator = renderComponent(runtime, builder, program, {}, component, args, dynamicScope);

    return renderSync(runtime.env, iterator);
  }

  private get precompileOptions(): PrecompileOptions {
    return {
      plugins: {
        ast: this.plugins,
      },
    };
  }
}

function isBrowserTestDocument(document: SimpleDocument | Document): document is Document {
  return 'getElementById' in document && document.querySelector('#qunit-fixture') !== null;
}
