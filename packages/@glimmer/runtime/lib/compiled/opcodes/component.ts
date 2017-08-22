import { Opaque, Option, Dict, BlockSymbolTable, ProgramSymbolTable, Recast } from '@glimmer/interfaces';
import {
  combineTagged,
  CONSTANT_TAG,
  Tag,
  VersionedReference,
  VersionedPathReference,
  isConst,
  isConstTag,
  Reference
} from '@glimmer/reference';
import Bounds from '../../bounds';
import {
  CurriedComponentDefinition,
  hasDynamicLayout,
  hasStaticLayout,
  isComponentDefinition,
  isCurriedComponentDefinition,
  WithDynamicTagName,
  WithElementHook,
} from '../../component/interfaces';
import { normalizeStringValue } from '../../dom/normalize';
import { DynamicScope, Handle, ScopeBlock, ScopeSlot, Opcode } from '../../environment';
import { UpdatingOpcode } from '../../updating-opcodes';
import { AbstractTemplate } from './builder';
import { UNDEFINED_REFERENCE } from '../../references';
import { ATTRS_BLOCK } from '../../syntax/functions';
import { UpdatingVM, VM } from '../../vm';
import { Arguments, IArguments, ICapturedArguments } from '../../vm/arguments';
import { IsComponentDefinitionReference } from './content';
import { UpdateDynamicAttributeOpcode } from './dom';
import { Resolver, Specifier, ComponentDefinition, ComponentManager, Component } from '../../internal-interfaces';
import { dict, assert, unreachable } from "@glimmer/util";
import { Op, Register } from '@glimmer/vm';
import { TemplateMeta } from "@glimmer/wire-format";

const ARGS = new Arguments();

export const COMPONENT_MAPPINGS = {};

function resolveComponent(resolver: Resolver, name: string, meta: TemplateMeta): ComponentDefinition {
  let specifier = resolver.lookupComponent(name, meta);
  assert(specifier, `Could not find a component named "${name}"`);
  return resolver.resolve<ComponentDefinition>(specifier!);
}

class CurryComponentReference implements VersionedPathReference<Option<ComponentDefinition>> {
  public tag: Tag;
  private lastValue: Opaque;
  private lastDefinition: Option<ComponentDefinition>;

  constructor(
    private inner: VersionedReference<Opaque>,
    private resolver: Resolver,
    private meta: TemplateMeta,
    private args: Option<ICapturedArguments>
  ) {
    this.tag = inner.tag;
    this.lastValue = null;
    this.lastDefinition = null;
  }

  value(): Option<ComponentDefinition> {
    let { inner, lastValue } = this;

    let value = inner.value();

    if (value === lastValue) {
      return this.lastDefinition;
    }

    let definition: Option<ComponentDefinition> = null;

    if (isComponentDefinition(value)) {
      definition = value;
    } else if(typeof value === 'string' && value) {
      let { resolver, meta } = this;
      definition = resolveComponent(resolver, value, meta);
    }

    definition = this.curry(definition);

    this.lastValue = value;
    this.lastDefinition = definition;

    return definition;
  }

  get(): VersionedPathReference<Opaque> {
    return UNDEFINED_REFERENCE;
  }

  private curry(definition: Option<ComponentDefinition>): Option<ComponentDefinition> {
    let { args } = this;

    if (!definition || !args) {
      return definition;
    }

    return new CurriedComponentDefinition(definition, args);
  }
}

export function IsComponent(vm: VM) {
  let stack = vm.stack;
  stack.push(IsComponentDefinitionReference.create(stack.pop<Reference>()));
}

COMPONENT_MAPPINGS[Op.IsComponent] = IsComponent;

export function CurryComponent(vm: VM, { op1: _meta }: Opcode) {
  let stack = vm.stack;

  let args = stack.pop<Arguments>();
  let captured: Option<ICapturedArguments> = null;

  if (args.length) {
    captured = args.capture();
    args.clear();
  }

  let meta = vm.constants.getSerializable<TemplateMeta>(_meta);
  let resolver = vm.constants.resolver;
  let definition = stack.pop<VersionedReference<Opaque>>();

  stack.push(new CurryComponentReference(definition, resolver, meta, captured));
}

