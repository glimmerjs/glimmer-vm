import { Reference, PathReference, OpaqueIterable } from '@glimmer/reference';
import { Macros, OpcodeBuilderConstructor } from '@glimmer/opcode-compiler';
import { Simple, RuntimeResolver } from '@glimmer/interfaces';
import { Program } from '@glimmer/program';
import { Option, Opaque, assert, expect, Drop, DROP } from '@glimmer/util';

import { DOMChanges, DOMTreeConstruction } from './dom/helper';
import { PublicVM } from './vm/append';
import { ReadonlyArguments } from './vm/arguments';
import { ConditionalReference } from './references';
import { DynamicAttribute, dynamicAttribute } from './vm/attributes/dynamic';
import { Component, ComponentManager, ModifierManager, Modifier } from './internal-interfaces';

export interface DynamicScope {
  get(key: string): PathReference<Opaque>;
  set(key: string, reference: PathReference<Opaque>): PathReference<Opaque>;
  child(): DynamicScope;
}

export interface ReadonlyDynamicScope {
  get(key: string): PathReference<Opaque>;
  child(): DynamicScope;
}

export interface MutDynamicScope {
  set(key: string, reference: PathReference<Opaque>): PathReference<Opaque>;
}

class Transaction {
  public scheduledInstallManagers: ModifierManager[] = [];
  public scheduledInstallModifiers: Modifier[] = [];
  public scheduledUpdateModifierManagers: ModifierManager[] = [];
  public scheduledUpdateModifiers: Modifier[] = [];
  public createdComponents: Component[] = [];
  public createdManagers: ComponentManager[] = [];
  public updatedComponents: Component[] = [];
  public updatedManagers: ComponentManager[] = [];
  public destructors: Drop[] = [];

  didCreate(component: Component, manager: ComponentManager) {
    this.createdComponents.push(component);
    this.createdManagers.push(manager);
  }

  didUpdate(component: Component, manager: ComponentManager) {
    this.updatedComponents.push(component);
    this.updatedManagers.push(manager);
  }

  scheduleInstallModifier(modifier: Modifier, manager: ModifierManager) {
    this.scheduledInstallManagers.push(manager);
    this.scheduledInstallModifiers.push(modifier);
  }

  scheduleUpdateModifier(modifier: Modifier, manager: ModifierManager) {
    this.scheduledUpdateModifierManagers.push(manager);
    this.scheduledUpdateModifiers.push(modifier);
  }

  didDestroy(d: Drop) {
    this.destructors.push(d);
  }

  commit() {
    let { createdComponents, createdManagers } = this;

    for (let i = 0; i < createdComponents.length; i++) {
      let component = createdComponents[i];
      let manager = createdManagers[i];
      manager.didCreate(component);
    }

    let { updatedComponents, updatedManagers } = this;

    for (let i = 0; i < updatedComponents.length; i++) {
      let component = updatedComponents[i];
      let manager = updatedManagers[i];
      manager.didUpdate(component);
    }

    let { destructors } = this;

    for (let i = 0; i < destructors.length; i++) {
      destructors[i][DROP]();
    }

    let { scheduledInstallManagers, scheduledInstallModifiers } = this;

    for (let i = 0; i < scheduledInstallManagers.length; i++) {
      let manager = scheduledInstallManagers[i];
      let modifier = scheduledInstallModifiers[i];
      manager.install(modifier);
    }

    let { scheduledUpdateModifierManagers, scheduledUpdateModifiers } = this;

    for (let i = 0; i < scheduledUpdateModifierManagers.length; i++) {
      let manager = scheduledUpdateModifierManagers[i];
      let modifier = scheduledUpdateModifiers[i];
      manager.update(modifier);
    }
  }
}

export interface CompilationOptions<Locator, R extends RuntimeResolver<Locator>> {
  resolver: R;
  program: Program<Locator>;
  macros: Macros;
  Builder: OpcodeBuilderConstructor;
}

export interface EnvironmentOptions {
  appendOperations: DOMTreeConstruction;
  updateOperations: DOMChanges;
}

const TRANSACTION = Symbol('TRANSACTION');

export interface ReadonlyEnvironment {}

export abstract class Environment implements ReadonlyEnvironment {
  protected updateOperations: DOMChanges;
  protected appendOperations: DOMTreeConstruction;
  private [TRANSACTION]: Option<Transaction> = null;

  constructor({ appendOperations, updateOperations }: EnvironmentOptions) {
    this.appendOperations = appendOperations;
    this.updateOperations = updateOperations;
  }

  toConditionalReference(reference: Reference): Reference<boolean> {
    return new ConditionalReference(reference);
  }

  abstract iterableFor(reference: Reference, key: Opaque): OpaqueIterable;
  abstract protocolForURL(s: string): string;

  getAppendOperations(): DOMTreeConstruction {
    return this.appendOperations;
  }
  getDOM(): DOMChanges {
    return this.updateOperations;
  }

  begin() {
    assert(
      !this[TRANSACTION],
      'A glimmer transaction was begun, but one already exists. You may have a nested transaction, possibly caused by an earlier runtime exception while rendering. Please check your console for the stack trace of any prior exceptions.'
    );

    this[TRANSACTION] = new Transaction();
  }

  private get transaction(): Transaction {
    return expect(this[TRANSACTION]!, 'must be in a transaction');
  }

  didCreate(component: Component, manager: ComponentManager) {
    this.transaction.didCreate(component, manager);
  }

  didUpdate(component: Component, manager: ComponentManager) {
    this.transaction.didUpdate(component, manager);
  }

  scheduleInstallModifier(modifier: Modifier, manager: ModifierManager) {
    this.transaction.scheduleInstallModifier(modifier, manager);
  }

  scheduleUpdateModifier(modifier: Modifier, manager: ModifierManager) {
    this.transaction.scheduleUpdateModifier(modifier, manager);
  }

  didDestroy(d: Drop) {
    this.transaction.didDestroy(d);
  }

  commit() {
    let transaction = this.transaction;
    this[TRANSACTION] = null;
    transaction.commit();
  }

  attributeFor(
    element: Simple.Element,
    attr: string,
    _isTrusting: boolean,
    namespace: Option<string> = null
  ): DynamicAttribute {
    return dynamicAttribute(element, attr, namespace);
  }
}

export function inTransaction(env: Environment, cb: () => void): void {
  if (!env[TRANSACTION]) {
    env.begin();
    try {
      cb();
    } finally {
      env.commit();
    }
  } else {
    cb();
  }
}

export abstract class DefaultEnvironment extends Environment {
  constructor(options?: EnvironmentOptions) {
    if (!options) {
      let document = window.document;
      let appendOperations = new DOMTreeConstruction(document);
      let updateOperations = new DOMChanges(document as HTMLDocument);
      options = { appendOperations, updateOperations };
    }

    super(options);
  }
}

export default Environment;

export interface Helper {
  (vm: PublicVM, args: ReadonlyArguments): PathReference<Opaque>;
}
