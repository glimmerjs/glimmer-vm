import { Opaque, Option, Dict, ProgramSymbolTable, Recast, RuntimeResolver, BlockSymbolTable, Present } from '@glimmer/interfaces';
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
  isCurriedComponentDefinition,
  WithDynamicTagName,
  WithElementHook,
  ComponentSpec,
  PublicComponentSpec
} from '../../component/interfaces';
import { normalizeStringValue } from '../../dom/normalize';
import { DynamicScope, ScopeBlock, ScopeSlot } from '../../environment';
import { APPEND_OPCODES, UpdatingOpcode } from '../../opcodes';
import { UNDEFINED_REFERENCE } from '../../references';
import { UpdatingVM, VM } from '../../vm';
import { Arguments, IArguments, ICapturedArguments } from '../../vm/arguments';
import { IsCurriedComponentDefinitionReference } from './content';
import { UpdateDynamicAttributeOpcode } from './dom';
import { ComponentDefinition, ComponentManager, Component } from '../../internal-interfaces';
import { dict, assert, unreachable, stackCheck, Check } from "@glimmer/util";
import { Op, Register } from '@glimmer/vm';
import { TemplateMeta } from "@glimmer/wire-format";
import { ATTRS_BLOCK, VMHandle } from '@glimmer/opcode-compiler';
import { Invocation } from "@glimmer/runtime";

const ARGS = new Arguments();

function resolveComponent<Specifier>(resolver: RuntimeResolver<Specifier>, name: string, meta: Specifier): Option<ComponentSpec> {
  let spec = resolver.lookupComponent(name, meta);
  assert(spec, `Could not find a component named "${name}"`);
  return spec as ComponentSpec;
}

export function curry(spec: PublicComponentSpec, args: Option<ICapturedArguments> = null): CurriedComponentDefinition {
  return new CurriedComponentDefinition(spec as ComponentSpec, args);
}

class ManagerChecker extends Check {
  validate(value: any): value is ComponentManager {
    return value.getCapabilities !== undefined;
  }
  throw(value: any): void {
    super.throw(value, 'component manager');
  }
}

class VoidChecker extends Check {
  validate(value: any): value is Present {
    return value !== undefined && value !== null;
  }
  throw(value: any): void {
    super.throw(value, 'present');
  }
}

class HandleChecker extends Check {
  validate(value: any): value is VMHandle {
    return this.type(value) === 'number';
  }

  throw(value: any): void {
    super.throw(value, 'handle');
  }
}

class ReferenceCheck extends Check {
  validate(value: any): value is Reference {
    return value.value !== undefined && typeof value.value === 'function';
  }

  throw(value: any): void {
    super.throw(value, 'reference');
  }
}

class DefinitionCheck extends Check {
  validate(value: any): value is ComponentDefinition {
    return value.specifier !== undefined || value.capabilities !== undefined || isCurriedComponentDefinition(value);
  }
  throw(value: any): void {
    super.throw(value, 'definition');
  }
}

class SymbolTableCheck extends Check {
  validate(value: any): value is ProgramSymbolTable {
    return value.hasEval !== undefined && Array.isArray(value.symbols);
  }
  throw(value: any): void {
    super.throw(value, 'symbol table');
  }
}

class InvocationCheck extends Check {
  validate(value: any): value is Invocation  {
    return new HandleChecker().validate(value.handle) && new SymbolTableCheck().validate(value.symbolTable);
  }

  throw(value: any): void {
    super.throw(value, 'invocation');
  }
}

class ArgumentsCheck extends Check {
  validate(value: any): value is Arguments {
    return value.named !== undefined && value.positional !== undefined;
  }

  throw(value: any) {
    super.throw(value, 'arguments');
  }
}

class TagNameCheck extends Check {
  validate(value: any): value is string {
    return this.type(value) === 'string' || value === null;
  }
  throw(value: any) { super.throw(value, 'tag name or null'); }
}

const isVMHandle = new HandleChecker();
const notVoid = new VoidChecker();
const isManager = new ManagerChecker();
const isReference = new ReferenceCheck();
const isDefinition = new DefinitionCheck();
const isInvocation = new InvocationCheck();
const isArguments = new ArgumentsCheck();
const isTagName = new TagNameCheck();

class CurryComponentReference<Specifier> implements VersionedPathReference<Option<CurriedComponentDefinition>> {
  public tag: Tag;
  private lastValue: Opaque;
  private lastDefinition: Option<CurriedComponentDefinition>;

  constructor(
    private inner: VersionedReference<Opaque>,
    private resolver: RuntimeResolver<Specifier>,
    private meta: Specifier,
    private args: Option<ICapturedArguments>
  ) {
    this.tag = inner.tag;
    this.lastValue = null;
    this.lastDefinition = null;
  }