COMPONENT_MAPPINGS[Op.CurryComponent] = CurryComponent;

export function PushComponentManager(vm: VM, { op1: specifier }: Opcode) {
  let definition = vm.constants.resolveSpecifier<ComponentDefinition>(specifier);
  let stack = vm.stack;

  stack.push({ definition, manager: definition.manager, component: null });
}

COMPONENT_MAPPINGS[Op.PushComponentManager] = PushComponentManager;

export function PushDynamicComponentManager(vm: VM, { op1: _meta }: Opcode) {
  let stack = vm.stack;

  let value = stack.pop<VersionedPathReference<Opaque>>().value();
  let definition: ComponentDefinition;

  if (isComponentDefinition(value)) {
    definition = value;
  } else {
    assert(typeof value === 'string', `Could not find a component named "${String(value)}"`);

    let { constants, constants: { resolver } } = vm;
    let meta = constants.getSerializable<TemplateMeta>(_meta);
    definition = resolveComponent(resolver, value as string, meta);
  }

  stack.push({ definition, manager: definition.manager, component: null });
}

COMPONENT_MAPPINGS[Op.PushDynamicComponentManager] = PushDynamicComponentManager;

interface InitialComponentState {
  definition: ComponentDefinition;
  manager: ComponentManager;
  component: null;
}

interface ComponentState {
  definition: ComponentDefinition;
  manager: ComponentManager;
  component: Component;
}

export function PushArgs(vm: VM, { op1: _names, op2: positionalCount, op3: synthetic }: Opcode) {
  let stack = vm.stack;
  let names = vm.constants.getStringArray(_names);
  ARGS.setup(stack, names, positionalCount, !!synthetic);
  stack.push(ARGS);
}

COMPONENT_MAPPINGS[Op.PushArgs] = PushArgs;

export function PrepareArgs(vm: VM, { op1: _state }: Opcode) {
  let stack = vm.stack;
  let state = vm.fetchValue<InitialComponentState>(_state);

  let { definition, manager } = state;

  if (definition.capabilities.prepareArgs !== true) {
    return;
  }

  let args = stack.pop<Arguments>();

  if (isCurriedComponentDefinition(definition)) {
    state.definition = definition = definition.unwrap(args);
    state.manager = manager = definition.manager;
  }

  let preparedArgs = manager.prepareArgs(definition, args);

  if (preparedArgs) {
    args.clear();

    let { positional, named } = preparedArgs;

    let positionalCount = positional.length;

    for (let i = 0; i < positionalCount; i++) {
      stack.push(positional[i]);
    }

    let names = Object.keys(named);

    for (let i = 0; i < names.length; i++) {
      stack.push(named[names[i]]);
    }

    args.setup(stack, names, positionalCount, true);
  }

  stack.push(args);
}

COMPONENT_MAPPINGS[Op.PrepareArgs] = PrepareArgs;

export function CreateComponent(vm: VM, { op1: flags, op2: _state }: Opcode) {
  let definition: ComponentDefinition;
  let manager: ComponentManager;
  let dynamicScope = vm.dynamicScope();
  let state = { definition, manager } = vm.fetchValue<InitialComponentState>(_state);

  let hasDefaultBlock = flags & 1;

  let args: Option<IArguments> = null;

  if (definition.capabilities.createArgs) {
    args = vm.stack.peek<IArguments>();
  }

  let component = manager.create(vm.env, definition, args, dynamicScope, vm.getSelf(), !!hasDefaultBlock);

  // We want to reuse the `state` POJO here, because we know that the opcodes
  // only transition at exactly one place.
  (state as Recast<InitialComponentState, ComponentState>).component = component;

  let tag = manager.getTag(component);

  if (!isConstTag(tag)) {
    vm.updateWith(new UpdateComponentOpcode(tag, component, manager, dynamicScope));
  }
}

