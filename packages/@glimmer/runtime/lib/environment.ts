import { Reference, PathReference, OpaqueIterable } from '@glimmer/reference';
import { Macros, OpcodeBuilderConstructor } from '@glimmer/opcode-compiler';
import { Simple, RuntimeResolver, CompilableBlock, BlockSymbolTable } from '@glimmer/interfaces';
import { Program } from "@glimmer/program";
import {
  Dict,
  Option,
  Destroyable,
  Opaque,
  assert,
  expect
} from '@glimmer/util';

import { DOMChanges, DOMTreeConstruction } from './dom/helper';
import { PublicVM } from './vm/append';
import { IArguments } from './vm/arguments';
import { UNDEFINED_REFERENCE, ConditionalReference } from './references';
import { DynamicAttributeFactory, defaultDynamicAttributes } from './vm/attributes/dynamic';
import {
  ModifierManager, Modifier
} from './modifier/interfaces';
import { Component, ComponentManager } from "./internal-interfaces";
import EvaluationStack from './vm/stack';

export type ScopeBlock = [number | CompilableBlock, ReifiedScope, BlockSymbolTable];
export type BlockValue = ScopeBlock[0 | 1 | 2];
export type ScopeSlot = Option<PathReference<Opaque>> | Option<ScopeBlock>;

export interface DynamicScope {
  get(key: string): PathReference<Opaque>;
  set(key: string, reference: PathReference<Opaque>): PathReference<Opaque>;
  child(): DynamicScope;
}

export abstract class Scope {
  protected abstract get<T extends ScopeSlot>(slot: number): T;
  protected abstract set<T extends ScopeSlot>(slot: number, value: T): void;

  protected evalScope: Option<Dict<ScopeSlot>>;
  protected partialMap: Option<Dict<PathReference<Opaque>>>;

  abstract capture(): ReifiedScope;

  getSelf(): PathReference<Opaque> {
    return this.get<PathReference<Opaque>>(0);
  }

  getSymbol(symbol: number): PathReference<Opaque> {
    return this.get<PathReference<Opaque>>(symbol);
  }

  getBlock(symbol: number): Option<ScopeBlock> {
    let block = this.get(symbol);
    // TODO: There is a deeper issue here -- why isn't the block bound?
    return block === undefined || block === UNDEFINED_REFERENCE ? null : block as ScopeBlock;
  }

  getEvalScope(): Option<Dict<ScopeSlot>> {
    return this.evalScope;
  }

  getPartialMap(): Option<Dict<PathReference<Opaque>>> {
    return this.partialMap;
  }

  bind(symbol: number, value: ScopeSlot) {
    this.set(symbol, value);
  }

  bindSelf(self: PathReference<Opaque>) {
    this.set<PathReference<Opaque>>(0, self);
  }

  bindSymbol(symbol: number, value: PathReference<Opaque>) {
    this.set(symbol, value);
  }

  bindBlock(symbol: number, value: Option<ScopeBlock>) {
    this.set<Option<ScopeBlock>>(symbol, value);
  }

  bindEvalScope(map: Option<Dict<ScopeSlot>>) {
    this.evalScope = map;
  }

  bindPartialMap(map: Dict<PathReference<Opaque>>) {
    // debugger;
    this.partialMap = map;
  }

  abstract child(): Scope;
}

export class ReifiedScope extends Scope {
  static root(self: PathReference<Opaque>, size = 0) {
    let refs: PathReference<Opaque>[] = new Array(size + 1);

    refs[0] = self;

    for (let i = 1; i <= size; i++) {
      // will be imminently filled in with the correct value
      refs[i] = undefined as any;
    }

    return new ReifiedScope(refs, null, null);
  }

  static sized(size = 0) {
    let refs: PathReference<Opaque>[] = new Array(size + 1);

    for (let i = 0; i <= size; i++) {
      // will be imminently filled in with the correct value
      refs[i] = undefined as any;
    }

    return new ReifiedScope(refs, null, null);
  }

  constructor(
    // the 0th slot is `self`
    private slots: ScopeSlot[],
    // named arguments and blocks passed to a layout that uses eval
    protected evalScope: Option<Dict<ScopeSlot>>,
    // locals in scope when the partial was invoked
    protected partialMap: Option<Dict<PathReference<Opaque>>>) {
      super();
  }