  value(): Option<CurriedComponentDefinition> {
    let { inner, lastValue } = this;

    let value = inner.value();

    if (value === lastValue) {
      return this.lastDefinition;
    }

    let definition: Option<CurriedComponentDefinition | ComponentSpec> = null;

    if (isCurriedComponentDefinition(value)) {
      definition = value;
    } else if (typeof value === 'string' && value) {
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

  private curry(definition: Option<CurriedComponentDefinition | ComponentSpec>): Option<CurriedComponentDefinition> {
    let { args } = this;

    if (!args && isCurriedComponentDefinition(definition)) {
      return definition;
    } else if (!definition) {
      return null;
    } else {
      return new CurriedComponentDefinition(definition, args);
    }
  }
}

APPEND_OPCODES.add(Op.IsComponent, vm => {
  let stack = vm.stack;

  let reference = stack.pop<Reference>();
  if (stackCheck(reference, isReference)) {
    stack.push(IsCurriedComponentDefinitionReference.create(reference));
  }
});

APPEND_OPCODES.add(Op.CurryComponent, (vm, { op1: _meta }) => {
  let stack = vm.stack;

  let args = stack.pop<Arguments>();
  if (stackCheck(args, isArguments)) {
    let captured: Option<ICapturedArguments> = null;

    if (args.length) {
      captured = args.capture();
      args.clear();
    }

    let meta = vm.constants.getSerializable<TemplateMeta>(_meta);
    let resolver = vm.constants.resolver;
    let definitionReference = stack.pop<VersionedReference<Opaque>>();

    if (stackCheck(definitionReference, isReference)) {
      stack.push(new CurryComponentReference(definitionReference, resolver, meta, captured));
    }
  }
});

APPEND_OPCODES.add(Op.PushComponentSpec, (vm, { op1: handle }) => {
  let spec = vm.constants.resolveHandle<ComponentSpec>(handle);

  assert(!!spec, `Missing component for ${handle} (TODO: env.specifierForHandle)`);

  let stack = vm.stack;

  let { definition, manager } = spec;
  if (stackCheck(definition, isDefinition) && stackCheck(manager, isManager)) {
    stack.push({ definition, manager, component: null });
  }
});

APPEND_OPCODES.add(Op.PushDynamicComponentManager, (vm, { op1: _meta }) => {
  let stack = vm.stack;

  let component = stack.pop<VersionedPathReference<CurriedComponentDefinition | string>>().value();
  let definition: ComponentSpec['definition'] | CurriedComponentDefinition;
  let manager: Option<ComponentSpec['manager']> = null;

  if (typeof component === 'string') {
    let { constants, constants: { resolver } } = vm;
    let meta = constants.getSerializable<TemplateMeta>(_meta);
    let spec = resolveComponent(resolver, component, meta);

    assert(!!spec, `Could not find a component named "${component}"`);

    definition = spec!.definition;
    manager = spec!.manager;

    assert(definition && manager, 'missing definition or manager');
  } else if (isCurriedComponentDefinition(component)) {
    definition = component;
  } else {
    throw unreachable();
  }

  if (stackCheck(definition, isDefinition)) {
    stack.push({ definition, manager, component: null });
  }
});

interface InitialComponentState {
  definition: ComponentDefinition;
  manager: Option<ComponentManager>;
  component: null;
}

interface PopulatedComponentState {
  definition: ComponentDefinition;
  manager: ComponentManager;
  component: null;
}

interface ComponentState {
  definition: ComponentDefinition;
  manager: ComponentManager;
  component: Component;
}

APPEND_OPCODES.add(Op.PushArgs, (vm, { op1: _names, op2: positionalCount, op3: synthetic }) => {
  let stack = vm.stack;
  let names = vm.constants.getStringArray(_names);
  ARGS.setup(stack, names, positionalCount, !!synthetic);
  if (stackCheck(ARGS, isArguments)) {
    stack.push(ARGS);
  }
});

APPEND_OPCODES.add(Op.PrepareArgs, (vm, { op1: _state }) => {
  let stack = vm.stack;
  let state = vm.fetchValue<InitialComponentState>(_state);

  let { definition, manager } = state;
  stackCheck(definition, isDefinition);
  let args: Arguments;

  if (isCurriedComponentDefinition(definition)) {
    assert(!manager, "If the component definition was curried, we don't yet have a manager");

    args = stack.pop<Arguments>();

    if (stackCheck(args, isArguments)) {
      let { manager: curriedManager, definition: curriedDefinition } = definition.unwrap(args);
      state.manager = manager = curriedManager as ComponentManager;
      state.definition = definition = curriedDefinition;
    }

  } else {
    args = stack.pop<Arguments>();
    stackCheck(args, isArguments);
  }

  if (manager!.getCapabilities(definition).prepareArgs !== true) {
    stack.push(args);
    return;
  }

  let preparedArgs = manager!.prepareArgs(definition, args);

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
});

APPEND_OPCODES.add(Op.CreateComponent, (vm, { op1: flags, op2: _state }) => {
  let definition: ComponentDefinition;
  let manager: ComponentManager;
  let dynamicScope = vm.dynamicScope();
  let state = { definition, manager } = vm.fetchValue<PopulatedComponentState>(_state);

  let hasDefaultBlock = flags & 1;

  let args: Option<IArguments> = null;

  if (manager.getCapabilities(definition).createArgs) {
    args = vm.stack.peek<IArguments>();
    stackCheck(args, isArguments);
  }

  let component = manager.create(vm.env, definition, args, dynamicScope, vm.getSelf(), !!hasDefaultBlock);

  // We want to reuse the `state` POJO here, because we know that the opcodes
  // only transition at exactly one place.
  (state as Recast<InitialComponentState, ComponentState>).component = component;

  let tag = manager.getTag(component);

  if (!isConstTag(tag)) {
    vm.updateWith(new UpdateComponentOpcode(tag, component, manager, dynamicScope));
  }
});

APPEND_OPCODES.add(Op.RegisterComponentDestructor, (vm, { op1: _state }) => {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);
  if (stackCheck(manager, isManager)) {
    let destructor = manager.getDestructor(component);
    if (destructor) vm.newDestroyable(destructor);
  }
});

APPEND_OPCODES.add(Op.BeginComponentTransaction, vm => {
  vm.beginCacheGroup();
  vm.elements().pushSimpleBlock();
});

APPEND_OPCODES.add(Op.PutComponentOperations, vm => {
  vm.loadValue(Register.t0, new ComponentElementOperations());
});

APPEND_OPCODES.add(Op.ComponentAttr, (vm, { op1: _name, op2: trusting, op3: _namespace }) => {
  let name = vm.constants.getString(_name);
  let reference = vm.stack.pop<VersionedReference<Opaque>>();
  let namespace = _namespace ? vm.constants.getString(_namespace) : null;

  if (stackCheck(reference, isReference)) {
    vm.fetchValue<ComponentElementOperations>(Register.t0).setAttribute(name, reference, !!trusting, namespace);
  }
});

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