COMPONENT_MAPPINGS[Op.CreateComponent] = CreateComponent;

export function RegisterComponentDestructor(vm: VM, { op1: _state }: Opcode) {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);

  let destructor = manager.getDestructor(component);
  if (destructor) vm.newDestroyable(destructor);
}

COMPONENT_MAPPINGS[Op.RegisterComponentDestructor] = RegisterComponentDestructor;

export function BeginComponentTransaction(vm: VM) {
  vm.beginCacheGroup();
  vm.elements().pushSimpleBlock();
}

COMPONENT_MAPPINGS[Op.BeginComponentTransaction] = BeginComponentTransaction;

export function PutComponentOperations(vm: VM) {
  vm.loadValue(Register.t0, new ComponentElementOperations());
}

COMPONENT_MAPPINGS[Op.PutComponentOperations] = PutComponentOperations;

export function ComponentAttr(vm: VM, { op1: _name, op2: trusting, op3: _namespace }: Opcode) {
  let name = vm.constants.getString(_name);
  let reference = vm.stack.pop<VersionedReference<Opaque>>();
  let namespace = _namespace ? vm.constants.getString(_namespace) : null;

  vm.fetchValue<ComponentElementOperations>(Register.t0).setAttribute(name, reference, !!trusting, namespace);
}

COMPONENT_MAPPINGS[Op.ComponentAttr] = ComponentAttr;

interface DeferredAttribute {
  value: VersionedReference<Opaque>;
  namespace: Option<string>;
  trusting: boolean;
}

export class ComponentElementOperations {
  private attributes = dict<DeferredAttribute>();
  private classes: VersionedReference<Opaque>[] = [];

  setAttribute(name: string, value: VersionedReference<Opaque>, trusting: boolean, namespace: Option<string>) {
    let deferred = { value, namespace, trusting };

    if (name === 'class') {
      this.classes.push(value);
    }

    this.attributes[name] = deferred;
  }

  flush(vm: VM) {
    for (let name in this.attributes) {
      let attr = this.attributes[name];
      let { value: reference, namespace, trusting } = attr;

      if (name === 'class') {
        reference = new ClassListReference(this.classes);
      }

      let attribute = vm.elements().setDynamicAttribute(name, reference.value(), trusting, namespace);

      if (!isConst(reference)) {
        vm.updateWith(new UpdateDynamicAttributeOpcode(reference, attribute));
      }
    }
  }
}

class ClassListReference implements VersionedReference<Option<string>> {
  public tag: Tag;

  constructor(private list: VersionedReference<Opaque>[]) {
    this.tag = combineTagged(list);
    this.list = list;
  }

  value(): Option<string> {
    let ret: string[] = [];
    let { list } = this;

    for (let i=0; i<list.length; i++) {
      let value = normalizeStringValue(list[i].value());
      if (value) ret.push(value);
    }

    return ret.length === 0 ? null : ret.join(' ');
  }
}

export function DidCreateElement(vm: VM, { op1: _state }: Opcode) {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);
  let operations = vm.fetchValue<ComponentElementOperations>(Register.t0);

  let action = 'DidCreateElementOpcode#evaluate';
  (manager as WithElementHook<Component>).didCreateElement(component, vm.elements().expectConstructing(action), operations);
}

COMPONENT_MAPPINGS[Op.DidCreateElement] = DidCreateElement;

export function GetComponentSelf(vm: VM, { op1: _state }: Opcode) {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);
  vm.stack.push(manager.getSelf(component));
}

COMPONENT_MAPPINGS[Op.GetComponentSelf] = GetComponentSelf;

export function GetComponentTagName(vm: VM, { op1: _state }: Opcode) {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);
  vm.stack.push((manager as Recast<ComponentManager, WithDynamicTagName<Component>>).getTagName(component));
}

COMPONENT_MAPPINGS[Op.GetComponentTagName] = GetComponentTagName;

