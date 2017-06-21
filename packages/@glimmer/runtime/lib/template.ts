import { CompilationOptions, InputCompilationOptions } from './syntax/compilable-template';
import { Simple, Opaque, Option } from '@glimmer/interfaces';
import { PathReference } from '@glimmer/reference';
import { assign, EMPTY_ARRAY } from '@glimmer/util';
import {
  SerializedTemplateBlock,
  SerializedTemplateWithLazyBlock,
  Statements,
  TemplateMeta,
} from '@glimmer/wire-format';
import { ElementBuilder, NewElementBuilder } from './vm/element-builder';
import { RehydrateBuilder } from './vm/rehydrate-builder';
import { SerializeBuilder } from './vm/serialize-builder';
import { DynamicScope, Environment } from './environment';
import Scanner from './scanner';
import { Block, TopLevelBlock } from './syntax/interfaces';
import { IteratorResult, RenderResult, VM } from './vm';

export interface RenderOptions {
  env: Environment;
  self: PathReference<Opaque>;
  parentNode: Simple.Element;
  nextSibling?: Option<Simple.Node>;
  dynamicScope: DynamicScope;
  mode?: 'rehydrate' | 'serialize';
}

/**
 * Environment specific template.
 */
export interface Template<T extends TemplateMeta = TemplateMeta> {
  /**
   * Template identifier, if precompiled will be the id of the
   * precompiled template.
   */
  id: string;

  /**
   * Template meta (both compile time and environment specific).
   */
  meta: T;

  hasEval: boolean;

  /**
   * Symbols computed at compile time.
   */
  symbols: string[];

  /**
   * Helper to render template as root entry point.
   */
  render(options: RenderOptions): TemplateIterator;

  // internal casts, these are lazily created and cached
  asEntryPoint(): TopLevelBlock;
  asLayout(componentName: string, attrs?: Statements.Attribute[]): TopLevelBlock;
  asPartial(): TopLevelBlock;
  asBlock(): Block;
}

export interface TemplateFactory<T, U> {
  /**
   * Template identifier, if precompiled will be the id of the
   * precompiled template.
   */
  id: string;

  /**
   * Compile time meta.
   */
  meta: T;

  /**
   * Used to create an environment specific singleton instance
   * of the template.
   *
   * @param {Environment} env glimmer Environment
   */
  create(env: InputCompilationOptions): Template<T>;
  /**
   * Used to create an environment specific singleton instance
   * of the template.
   *
   * @param {Environment} env glimmer Environment
   * @param {Object} meta environment specific injections into meta
   */
  create(env: InputCompilationOptions, meta: U): Template<T & U>;
}

export class TemplateIterator {
  constructor(private vm: VM) {}
  next(): IteratorResult<RenderResult> {
    return this.vm.next();
  }
}

let clientId = 0;

/**
 * Wraps a template js in a template module to change it into a factory
 * that handles lazy parsing the template and to create per env singletons
 * of the template.
 */
export default function templateFactory<T extends TemplateMeta>(serializedTemplate: SerializedTemplateWithLazyBlock<T>): TemplateFactory<T, T>;
export default function templateFactory<T extends TemplateMeta, U>(serializedTemplate: SerializedTemplateWithLazyBlock<T>): TemplateFactory<T, U>;
export default function templateFactory({ id: templateId, meta, block }: SerializedTemplateWithLazyBlock<any>): TemplateFactory<{}, {}> {
  let parsedBlock: SerializedTemplateBlock;
  let id = templateId || `client-${clientId++}`;
  let create = (env: CompilationOptions, envMeta?: {}) => {
    let newMeta = envMeta ? assign({}, envMeta, meta) : meta;
    if (!parsedBlock) {
      parsedBlock = JSON.parse(block);
    }
    return new ScannableTemplate(id, newMeta, env, parsedBlock);
  };
  return { id, meta, create };
}

class ScannableTemplate implements Template<TemplateMeta> {
  private entryPoint: Option<TopLevelBlock> = null;
  private layout: Option<TopLevelBlock> = null;
  private partial: Option<TopLevelBlock> = null;
  private block: Option<Block> = null;
  private scanner: Scanner;
  public symbols: string[];
  public hasEval: boolean;

  constructor(public id: string, public meta: TemplateMeta, private options: CompilationOptions, rawBlock: SerializedTemplateBlock) {
    this.scanner = new Scanner(rawBlock, options);
    this.symbols = rawBlock.symbols;
    this.hasEval = rawBlock.hasEval;
  }

  render({ env, self, parentNode, dynamicScope, mode }: RenderOptions) {
    let elementBuilder: ElementBuilder;

    switch (mode) {
      case undefined: elementBuilder = NewElementBuilder.forInitialRender(env, parentNode, null); break;
      case 'rehydrate': elementBuilder = RehydrateBuilder.forInitialRender(env, parentNode, null); break;
      case 'serialize': elementBuilder = SerializeBuilder.forInitialRender(env, parentNode, null); break;
      default: throw new Error('unreachable');
    }

    let compiled = this.asEntryPoint().compileDynamic(this.options);
    let vm = VM.initial(this.options.program, env, self, dynamicScope, elementBuilder, compiled);
    return new TemplateIterator(vm);
  }

  asEntryPoint(): TopLevelBlock {
    if (!this.entryPoint) this.entryPoint = this.scanner.scanEntryPoint(this.compilationMeta());
    return this.entryPoint;
  }

  asLayout(componentName: string, attrs?: Statements.Attribute[]): TopLevelBlock {
    if (!this.layout) this.layout = this.scanner.scanLayout(this.compilationMeta(), attrs || EMPTY_ARRAY, componentName);
    return this.layout;
  }

  asPartial(): TopLevelBlock {
    if (!this.partial) this.partial = this.scanner.scanEntryPoint(this.compilationMeta(true));
    return this.partial;
  }

  asBlock(): Block {
    if (!this.block) this.block = this.scanner.scanBlock(this.compilationMeta());
    return this.block;
  }

  private compilationMeta(asPartial = false) {
    return { templateMeta: this.meta, symbols: this.symbols, asPartial };
  }
}