  flush(vm: VM<Opaque>) {
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

APPEND_OPCODES.add(Op.DidCreateElement, (vm, { op1: _state }) => {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);
  let operations = vm.fetchValue<ComponentElementOperations>(Register.t0);

  let action = 'DidCreateElementOpcode#evaluate';
  (manager as WithElementHook<Component>).didCreateElement(component, vm.elements().expectConstructing(action), operations);
});

APPEND_OPCODES.add(Op.GetComponentSelf, (vm, { op1: _state }) => {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);
  let reference = manager.getSelf(component);
  if (stackCheck(reference, isReference)) {
    vm.stack.push(reference);
  }
});

APPEND_OPCODES.add(Op.GetComponentTagName, (vm, { op1: _state }) => {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);
  let tagName = (manager as Recast<ComponentManager, WithDynamicTagName<Component>>).getTagName(component);

  console.log(stackCheck(tagName, isTagName));
  if (stackCheck(tagName, isTagName)) {
    vm.stack.push(tagName);
  }
});

// Dynamic Invocation Only
APPEND_OPCODES.add(Op.GetComponentLayout, (vm, { op1: _state }) => {
  let { manager, definition, component } = vm.fetchValue<ComponentState>(_state);
  let { constants: { resolver }, stack } = vm;
  let invoke: { handle: VMHandle, symbolTable: ProgramSymbolTable };

  if (stackCheck(manager, isManager) && stackCheck(definition, isDefinition)) {
    if (hasStaticLayout(definition, manager)) {
      invoke = manager.getLayout(definition, resolver);
    } else if (hasDynamicLayout(definition, manager)) {
      invoke = manager.getLayout(component, resolver);
    } else {
      throw unreachable();
    }

    if (stackCheck(invoke, isInvocation)) {
      stack.push(invoke.symbolTable);
      stack.push(invoke.handle);
    }
  }
});

// Dynamic Invocation Only
APPEND_OPCODES.add(Op.InvokeComponentLayout, vm => {
  let { stack } = vm;

  let handle = stack.pop<VMHandle>();

  if (stackCheck(handle, isVMHandle)) {}

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
      let handle = stack.pop<Option<VMHandle>>();
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
});

APPEND_OPCODES.add(Op.DidRenderLayout, (vm, { op1: _state }) => {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);
  if (stackCheck(manager, isManager) && stackCheck(component, notVoid)) {
    let bounds = vm.elements().popBlock();

    manager.didRenderLayout(component, bounds);

    vm.env.didCreate(component, manager);

    vm.updateWith(new DidUpdateLayoutOpcode(manager, component, bounds));
  }
});

APPEND_OPCODES.add(Op.CommitComponentTransaction, vm => vm.commitCacheGroup());

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

  evaluate(_vm: UpdatingVM<Opaque>) {
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

  evaluate(vm: UpdatingVM<Opaque>) {
    let { manager, component, bounds } = this;

    manager.didUpdateLayout(component, bounds);

    vm.env.didUpdate(component, manager);
  }
}