export function GetComponentLayout(vm: VM, { op1: _state }: Opcode) {
  let { manager, definition, component } = vm.fetchValue<ComponentState>(_state);
  let { constants: { resolver }, stack } = vm;
  let specifier: Specifier;

  if (hasStaticLayout(definition, manager)) {
    specifier = manager.getLayout(definition, resolver) as Specifier;
  } else if (hasDynamicLayout(definition, manager)) {
    specifier = manager.getLayout(component, resolver) as Specifier;
  } else {
    throw unreachable();
  }

  let layout = resolver.resolve<AbstractTemplate<ProgramSymbolTable>>(specifier);

  stack.push(layout.symbolTable);
  stack.push(layout);
}

COMPONENT_MAPPINGS[Op.GetComponentLayout] = GetComponentLayout;

export function InvokeComponentLayout(vm:VM) {
  let { stack } = vm;

  let handle = stack.pop<Handle>();
  let { symbols, hasEval } = stack.pop<ProgramSymbolTable>();

  {
    let scope = vm.pushRootScope(symbols.length + 1, true);
    scope.bindSelf(stack.pop<VersionedPathReference<Opaque>>());

    let args = vm.stack.pop<Arguments>();

    let lookup: Option<Dict<ScopeSlot>> = null;
    let $eval: Option<number> = -1;

    if (hasEval) {
      $eval = symbols.indexOf('$eval') + 1;
      lookup = dict<ScopeSlot>();
    }

    let callerNames = args.named.atNames;

    for (let i=callerNames.length - 1; i>=0; i--) {
      let atName = callerNames[i];
      let symbol = symbols.indexOf(callerNames[i]);
      let value = args.named.get(atName, false);

      if (symbol !== -1) scope.bindSymbol(symbol + 1, value);
      if (hasEval) lookup![atName] = value;
    }

    args.clear();

    let bindBlock = (name: string) => {
      let symbol = symbols.indexOf(name);
      let handle = stack.pop<Option<Handle>>();
      let table = stack.pop<Option<BlockSymbolTable>>();

      let block: Option<ScopeBlock> = table ? [handle!, table] : null;

      if (symbol !== -1) {
        scope.bindBlock(symbol + 1, block);
      }

      if (lookup) lookup[name] = block;
    };

    bindBlock(ATTRS_BLOCK);
    bindBlock('&inverse');
    bindBlock('&default');

    if (lookup) scope.bindEvalScope(lookup);

    vm.pushFrame();
    vm.call(handle!);
  }
}

COMPONENT_MAPPINGS[Op.InvokeComponentLayout] = InvokeComponentLayout;

export function DidRenderLayout(vm: VM, { op1: _state }: Opcode) {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);
  let bounds = vm.elements().popBlock();

  manager.didRenderLayout(component, bounds);

  vm.env.didCreate(component, manager);

  vm.updateWith(new DidUpdateLayoutOpcode(manager, component, bounds));
}

COMPONENT_MAPPINGS[Op.DidRenderLayout] = DidRenderLayout;

export function CommitComponentTransaction(vm: VM) { vm.commitCacheGroup(); }

COMPONENT_MAPPINGS[Op.CommitComponentTransaction] = CommitComponentTransaction;

export class UpdateComponentOpcode extends UpdatingOpcode {
  public type = 'update-component';

  constructor(
    public tag: Tag,
    private component: Component,
    private manager: ComponentManager,
    private dynamicScope: DynamicScope,
  ) {
    super();
  }

  evaluate(_vm: UpdatingVM) {
    let { component, manager, dynamicScope } = this;

    manager.update(component, dynamicScope);
  }
}

export class DidUpdateLayoutOpcode extends UpdatingOpcode {
  public type = 'did-update-layout';
  public tag: Tag = CONSTANT_TAG;

  constructor(
    private manager: ComponentManager,
    private component: Component,
    private bounds: Bounds,
  ) {
    super();
  }

  evaluate(vm: UpdatingVM) {
    let { manager, component, bounds } = this;

    manager.didUpdateLayout(component, bounds);

    vm.env.didUpdate(component, manager);
  }
}
