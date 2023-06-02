/* eslint-disable unicorn/prefer-dom-node-append */
import type {
  Dict,
  ElementNamespace,
  Environment,
  Helper,
  MinimalDocument,
  Nullable,
  RenderResult,
  SimpleDocument,
  SimpleDocumentFragment,
  SimpleElement,
  SimpleNode,
  SimpleText,
  TreeBuilder,
} from '@glimmer/interfaces';
import { createConstRef, type Reference } from '@glimmer/reference';
import type { ASTPluginBuilder, PrecompileOptions } from '@glimmer/syntax';
import { castToSimple } from '@glimmer/util';
import createHTMLDocument from '@simple-dom/document';

import { BaseEnvironment as BaseEnvironment } from '../../base-env';
import type { ComponentKind } from '../../components';
import { toInnerHTML } from '../../dom/simple-utils';
import type { UserHelper } from '../../helpers';
import type { TestModifierConstructor } from '../../modifiers';
import type RenderDelegate from '../../render-delegate';
import type { RenderDelegateOptions } from '../../render-delegate';
import { JitDelegateContext, type JitTestDelegateContext } from '../jit/delegate';
import {
  registerComponent,
  registerHelper,
  registerInternalHelper,
  registerModifier,
} from '../jit/register';
import { TestJitRegistry } from '../jit/registry';
import { renderTemplate } from '../jit/render';
import { TestJitRuntimeResolver } from '../jit/resolver';
import type { DebugRehydrationBuilder } from './builder';
import { ServerTreeBuilder } from '@glimmer/runtime/lib/dom/tree-builder';

export interface RehydrationStats {
  clearedNodes: SimpleNode[];
}

export class RehydrationDelegate implements RenderDelegate {
  static readonly isEager = false;
  static readonly style = 'rehydration';

  private plugins: ASTPluginBuilder[] = [];

  public clientEnv: JitTestDelegateContext;
  public serverEnv: JitTestDelegateContext;

  private clientResolver: TestJitRuntimeResolver;
  private serverResolver: TestJitRuntimeResolver;

  protected clientRegistry: TestJitRegistry;
  protected serverRegistry: TestJitRegistry;

  public clientDoc: SimpleDocument;
  public serverDoc: SimpleDocument;

  public declare rehydrationStats: RehydrationStats;

  private self: Nullable<Reference> = null;

  constructor(options?: RenderDelegateOptions) {
    let env = Object.assign(options?.env ?? {}, BaseEnvironment);

    this.clientDoc = castToSimple(document);
    this.clientRegistry = new TestJitRegistry();
    this.clientResolver = new TestJitRuntimeResolver(this.clientRegistry);
    this.clientEnv = JitDelegateContext(this.clientResolver, env, document as MinimalDocument);

    this.serverDoc = createHTMLDocument();
    this.serverRegistry = new TestJitRegistry();
    this.serverResolver = new TestJitRuntimeResolver(this.serverRegistry);
    this.serverEnv = JitDelegateContext(this.serverResolver, env);
  }

  getInitialElement(): SimpleElement {
    return this.clientDoc.createElement('div');
  }

  createElement(tagName: string): SimpleElement {
    return this.clientDoc.createElement(tagName);
  }

  createTextNode(content: string): SimpleText {
    return this.clientDoc.createTextNode(content);
  }

  createElementNS(namespace: ElementNamespace, tagName: string): SimpleElement {
    return this.clientDoc.createElementNS(namespace, tagName);
  }

  createDocumentFragment(): SimpleDocumentFragment {
    return this.clientDoc.createDocumentFragment();
  }

  getElementBuilder(): ServerTreeBuilder {
    return new ServerTreeBuilder();
  }

  renderServerSide(template: string, context: Dict<unknown>, takeSnapshot: () => void): string {
    let { env } = this.serverEnv.runtime;
    let builder = this.getElementBuilder();

    // Emulate server-side render
    renderTemplate(
      template,
      this.serverEnv,
      this.getSelf(env, context),
      builder,
      this.precompileOptions
    );

    takeSnapshot();
    return builder._flush_();
  }

  getSelf(_environment: Environment, context: unknown): Reference {
    if (!this.self) {
      this.self = createConstRef(context, 'this');
    }

    return this.self;
  }

  serialize(element: SimpleElement): string {
    return toInnerHTML(element);
  }

  // TODO [6/7/2022]: this code needs to use a (not yet existing) RehydrationTreeBuilder
  renderClientSide(template: string, context: Dict<unknown>, element: SimpleElement): RenderResult {
    let environment = this.clientEnv.runtime.env;
    this.self = null;

    // Client-side rehydration
    // @ts-expect-error see above todo
    let builder = this.getElementBuilder() as DebugRehydrationBuilder;
    let result = renderTemplate(
      template,
      this.clientEnv,
      this.getSelf(environment, context),
      builder,
      this.precompileOptions
    );

    this.rehydrationStats = {
      clearedNodes: builder['clearedNodes'],
    };

    return result;
  }

  // TODO [6/7/2022]: this code needs to use a (not yet existing) RehydrationTreeBuilder
  renderTemplate(
    template: string,
    context: Dict<unknown>,
    builder: TreeBuilder,
    snapshot: () => void
  ): RenderResult {
    let serialized = this.renderServerSide(template, context, snapshot);
    // @ts-expect-error see above
    qunitFixture().appendChild(element);

    // @ts-expect-error see above
    return this.renderClientSide(template, context, element);
  }

  registerPlugin(plugin: ASTPluginBuilder): void {
    this.plugins.push(plugin);
  }

  registerComponent(type: ComponentKind, _testType: string, name: string, layout: string): void {
    registerComponent(this.clientRegistry, type, name, layout);
    registerComponent(this.serverRegistry, type, name, layout);
  }

  registerHelper(name: string, helper: UserHelper): void {
    registerHelper(this.clientRegistry, name, helper);
    registerHelper(this.serverRegistry, name, helper);
  }

  registerInternalHelper(name: string, helper: Helper) {
    registerInternalHelper(this.clientRegistry, name, helper);
    registerInternalHelper(this.serverRegistry, name, helper);
  }

  registerModifier(name: string, ModifierClass: TestModifierConstructor): void {
    registerModifier(this.clientRegistry, name, ModifierClass);
    registerModifier(this.serverRegistry, name, ModifierClass);
  }

  private get precompileOptions(): PrecompileOptions {
    return {
      plugins: {
        ast: this.plugins,
      },
    };
  }
}

export function qunitFixture(): SimpleElement {
  return castToSimple(document.querySelector('#qunit-fixture')!);
}
