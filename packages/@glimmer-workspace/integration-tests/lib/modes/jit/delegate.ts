import type {
  CapturedRenderNode,
  Cursor,
  ElementBuilder,
  Environment,
  HandleResult,
  JitContext,
  Nullable,
  RenderResult,
  RuntimeContext,
  SimpleDocument,
  SimpleElement,
} from '@glimmer/interfaces';
import type {CurriedValue, EnvironmentDelegate} from '@glimmer/runtime';
import type { ASTPluginBuilder } from '@glimmer/syntax';
import type { RenderDelegate, RenderDelegateOptions, WrappedTemplate } from '../../render-delegate';
import type { Self } from '../../render-test';

import { programCompilationContext } from '@glimmer/opcode-compiler';
import { artifacts, RuntimeOpImpl } from '@glimmer/program';
import {
  array,
  clientBuilder,
  concat,
  fn,
  get,
  hash,
  on,
  runtimeContext
} from '@glimmer/runtime';
import { assign, castToSimple, expect, unwrapTemplate } from '@glimmer/util';

import { BaseEnv } from '../../base-env';
import { preprocess } from '../../compile';
import JitCompileTimeLookup from './compilation-context';
import { componentHelper } from './register';
import { TestJitRegistry } from './registry';
import { renderTemplate } from './render';
import { TestJitRuntimeResolver } from './resolver';

export interface TestJitContext {
  runtime: RuntimeContext;
  program: JitContext;
}

export function JitDelegateContext(
  doc: SimpleDocument,
  resolver: TestJitRuntimeResolver,
  env: EnvironmentDelegate
): TestJitContext {
  let sharedArtifacts = artifacts();
  let context = programCompilationContext(
    sharedArtifacts,
    new JitCompileTimeLookup(resolver),
    (heap) => new RuntimeOpImpl(heap)
  );
  let runtime = runtimeContext({ document: doc }, env, sharedArtifacts, resolver);
  return { runtime, program: context };
}

export class ClientSideRenderDelegate implements RenderDelegate {
  static readonly isEager = false;
  static style = 'client-side';

  protected registry: TestJitRegistry;
  protected resolver: TestJitRuntimeResolver;

  private doc: SimpleDocument;
  private env: EnvironmentDelegate;

  readonly registries: TestJitRegistry[];
  readonly context: TestJitContext;

  constructor({
    doc: specifiedDoc,
    env,
    resolver = (registry) => new TestJitRuntimeResolver(registry),
  }: RenderDelegateOptions = {}) {
    const doc = specifiedDoc ?? document;

    this.registry = new TestJitRegistry();
    this.resolver = resolver(this.registry);
    this.doc = castToSimple(doc);
    this.dom = {
      document: this.doc,
      getInitialElement: (doc) =>
        isBrowserTestDocument(doc)
          ? castToSimple(
              expect(doc.querySelector('#qunit-fixture'), 'expected #qunit-fixture to exist')
            )
          : doc.createElement('div'),
    } satisfies RenderDelegate['dom'];
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
  dom: {
    document: SimpleDocument | Document;
    getInitialElement: (doc: SimpleDocument | Document) => SimpleElement;
  };

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

  wrap(template: string): WrappedTemplate {
    return { template };
  }

  compileTemplate(template: string, plugins: ASTPluginBuilder[]): HandleResult {
    let compiled = preprocess(this.wrap(template).template, {
      plugins: {
        ast: plugins,
      },
    });

    return unwrapTemplate(compiled).asLayout().compile(this.context.program);
  }

  renderTemplate(
    rawTemplate: string,
    self: Self,
    element: SimpleElement,
    _: () => void,
    plugins: ASTPluginBuilder[]
  ): RenderResult {
    let cursor = { element, nextSibling: null };

    let { env } = this.context.runtime;

    const { template, properties } = this.wrap(rawTemplate);

    if (properties) self.update(properties);

    return renderTemplate(template, this.context, self.ref, this.getElementBuilder(env, cursor), {
      plugins: {
        ast: plugins,
      },
    });
  }
}

export class ErrorRecoveryRenderDelegate extends ClientSideRenderDelegate {
  static override style = 'in a no-op error recovery';

  override wrap(template: string): WrappedTemplate {
    return {
      template: `{{#-try this.errorRecoveryHandle}}${template}{{/-try}}`,
      properties: { errorRecoveryHandle: () => {} },
    };
  }
}

function isBrowserTestDocument(doc: SimpleDocument | Document): doc is Document {
  return 'getElementById' in doc && doc.getElementById('qunit-fixture') !== null;
}
