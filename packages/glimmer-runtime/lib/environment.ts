import { Statement as StatementSyntax } from './syntax';
import * as Simple from './dom/interfaces';
import { normalizeProperty } from './dom/props';
import { DOMChanges, DOMTreeConstruction, SVG_NAMESPACE, Namespace } from './dom/helper';
import { Reference, OpaqueIterable } from 'glimmer-reference';
import { UNDEFINED_REFERENCE, ConditionalReference } from './references';
import {
  defaultAttributeManagers,
  defaultPropertyManagers,
  AttributeManager
} from './dom/attribute-managers';

import {
  PartialDefinition
} from './partial';

import {
  Component,
  ComponentManager,
  ComponentDefinition
} from './component/interfaces';

import {
  ModifierManager
} from './modifier/interfaces';

import {
  PathReference
} from 'glimmer-reference';

import {
  Destroyable,
  Dict,
  dict,
  Opaque,
  HasGuid,
  ensureGuid
} from 'glimmer-util';

import {
  BlockMeta
} from 'glimmer-wire-format';

import { EvaluatedArgs } from './compiled/expressions/args';

import { InlineBlock } from './compiled/blocks';

import * as Syntax from './syntax/core';

import IfSyntax from './syntax/builtins/if';
import UnlessSyntax from './syntax/builtins/unless';
import WithSyntax from './syntax/builtins/with';
import EachSyntax from './syntax/builtins/each';
import PartialSyntax from './syntax/builtins/partial';

import { PublicVM } from './vm/append';

type ScopeSlot = PathReference<Opaque> | InlineBlock;

const DIV = 'div';
const A = 'a';

class AttributeCache {
  private store: Array<Dict<Dict<AttributeManager>>>; // Note this the Namespace enum

  constructor() {
    // We want to prime the cache with common shapes
    let htmlNSDict = dict<Dict<AttributeManager>>();
    htmlNSDict[DIV] = dict<AttributeManager>();
    htmlNSDict[DIV]['id'] = undefined;
    htmlNSDict[DIV]['class'] = undefined;
    htmlNSDict[A] = dict<AttributeManager>();
    htmlNSDict[A]['href'] = undefined;
    this.store = new Array(6);
    this.store[0] = htmlNSDict;
  }

  get(ns: Simple.Namespace, tagName: string, attribute:string): AttributeManager {
    let nsIndex = Namespace[ns];

    if (typeof this.store[nsIndex] !== 'object' ||
        typeof this.store[nsIndex][tagName] !== 'object' ||
        typeof this.store[nsIndex][tagName][attribute] !== 'object') {
      return;
    }

    return this.store[nsIndex][tagName][attribute];
  }

  set(ns: Simple.Namespace, tagName: string, attribute: string, manager: AttributeManager): void {
    let nsIndex = Namespace[ns];

    // Note we want to set and bail out early in common cases
    if (nsIndex === 0 && tagName === DIV) {
      this.store[0][DIV][attribute] = manager;
      return;
    }

    if (nsIndex === 0 && tagName === A && attribute === 'href') {
      this.store[0][A]['href'] = manager;
      return;
    }

    if (typeof this.store[nsIndex] !== 'object') {
      this.store[nsIndex] = dict<Dict<AttributeManager>>();
      this.store[nsIndex][tagName] = {};
      this.store[nsIndex][tagName][attribute] = manager;
    } else if (!this.store[nsIndex][tagName]) {
      this.store[nsIndex][tagName] = {};
      this.store[nsIndex][tagName][attribute] = manager;
    }

    this.store[nsIndex][tagName][attribute] = manager;
  }
}

export interface DynamicScope {
  child(): DynamicScope;
}

export class Scope {
  static root(self: PathReference<Opaque>, size = 0) {
    let refs: PathReference<Opaque>[] = new Array(size + 1);

    for (let i = 0; i <= size; i++) {
      refs[i] = UNDEFINED_REFERENCE;
    }

    return new Scope(refs).init({ self });
  }

