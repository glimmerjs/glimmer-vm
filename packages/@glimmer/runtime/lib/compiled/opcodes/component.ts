import { Opaque, Option, Dict, BlockSymbolTable } from '@glimmer/interfaces';
import {
  combineTagged,
  CONSTANT_TAG,
  Tag,
  VersionedReference,
  VersionedPathReference,
  isConst,
  isConstTag
} from '@glimmer/reference';
import Bounds from '../../bounds';
import { Component, ComponentDefinition, ComponentManager, isComponentDefinition } from '../../component/interfaces';
import { normalizeStringValue } from '../../dom/normalize';
import { DynamicScope, ScopeSlot, Handle, ScopeBlock } from '../../environment';
import { APPEND_OPCODES, OpcodeJSON, UpdatingOpcode } from '../../opcodes';
import { ATTRS_BLOCK } from '../../syntax/functions';
import { UpdatingVM, VM } from '../../vm';
import ARGS, { Arguments, IArguments } from '../../vm/arguments';
import { UpdateDynamicAttributeOpcode } from './dom';
import { dict, assert } from "@glimmer/util";
import { Op, Register } from '@glimmer/vm';
import { TemplateMeta } from "@glimmer/wire-format";

APPEND_OPCODES.add(Op.PushComponentManager, (vm, { op1: specifier }) => {
  let definition = vm.constants.resolveSpecifier<ComponentDefinition>(specifier);
  let stack = vm.stack;

  stack.push({ definition, manager: definition.manager, component: null });
});

APPEND_OPCODES.add(Op.PushDynamicComponentManager, (vm, { op1: _meta }) => {
  let stack = vm.stack;

  let value = stack.pop<VersionedPathReference<Opaque>>().value();
  let definition: ComponentDefinition;

  if (isComponentDefinition(value)) {
    definition = value;
  } else {
    assert(typeof value === 'string', `Could not find a component named "${String(value)}"`);

    let { constants, constants: { resolver } } = vm;

    let meta = constants.getSerializable<TemplateMeta>(_meta);
    let specifier = resolver.lookupComponent(value as string, meta);

    assert(specifier, `Could not find a component named "${value as string}"`);

    definition = resolver.resolve<ComponentDefinition>(specifier!);
  }

  stack.push({ definition, manager: definition.manager, component: null });
});

interface InitialComponentState {
  definition: ComponentDefinition;
  manager: ComponentManager;
  component: null;
}

export interface ComponentState {
  definition: ComponentDefinition;
  manager: ComponentManager;
  component: Component;
}

APPEND_OPCODES.add(Op.PushArgs, (vm, { op1: _names, op2: positionalCount, op3: synthetic }) => {
  let stack = vm.stack;
  let names = vm.constants.getStringArray(_names);
  ARGS.setup(stack, names, positionalCount, !!synthetic);
  stack.push(ARGS);
});

APPEND_OPCODES.add(Op.PrepareArgs, (vm, { op1: _state }) => {
  let stack = vm.stack;
  let { definition, manager } = vm.fetchValue<InitialComponentState>(_state);
  let args = stack.pop<Arguments>();

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
});

APPEND_OPCODES.add(Op.CreateComponent, (vm, { op1: flags, op2: _state }) => {
  let definition: ComponentDefinition;
  let manager: ComponentManager;
  let args = vm.stack.pop<IArguments>();
  let dynamicScope = vm.dynamicScope();
  let state = { definition, manager } = vm.fetchValue<InitialComponentState>(_state);

  let hasDefaultBlock = flags & 1;

  let component = manager.create(vm.env, definition, args, dynamicScope, vm.getSelf(), !!hasDefaultBlock);

  // We want to reuse the `state` POJO here, because we know that the opcodes
  // only transition at exactly one place.
  (state as any as ComponentState).component = component;

  let tag = manager.getTag(component);

  if (!isConstTag(tag)) {
    vm.updateWith(new UpdateComponentOpcode(tag, definition.name, component, manager, dynamicScope));
  }

  // Don't commit this
  vm.stack.push(args);
});

APPEND_OPCODES.add(Op.RegisterComponentDestructor, (vm, { op1: _state }) => {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);

  let destructor = manager.getDestructor(component);
  if (destructor) vm.newDestroyable(destructor);
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

  vm.fetchValue<ComponentElementOperations>(Register.t0).setAttribute(name, reference, !!trusting, namespace);
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

APPEND_OPCODES.add(Op.DidCreateElement, (vm, { op1: _state }) => {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);
  let operations = vm.fetchValue<ComponentElementOperations>(Register.t0);

  let action = 'DidCreateElementOpcode#evaluate';
  manager.didCreateElement(component, vm.elements().expectConstructing(action), operations);
});

APPEND_OPCODES.add(Op.GetComponentSelf, (vm, { op1: _state }) => {
  let { manager, component } = vm.fetchValue<ComponentState>(_state);
  vm.stack.push(manager.getSelf(component));
});

APPEND_OPCODES.add(Op.InvokeComponentLayout, (vm, { op1: _state }) => {
  let { stack } = vm;
  let { manager, definition, component } = vm.fetchValue<ComponentState>(_state);
  let block = manager.layoutFor(definition, component, vm.env);
  let { symbolTable: { symbols, hasEval }, handle } = block;

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

    function bindBlock(name: string) {
      let symbol = symbols.indexOf(name);
      let handle = stack.pop<Option<Handle>>();
      let table = stack.pop<Option<BlockSymbolTable>>();

      let block: Option<ScopeBlock> = table ? [handle!, table] : null;

      if (symbol !== -1) {
        scope.bindBlock(symbol + 1, block);
      }

      if (lookup) lookup[name] = block;
    }

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
  let bounds = vm.elements().popBlock();

  manager.didRenderLayout(component, bounds);

  vm.env.didCreate(component, manager);

  vm.updateWith(new DidUpdateLayoutOpcode(manager, component, bounds));
});

APPEND_OPCODES.add(Op.CommitComponentTransaction, vm => vm.commitCacheGroup());

export class UpdateComponentOpcode extends UpdatingOpcode {
  public type = 'update-component';

  constructor(
    public tag: Tag,
    private name: string,
    private component: Component,
    private manager: ComponentManager<Component>,
    private dynamicScope: DynamicScope,
  ) {
    super();
  }

  evaluate(_vm: UpdatingVM) {
    let { component, manager, dynamicScope } = this;

    manager.update(component, dynamicScope);
  }

  toJSON(): OpcodeJSON {
    return {
      args: [JSON.stringify(this.name)],
      guid: this._guid,
      type: this.type,
    };
  }
}

export class DidUpdateLayoutOpcode extends UpdatingOpcode {
  public type = 'did-update-layout';
  public tag: Tag = CONSTANT_TAG;

  constructor(
    private manager: ComponentManager<Component>,
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
