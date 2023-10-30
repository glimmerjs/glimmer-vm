import type {
  CapturedRenderNode,
  CompileTimeCompilationContext,
  Cursor,
  ElementBuilder,
  ElementNamespace,
  Environment,
  HandleResult,
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
import type { Reference } from '@glimmer/reference';
import {
  array,
  clientBuilder,
  concat,
  type CurriedValue,
  type EnvironmentDelegate,
  fn,
  get,
  hash,
  on,
  runtimeContext,
} from '@glimmer/runtime';
import type { ASTPluginBuilder } from '@glimmer/syntax';
import { assign, castToSimple, expect, unwrapTemplate } from '@glimmer/util';

import { BaseEnv } from '../../base-env';
import { preprocess } from '../../compile';
import type RenderDelegate from '../../render-delegate';
import type { BuildDom, RenderDelegateOptions } from '../../render-delegate';
import JitCompileTimeLookup from './compilation-context';
import { componentHelper } from './register';
import { TestJitRegistry } from './registry';
import { renderTemplate } from './render';
import { TestJitRuntimeResolver } from './resolver';

export interface JitContext {
  runtime: RuntimeContext;
  program: CompileTimeCompilationContext;
}

export function JitDelegateContext(
  doc: SimpleDocument,
  resolver: TestJitRuntimeResolver,
  env: EnvironmentDelegate
): JitContext {
  let sharedArtifacts = artifacts();
  let context = programCompilationContext(
    sharedArtifacts,
    new JitCompileTimeLookup(resolver),
    (heap) => new RuntimeOpImpl(heap)
  );
  let runtime = runtimeContext({ document: doc }, env, sharedArtifacts, resolver);
  return { runtime, program: context };
}

export class BuildDomWithDocument implements BuildDom {
  static intoDiv(doc: Document | SimpleDocument): BuildDom {
    return new BuildDomWithDocument(doc, () => castToSimple(doc.createElement('div')));
  }

  static intoTestFixture(doc: Document): BuildDom {
    return new BuildDomWithDocument(castToSimple(doc), () =>
      castToSimple(doc.querySelector('#qunit-fixture')!)
    );
  }

  readonly #document: SimpleDocument | Document;
  readonly #getInitial: (doc: SimpleDocument | Document) => SimpleElement;

  private constructor(
    doc: SimpleDocument | Document,
    getInitial: (doc: SimpleDocument | Document) => SimpleElement
  ) {
    this.#document = doc;
    this.#getInitial = getInitial;
  }

  getInitialElement(): SimpleElement {
    return this.#getInitial(this.#document);
  }

  get doc() {
    return castToSimple(this.#document);
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
}

export class JitRenderDelegate implements RenderDelegate {
  static readonly isEager = false;
  static style = 'jit';

  protected registry: TestJitRegistry;
  protected resolver: TestJitRuntimeResolver;

  private doc: SimpleDocument;
  private env: EnvironmentDelegate;

  readonly registries: TestJitRegistry[];
  readonly context: JitContext;
  readonly dom: BuildDom;

  constructor({
    doc: specifiedDoc,
    env,
    resolver = (registry) => new TestJitRuntimeResolver(registry),
  }: RenderDelegateOptions = {}) {
    const doc = specifiedDoc ?? document;

    this.registry = new TestJitRegistry();
    this.resolver = resolver(this.registry);
    this.doc = castToSimple(doc);
    this.dom = isBrowserTestDocument(doc)
      ? BuildDomWithDocument.intoTestFixture(doc)
      : BuildDomWithDocument.intoDiv(doc);
    this.env = assign({}, env ?? BaseEnv);
    this.registry.register('modifier', 'on', on);
    this.registry.register('helper', 'fn', fn);
    this.registry.register('helper', 'hash', hash);
    this.registry.register('helper', 'array', array);
    this.registry.register('helper', 'get', get);
    this.registry.register('helper', 'concat', concat);

    this.registries = [this.registry];

    this.context = JitDelegateContext(this.doc, this.resolver, this.env);
  }

  getCapturedRenderTree(): CapturedRenderNode[] {
    return expect(
      this.context.runtime.env.debugRenderTree,
      'Attempted to capture the DebugRenderTree during tests, but it was not created. Did you enable it in the environment?'
    ).capture();
  }

  createCurriedComponent(name: string): Nullable<CurriedValue> {
    return componentHelper(this.registry, name, this.context.program.constants);
  }

  getElementBuilder(env: Environment, cursor: Cursor): ElementBuilder {
    return clientBuilder(env, cursor);
  }

  compileTemplate(template: string, plugins: ASTPluginBuilder[]): HandleResult {
    let compiled = preprocess(template, {
      plugins: {
        ast: plugins,
      },
    });

    return unwrapTemplate(compiled).asLayout().compile(this.context.program);
  }

  renderTemplate(
    template: string,
    self: Reference,
    element: SimpleElement,
    _: () => void,
    plugins: ASTPluginBuilder[]
  ): RenderResult {
    let cursor = { element, nextSibling: null };

    let { env } = this.context.runtime;

    return renderTemplate(template, this.context, self, this.getElementBuilder(env, cursor), {
      plugins: {
        ast: plugins,
      },
    });
  }
}

function isBrowserTestDocument(doc: SimpleDocument | Document): doc is Document {
  return 'getElementById' in doc && doc.getElementById('qunit-fixture') !== null;
}
