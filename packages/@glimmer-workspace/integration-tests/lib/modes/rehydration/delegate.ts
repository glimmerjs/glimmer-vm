import type {
  Cursor,
  ElementBuilder,
  Environment,
  RenderResult,
  SimpleDocument,
  SimpleElement,
  SimpleNode,
} from '@glimmer/interfaces';
import { serializeBuilder } from '@glimmer/node';
import type { Reference } from '@glimmer/reference';
import { assign, castToSimple } from '@glimmer/util';
import createHTMLDocument from '@simple-dom/document';

import { BaseEnv } from '../../base-env';
import { replaceHTML, toInnerHTML } from '../../dom/simple-utils';
import type RenderDelegate from '../../render-delegate';
import type { RenderDelegateOptions, WrappedTemplate } from '../../render-delegate';
import { JitDelegateContext, type JitContext } from '../jit/delegate';
import { TestJitRegistry } from '../jit/registry';
import { renderTemplate } from '../jit/render';
import { TestJitRuntimeResolver } from '../jit/resolver';
import { debugRehydration, type DebugRehydrationBuilder } from './builder';
import type { ASTPluginBuilder } from '@glimmer/syntax';
import type { Self } from '../../render-test';

export interface RehydrationStats {
  clearedNodes: SimpleNode[];
}

export class RehydrationDelegate implements RenderDelegate {
  static readonly isEager = false;
  static readonly style = 'rehydration';

  public clientEnv: JitContext;
  public serverEnv: JitContext;

  private clientResolver: TestJitRuntimeResolver;
  private serverResolver: TestJitRuntimeResolver;

  protected clientRegistry: TestJitRegistry;
  protected serverRegistry: TestJitRegistry;

  public clientDoc: SimpleDocument;
  public serverDoc: SimpleDocument;

  readonly context: JitContext;
  readonly dom: RenderDelegate['dom'];

  public declare rehydrationStats: RehydrationStats;

  constructor(options?: RenderDelegateOptions) {
    let envDelegate = assign(options?.env ?? {}, BaseEnv);

    const clientDoc = castToSimple(document);

    this.clientDoc = clientDoc;
    this.clientRegistry = new TestJitRegistry();
    this.clientResolver = new TestJitRuntimeResolver(this.clientRegistry);
    this.clientEnv = JitDelegateContext(this.clientDoc, this.clientResolver, envDelegate);

    this.dom = {
      document: this.clientDoc,
      getInitialElement: () => this.clientDoc.createElement('div'),
    };
    this.context = JitDelegateContext(clientDoc, this.clientResolver, envDelegate);

    this.serverDoc = createHTMLDocument();
    this.serverRegistry = new TestJitRegistry();
    this.serverResolver = new TestJitRuntimeResolver(this.serverRegistry);
    this.serverEnv = JitDelegateContext(this.serverDoc, this.serverResolver, envDelegate);
  }

  getElementBuilder(env: Environment, cursor: Cursor): ElementBuilder {
    if (cursor.element instanceof Node) {
      return debugRehydration(env, cursor);
    }

    return serializeBuilder(env, cursor);
  }

  wrap(template: string): WrappedTemplate {
    return { template };
  }

  renderServerSide(
    template: string,
    self: Reference,
    takeSnapshot: () => void,
    element: SimpleElement | undefined = undefined,
    plugins: ASTPluginBuilder[]
  ): string {
    element = element || this.serverDoc.createElement('div');
    let cursor = { element, nextSibling: null };
    let { env } = this.serverEnv.runtime;

    // Emulate server-side render
    renderTemplate(template, this.serverEnv, self, this.getElementBuilder(env, cursor), {
      plugins: {
        ast: plugins,
      },
    });

    takeSnapshot();
    return this.serialize(element);
  }

  serialize(element: SimpleElement): string {
    return toInnerHTML(element);
  }

  renderClientSide(
    template: string,
    self: Reference,
    element: SimpleElement,
    plugins: ASTPluginBuilder[]
  ): RenderResult {
    let env = this.clientEnv.runtime.env;

    // Client-side rehydration
    let cursor = { element, nextSibling: null };
    let builder = this.getElementBuilder(env, cursor) as DebugRehydrationBuilder;
    let result = renderTemplate(template, this.clientEnv, self, builder, {
      plugins: {
        ast: plugins,
      },
    });

    this.rehydrationStats = {
      clearedNodes: builder['clearedNodes'],
    };

    return result;
  }

  renderTemplate(
    template: string,
    self: Self,
    element: SimpleElement,
    snapshot: () => void,
    plugins: ASTPluginBuilder[]
  ): RenderResult {
    let serialized = this.renderServerSide(template, self.ref, snapshot, undefined, plugins);
    replaceHTML(element, serialized);
    qunitFixture().appendChild(element);

    return this.renderClientSide(template, self.ref, element, plugins);
  }

  get registries() {
    return [this.clientRegistry, this.serverRegistry];
  }
}

export function qunitFixture(): SimpleElement {
  return castToSimple(document.getElementById('qunit-fixture')!);
}