  // the 0th slot is `self`
  private slots: ScopeSlot[];
  private callerScope: Scope = null;

  constructor(references: ScopeSlot[], callerScope: Scope = null) {
    this.slots = references;
    this.callerScope = callerScope;
  }

  init({ self }: { self: PathReference<Opaque> }): this {
    this.slots[0] = self;
    return this;
  }

  getSelf(): PathReference<Opaque> {
    return this.slots[0] as PathReference<Opaque>;
  }

  getSymbol(symbol: number): PathReference<Opaque> {
    return this.slots[symbol] as PathReference<Opaque>;
  }

  getBlock(symbol: number): InlineBlock {
    return this.slots[symbol] as InlineBlock;
  }

  bindSymbol(symbol: number, value: PathReference<Opaque>) {
    this.slots[symbol] = value;
  }

  bindBlock(symbol: number, value: InlineBlock) {
    this.slots[symbol] = value;
  }

  bindCallerScope(scope: Scope) {
    this.callerScope = scope;
  }

  getCallerScope(): Scope {
    return this.callerScope;
  }

  child(): Scope {
    return new Scope(this.slots.slice(), this.callerScope);
  }
}

export abstract class Environment {
  protected updateOperations: DOMChanges;
  protected appendOperations: DOMTreeConstruction;
  protected normalizedAttributeManagers: AttributeCache = new AttributeCache();
  private createdComponents: Component[] = null;
  private createdManagers: ComponentManager<Component>[] = null;
  private updatedComponents: Component[] = null;
  private updatedManagers: ComponentManager<Component>[] = null;
  private destructors: Destroyable[] = null;

  constructor({ appendOperations, updateOperations }: { appendOperations: DOMTreeConstruction, updateOperations: DOMChanges }) {
    this.appendOperations = appendOperations;
    this.updateOperations = updateOperations;
  }

  toConditionalReference(reference: Reference<Opaque>): Reference<boolean> {
    return new ConditionalReference(reference);
  }

  abstract iterableFor(reference: Reference<Opaque>, args: EvaluatedArgs): OpaqueIterable;
  abstract protocolForURL(s: string): string;

  getDOM(): DOMChanges { return this.updateOperations; }
  getAppendOperations(): DOMTreeConstruction { return this.appendOperations; }

  getIdentity(object: HasGuid): string {
    return ensureGuid(object) + '';
  }

  statement(statement: StatementSyntax, blockMeta: BlockMeta): StatementSyntax {
    return this.refineStatement(parseStatement(statement), blockMeta) || statement;
  }

  protected refineStatement(statement: ParsedStatement, blockMeta: BlockMeta): StatementSyntax {
    let {
      isSimple,
      isBlock,
      isInline,
      key,
      args,
      templates
    } = statement;

    if (isSimple && isInline) {
      if (key === 'partial') {
        return new PartialSyntax({ args, blockMeta });
      }
    }

    if (isSimple && isBlock) {
      switch (key) {
        case 'each':
          return new EachSyntax({ args, templates });
        case 'if':
          return new IfSyntax({ args, templates });
        case 'with':
          return new WithSyntax({ args, templates });
        case 'unless':
          return new UnlessSyntax({ args, templates });
      }
    }
  }

  begin() {
    this.createdComponents = [];
    this.createdManagers = [];
    this.updatedComponents = [];
    this.updatedManagers = [];
    this.destructors = [];
  }

  didCreate<T>(component: T, manager: ComponentManager<T>) {
    this.createdComponents.push(component as any);
    this.createdManagers.push(manager as any);
  }

  didUpdate<T>(component: T, manager: ComponentManager<T>) {
    this.updatedComponents.push(component as any);
    this.updatedManagers.push(manager as any);
  }

  didDestroy(d: Destroyable) {
    this.destructors.push(d);
  }