  capture(): ReifiedScope {
    return this;
  }

  bindAll(slots: ScopeSlot[]): void {
    this.slots = slots;
  }

  child(): ReifiedScope {
    return new ReifiedScope(this.slots.slice(), this.evalScope, this.partialMap);
  }

  protected get<T extends ScopeSlot>(index: number): T {
    if (index >= this.slots.length) {
      throw new RangeError(`BUG: cannot get $${index} from scope; length=${this.slots.length}`);
    }

    return this.slots[index] as T;
  }

  protected set<T extends ScopeSlot>(index: number, value: T): void {
    if (index >= this.slots.length) {
      throw new RangeError(`BUG: cannot get $${index} from scope; length=${this.slots.length}`);
    }

    this.slots[index] = value;
  }
}

export class ProxyStackScope extends Scope {
  private sp: number;

  constructor(private stack: EvaluationStack, private fp: number, sp: number) {
    super();
    this.sp = sp + 1;
    this.partialMap = null;
    this.evalScope = null;
  }

  // DEBUG
  get slots(): ScopeSlot[] {
    return this.stack.sliceArray(this.fp, this.sp);
  }

  capture(): ReifiedScope {
    let slots = this.stack.sliceArray(this.fp, this.sp);
    return new ReifiedScope(slots as ScopeSlot[], this.evalScope, this.partialMap);
  }

  protected get<T extends ScopeSlot>(slot: number): T {
    return this.stack.get(slot, this.fp);
  }

  protected set<T extends ScopeSlot>(_slot: number, _value: T): void {
    throw new Error("Cannot bind on ProxyStackScope");
  }

  child(): Scope {
    let slots = this.stack.sliceArray(this.fp, this.sp);
    return new ReifiedScope(slots as ScopeSlot[], this.evalScope, this.partialMap);
  }
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
  public destructors: Destroyable[] = [];

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

  didDestroy(d: Destroyable) {
    this.destructors.push(d);
  }

  commit() {
    let { createdComponents, createdManagers } = this;

    for (let i=0; i<createdComponents.length; i++) {
      let component = createdComponents[i];
      let manager = createdManagers[i];
      manager.didCreate(component);
    }

    let { updatedComponents, updatedManagers } = this;

    for (let i=0; i<updatedComponents.length; i++) {
      let component = updatedComponents[i];
      let manager = updatedManagers[i];
      manager.didUpdate(component);
    }

    let { destructors } = this;

    for (let i=0; i<destructors.length; i++) {
      destructors[i].destroy();
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

export abstract class Environment {
  protected updateOperations: DOMChanges;
  protected appendOperations: DOMTreeConstruction;
  private _transaction: Option<Transaction> = null;

  constructor({ appendOperations, updateOperations }: EnvironmentOptions) {
    this.appendOperations = appendOperations;
    this.updateOperations = updateOperations;
  }

  toConditionalReference(reference: Reference): Reference<boolean> {
    return new ConditionalReference(reference);
  }

  abstract iterableFor(reference: Reference, key: Opaque): OpaqueIterable;
  abstract protocolForURL(s: string): string;

  getAppendOperations(): DOMTreeConstruction { return this.appendOperations; }
  getDOM(): DOMChanges { return this.updateOperations; }

  begin() {
    assert(!this._transaction, 'A glimmer transaction was begun, but one already exists. You may have a nested transaction, possibly caused by an earlier runtime exception while rendering. Please check your console for the stack trace of any prior exceptions.');
    this._transaction = new Transaction();
  }

  private get transaction(): Transaction {
    return expect(this._transaction!, 'must be in a transaction');
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

  didDestroy(d: Destroyable) {
    this.transaction.didDestroy(d);
  }

  commit() {
    let transaction = this.transaction;
    this._transaction = null;
    transaction.commit();
  }

  attributeFor(element: Simple.Element, attr: string, _isTrusting: boolean, _namespace: Option<string> = null): DynamicAttributeFactory {
    return defaultDynamicAttributes(element, attr);
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
  (vm: PublicVM, args: IArguments): PathReference<Opaque>;
}