  commit() {
    for (let i=0; i<this.createdComponents.length; i++) {
      let component = this.createdComponents[i];
      let manager = this.createdManagers[i];
      manager.didCreate(component);
    }

    for (let i=this.updatedComponents.length-1; i>=0; i--) {
      let component = this.updatedComponents[i];
      let manager = this.updatedManagers[i];
      manager.didUpdate(component);
    }

    for (let i=0; i<this.destructors.length; i++) {
      this.destructors[i].destroy();
    }
  }

  hasKeyword(string: string): boolean {
    return false;
  }

  abstract hasHelper(helperName: string[], blockMeta: BlockMeta): boolean;
  abstract lookupHelper(helperName: string[], blockMeta: BlockMeta): Helper;

  lookupAttribute(element: Simple.Element, attr: string, isTrusting: boolean, namespace?: string): AttributeManager {
    let tagName = element.tagName;
    let elementNS = element.namespaceURI;
    let isSVG = elementNS === SVG_NAMESPACE;

    if (isSVG) {
      return defaultAttributeManagers(tagName, attr);
    }

    let { type, name }  = normalizeProperty(element, attr);
    let attributeManager;

    if (type === 'attr') {
      attributeManager = defaultAttributeManagers(tagName, attr);
    } else {
      attributeManager = defaultPropertyManagers(tagName, name);
    }

    return attributeManager;
  }

  attributeFor(element: Simple.Element, attr: string, isTrusting: boolean, namespace?: string): AttributeManager {
    let elementNS = element.namespaceURI as Simple.Namespace;
    let tagName = element.tagName;
    let normalizeProperty = this.normalizedAttributeManagers.get(elementNS, tagName, attr);

    if (normalizeProperty) {
      return normalizeProperty;
    } else {
      normalizeProperty = this.lookupAttribute(element, attr, isTrusting, namespace);
      this.normalizedAttributeManagers.set(elementNS, tagName, attr, normalizeProperty);
    }

    return normalizeProperty;
  }

  abstract hasPartial(partialName: string[], blockMeta: BlockMeta): boolean;
  abstract lookupPartial(PartialName: string[], blockMeta: BlockMeta): PartialDefinition;
  abstract hasComponentDefinition(tagName: string[]): boolean;
  abstract getComponentDefinition(tagName: string[]): ComponentDefinition<Opaque>;

  abstract hasModifier(modifierName: string[]): boolean;
  abstract lookupModifier(modifierName: string[]): ModifierManager<Opaque>;
}

export default Environment;

export interface Helper {
  (vm: PublicVM, args: EvaluatedArgs): PathReference<Opaque>;
}

export interface ParsedStatement {
  isSimple: boolean;
  path: string[];
  key: string;
  appendType: string;
  args: Syntax.Args;
  isInline: boolean;
  isBlock: boolean;
  isModifier: boolean;
  templates: Syntax.Templates;
  original: StatementSyntax;
}

function parseStatement(statement: StatementSyntax): ParsedStatement {
    let type = statement.type;
    let block = type === 'block' ? <Syntax.Block>statement : null;
    let append = type === 'optimized-append' ? <Syntax.OptimizedAppend>statement : null;
    let modifier = type === 'modifier' ? <Syntax.Modifier>statement : null;
    let appendType = append && append.value.type;

    type AppendValue = Syntax.Unknown | Syntax.Get;
    let args: Syntax.Args;
    let path: string[];

    if (block) {
      args = block.args;
      path = block.path;
    } else if (append && (appendType === 'unknown' || appendType === 'get')) {
      let appendValue = <AppendValue>append.value;
      args = Syntax.Args.empty();
      path = appendValue.ref.path();
    } else if (append && append.value.type === 'helper') {
      let helper = <Syntax.Helper>append.value;
      args = helper.args;
      path = helper.ref.path();
    } else if (modifier) {
      path = modifier.path;
      args = modifier.args;
    }

    let key: string, isSimple: boolean;

    if (path) {
      isSimple = path.length === 1;
      key = path[0];
    }

    return {
      isSimple,
      path,
      key,
      args,
      appendType,
      original: statement,
      isInline: !!append,
      isBlock: !!block,
      isModifier: !!modifier,
      templates: block && block.templates
    };
}
