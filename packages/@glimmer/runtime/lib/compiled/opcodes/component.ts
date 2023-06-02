import {
  check,
  CheckFunction,
  CheckHandle,
  CheckInstanceof,
  CheckInterface,
  CheckOr,
  CheckProgramSymbolTable,
  CheckString,
} from '@glimmer/debug';
import { registerDestructor } from '@glimmer/destroyable';
import type {
  BlockBoundsRef,
  Bounds,
  BrowserTreeBuilderInterface,
  CapabilityMask,
  CapturedArguments,
  CompilableProgram,
  ComponentDefinition,
  ComponentDefinitionState,
  ComponentInstance,
  ComponentInstanceState,
  ComponentInstanceWithCreate,
  Dict,
  DomTypes,
  DynamicScope,
  ElementOperations,
  InternalComponentManager,
  ModifierDefinition,
  Nullable,
  Owner,
  ProgramSymbolTable,
  Recast,
  ScopeSlot,
  ServerTreeBuilderInterface,
  UpdatingOpcode,
  VMArguments,
  WithDynamicTagName,
  WithElementHook,
  WithUpdateHook,
} from '@glimmer/interfaces';
import { managerHasCapability } from '@glimmer/manager';
import { isConstRef, type Reference, valueForRef } from '@glimmer/reference';
import {
  assert,
  debugToString,
  EMPTY_STRING_ARRAY,
  enumerate,
  expect,
  unwrap,
  unwrapTemplate,
} from '@glimmer/util';
import {
  $t0,
  $t1,
  SET_NAMED_VARIABLES_OP,
  type Register,
  SET_BLOCKS_OP,
  BEGIN_COMPONENT_TRANSACTION_OP,
  CAPTURE_ARGS_OP,
  COMMIT_COMPONENT_TRANSACTION_OP,
  COMPONENT_ATTR_OP,
  CREATE_COMPONENT_OP,
  DID_CREATE_ELEMENT_OP,
  DID_RENDER_LAYOUT_OP,
  GET_COMPONENT_LAYOUT_OP,
  GET_COMPONENT_SELF_OP,
  GET_COMPONENT_TAG_NAME_OP,
  INVOKE_COMPONENT_LAYOUT_OP,
  MAIN_OP,
  POPULATE_LAYOUT_OP,
  PREPARE_ARGS_OP,
  PUSH_ARGS_OP,
  PUSH_COMPONENT_DEFINITION_OP,
  PUSH_DYNAMIC_COMPONENT_INSTANCE_OP,
  PUSH_EMPTY_ARGS_OP,
  PUT_COMPONENT_OPERATIONS_OP,
  REGISTER_COMPONENT_DESTRUCTOR_OP,
  RESOLVE_CURRIED_COMPONENT_OP,
  RESOLVE_DYNAMIC_COMPONENT_OP,
  STATIC_COMPONENT_ATTR_OP,
  VIRTUAL_ROOT_SCOPE_OP,
  PREPARE_ARGS_CAPABILITY,
  CREATE_ARGS_CAPABILITY,
  CREATE_CALLER_CAPABILITY,
  CREATE_INSTANCE_CAPABILITY,
  DYNAMIC_LAYOUT_CAPABILITY,
  DYNAMIC_SCOPE_CAPABILITY,
  HAS_SUB_OWNER_CAPABILITY,
  UPDATE_HOOK_CAPABILITY,
  WILL_DESTROY_CAPABILITY,
  WRAPPED_CAPABILITY,
} from '@glimmer/vm-constants';

import { hasCustomDebugRenderTreeLifecycle } from '../../component/interfaces';
import { resolveComponent } from '../../component/resolve';
import {
  type CurriedValue,
  isCurriedType,
  isCurriedValue,
  resolveCurriedValue,
} from '../../curried-value';
import createClassListReference from '../../references/class-list';
import { ARGS, CONSTANTS } from '../../symbols';
import type { UpdatingVM } from '../../vm';
import type { InternalVM } from '../../vm/append';
import { type BlockArgumentsImpl, EMPTY_ARGS, VMArgumentsImpl } from '../../vm/arguments';
import {
  CheckArguments,
  CheckComponentDefinition,
  CheckComponentInstance,
  CheckCurriedComponentDefinition,
  CheckFinishedComponentInstance,
  CheckInvocation,
  CheckReference,
} from './-debug-strip';
import { UpdateDynamicAttributeOpcode } from './dom';
import { CURRIED_COMPONENT } from '@glimmer/vm-constants';
import { define } from '../../opcodes';
import { getClassicBoundsFor } from '../../vm/update';
import { type TrackedCache, getValue, createCache } from '@glimmer/validator';
import { UpdateModifierOpcode } from './modifier';
import { _readValue_ } from '@glimmer/reference/lib/reference';

/**
 * The VM creates a new ComponentInstance data structure for every component
 * invocation it encounters.
 *
 * Similar to how a ComponentDefinition contains state about all components of a
 * particular type, a ComponentInstance contains state specific to a particular
 * instance of a component type. It also contains a pointer back to its
 * component type's ComponentDefinition.
 */

export interface InitialComponentInstance {
  definition: ComponentDefinition;
  manager: Nullable<InternalComponentManager>;
  capabilities: Nullable<CapabilityMask>;
  state: null;
  handle: Nullable<number>;
  table: Nullable<ProgramSymbolTable>;
  lookup: Nullable<Dict<ScopeSlot>>;
}

export interface PopulatedComponentInstance {
  definition: ComponentDefinition;
  manager: InternalComponentManager;
  capabilities: CapabilityMask;
  state: null;
  handle: number;
  table: Nullable<ProgramSymbolTable>;
  lookup: Nullable<Dict<ScopeSlot>>;
}

export interface PartialComponentDefinition {
  state: Nullable<ComponentDefinitionState>;
  manager: InternalComponentManager;
}

define(PUSH_COMPONENT_DEFINITION_OP, (vm, { op1: handle }) => {
  let definition = vm[CONSTANTS].getValue<ComponentDefinition>(handle);
  assert(!!definition, `Missing component for ${handle}`);

  let { manager, capabilities } = definition;

  let instance: InitialComponentInstance = {
    definition,
    manager,
    capabilities,
    state: null,
    handle: null,
    table: null,
    lookup: null,
  };

  vm.stack.push(instance);
});

define(RESOLVE_DYNAMIC_COMPONENT_OP, (vm, { op1: _isStrict }) => {
  let stack = vm.stack;
  let component = check(
    valueForRef(check(stack.pop(), CheckReference)),
    CheckOr(CheckString, CheckCurriedComponentDefinition)
  );
  let constants = vm[CONSTANTS];
  let owner = vm._getOwner_();
  let isStrict = constants.getValue<boolean>(_isStrict);

  vm._loadValue_($t1, null); // Clear the temp register

  let definition: ComponentDefinition | CurriedValue;

  if (typeof component === 'string') {
    if (import.meta.env.DEV && isStrict) {
      throw new Error(
        `Attempted to resolve a dynamic component with a string definition, \`${component}\` in a strict mode template. In strict mode, using strings to resolve component definitions is prohibited. You can instead import the component definition and use it directly.`
      );
    }

    let resolvedDefinition = resolveComponent(vm.runtime.resolver, constants, component, owner);

    definition = expect(resolvedDefinition, `Could not find a component named "${component}"`);
  } else if (isCurriedValue(component)) {
    definition = component;
  } else {
    definition = constants.component(component, owner);
  }

  stack.push(definition);
});

define(RESOLVE_CURRIED_COMPONENT_OP, (vm) => {
  let stack = vm.stack;
  let reference = check(stack.pop(), CheckReference);
  let value = valueForRef(reference);
  let constants = vm[CONSTANTS];

  let definition: CurriedValue | ComponentDefinition | null;

  if (
    import.meta.env.DEV &&
    !(typeof value === 'function' || (typeof value === 'object' && value !== null))
  ) {
    throw new Error(
      `Expected a component definition, but received ${value}. You may have accidentally done <${reference.debugLabel}>, where "${reference.debugLabel}" was a string instead of a curried component definition. You must either use the component definition directly, or use the {{component}} helper to create a curried component definition when invoking dynamically.`
    );
  }

  if (isCurriedValue(value)) {
    definition = value;
  } else {
    definition = constants.component(value as object, vm._getOwner_(), true);

    if (import.meta.env.DEV && definition === null) {
      throw new Error(
        `Expected a dynamic component definition, but received an object or function that did not have a component manager associated with it. The dynamic invocation was \`<${
          reference.debugLabel
        }>\` or \`{{${
          reference.debugLabel
        }}}\`, and the incorrect definition is the value at the path \`${
          reference.debugLabel
        }\`, which was: ${debugToString!(value)}`
      );
    }
  }

  stack.push(definition);
});

define(PUSH_DYNAMIC_COMPONENT_INSTANCE_OP, (vm) => {
  let { stack } = vm;
  let definition = stack.pop<ComponentDefinition>();

  let capabilities, manager;

  if (isCurriedValue(definition)) {
    manager = capabilities = null;
  } else {
    manager = definition.manager;
    capabilities = definition.capabilities;
  }

  stack.push({ definition, capabilities, manager, state: null, handle: null, table: null });
});

define(PUSH_ARGS_OP, (vm, { op1: _names, op2: _blockNames, op3: flags }) => {
  let stack = vm.stack;
  let names = vm[CONSTANTS].getArray<string>(_names);

  let positionalCount = flags >> 4;
  let atNames = flags & 0b1000;
  let blockNames =
    flags & 0b0111 ? vm[CONSTANTS].getArray<string>(_blockNames) : EMPTY_STRING_ARRAY;

  vm[ARGS].setup(stack, names, blockNames, positionalCount, !!atNames);
  stack.push(vm[ARGS]);
});

define(PUSH_EMPTY_ARGS_OP, (vm) => {
  let { stack } = vm;

  stack.push(vm[ARGS].empty(stack));
});

define(CAPTURE_ARGS_OP, (vm) => {
  let stack = vm.stack;

  let args = check(stack.pop(), CheckInstanceof(VMArgumentsImpl));
  let capturedArgs = args.capture();
  stack.push(capturedArgs);
});

define(PREPARE_ARGS_OP, (vm, { op1: _state }) => {
  let stack = vm.stack;
  let instance = vm._fetchValue_<ComponentInstance>(_state as Register);
  let args = check(stack.pop(), CheckInstanceof(VMArgumentsImpl));

  let { definition } = instance;

  if (isCurriedType(definition, CURRIED_COMPONENT)) {
    assert(
      !definition.manager,
      "If the component definition was curried, we don't yet have a manager"
    );

    let constants = vm[CONSTANTS];

    let {
      definition: resolvedDefinition,
      owner,
      resolved,
      positional,
      named,
    } = resolveCurriedValue(definition);

    if (resolved === true) {
      definition = resolvedDefinition as ComponentDefinition;
    } else if (typeof resolvedDefinition === 'string') {
      let resolvedValue = vm.runtime.resolver.lookupComponent(resolvedDefinition, owner);

      definition = constants.resolvedComponent(
        expect(resolvedValue, 'BUG: expected resolved component'),
        resolvedDefinition
      );
    } else {
      definition = constants.component(resolvedDefinition, owner);
    }

    if (named !== undefined) {
      args.named._merge_(...named);
    }

    if (positional !== undefined) {
      args._realloc_(positional.length);
      args.positional.prepend(positional);
    }

    let { manager } = definition;

    assert(instance.manager === null, 'component instance manager should not be populated yet');
    assert(
      instance.capabilities === null,
      'component instance manager should not be populated yet'
    );

    instance.definition = definition;
    instance.manager = manager;
    instance.capabilities = definition.capabilities;

    // Save off the owner that this component was curried with. Later on,
    // we'll fetch the value of this register and set it as the owner on the
    // new root scope.
    vm._loadValue_($t1, owner);
  }

  let { manager, state } = definition;
  let capabilities = instance.capabilities;

  if (!managerHasCapability(manager, capabilities, PREPARE_ARGS_CAPABILITY)) {
    stack.push(args);
    return;
  }

  let blocks = args.blocks.values;
  let blockNames = args.blocks._names_;
  let preparedArgs = manager.prepareArgs(state, args);

  if (preparedArgs) {
    args.clear();

    for (let block of blocks) {
      stack.push(block);
    }

    let { positional, named } = preparedArgs;

    let positionalCount = positional.length;

    for (let index = 0; index < positionalCount; index++) {
      stack.push(positional[index]);
    }

    let names = Object.keys(named);

    for (let name of names) {
      stack.push(named[unwrap(name)]);
    }

    args.setup(stack, names, blockNames, positionalCount, false);
  }

  stack.push(args);
});

define(CREATE_COMPONENT_OP, (vm, { op1: flags, op2: _state }) => {
  let instance = check(vm._fetchValue_(_state as Register), CheckComponentInstance);
  let { definition, manager, capabilities } = instance;

  if (!managerHasCapability(manager, capabilities, CREATE_INSTANCE_CAPABILITY)) {
    // TODO: Closure and Main components are always invoked dynamically, so this
    // opcode may run even if this capability is not enabled. In the future we
    // should handle this in a better way.
    return;
  }

  let dynamicScope: Nullable<DynamicScope> = null;
  if (managerHasCapability(manager, capabilities, DYNAMIC_SCOPE_CAPABILITY)) {
    dynamicScope = vm._dynamicScope_();
  }

  let hasDefaultBlock = flags & 1;
  let args: Nullable<VMArguments> = null;

  if (managerHasCapability(manager, capabilities, CREATE_ARGS_CAPABILITY)) {
    args = check(vm.stack.peek(), CheckArguments);
  }

  let self: Nullable<Reference> = null;
  if (managerHasCapability(manager, capabilities, CREATE_CALLER_CAPABILITY)) {
    self = vm._getSelf_();
  }

  let state = manager.create(
    vm._getOwner_(),
    definition.state,
    args,
    vm.env,
    dynamicScope,
    self,
    !!hasDefaultBlock
  );

  // We want to reuse the `state` POJO here, because we know that the opcodes
  // only transition at exactly one place.
  instance.state = state;

  if (managerHasCapability(manager, capabilities, UPDATE_HOOK_CAPABILITY)) {
    vm._updateWith_(new UpdateComponentOpcode(state, manager, dynamicScope));
  }
});

define(REGISTER_COMPONENT_DESTRUCTOR_OP, (vm, { op1: _state }) => {
  let { manager, state, capabilities } = check(
    vm._fetchValue_(_state as Register),
    CheckComponentInstance
  );

  let d = manager.getDestroyable(state);

  if (
    import.meta.env.DEV &&
    !managerHasCapability(manager, capabilities, WILL_DESTROY_CAPABILITY) &&
    d !== null &&
    typeof 'willDestroy' in d
  ) {
    throw new Error(
      'BUG: Destructor has willDestroy, but the willDestroy capability was not enabled for this component. Pre-destruction hooks must be explicitly opted into'
    );
  }

  if (d) vm._associateDestroyable_(d);
});

define(BEGIN_COMPONENT_TRANSACTION_OP, (vm, { op1: _state }) => {
  let name;

  if (import.meta.env.DEV) {
    let { definition, manager } = check(
      vm._fetchValue_(_state as Register),
      CheckComponentInstance
    );

    name = definition.resolvedName ?? manager.getDebugName(definition.state);
  }

  vm._beginCacheGroup_(name);
  vm._elements_().startBlock();
});

define(PUT_COMPONENT_OPERATIONS_OP, (vm) => {
  vm._loadOperations_();
});

define(COMPONENT_ATTR_OP, (vm, { op1: _name, op2: _trusting, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let trusting = vm[CONSTANTS].getValue<boolean>(_trusting);
  let reference = check(vm.stack.pop(), CheckReference);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  check(vm._fetchValue_($t0), CheckInstanceof(ComponentElementOperations)).setAttribute(
    name,
    reference,
    trusting,
    namespace
  );
});

define(STATIC_COMPONENT_ATTR_OP, (vm, { op1: _name, op2: _value, op3: _namespace }) => {
  let name = vm[CONSTANTS].getValue<string>(_name);
  let value = vm[CONSTANTS].getValue<string>(_value);
  let namespace = _namespace ? vm[CONSTANTS].getValue<string>(_namespace) : null;

  check(vm._fetchValue_($t0), CheckInstanceof(ComponentElementOperations)).setStaticAttribute(
    name,
    value,
    namespace
  );
});

type DeferredAttribute = {
  value: string | Reference<unknown>;
  namespace: Nullable<string>;
  trusting?: boolean;
};

type QueuedModifier = [opcode: UpdateModifierOpcode, initialize: (element: Element) => void];

interface ServerDomTypes extends DomTypes {
  vm: InternalVM<ServerDomTypes>;
  opcodes: void;
  domTree: ServerTreeBuilderInterface;
}

export abstract class ComponentElementOperations<D extends DomTypes>
  implements ElementOperations<D>
{
  static flush<D extends DomTypes>(
    operations: ComponentElementOperations<D>,
    vm: InternalVM<D>
  ): ReturnType<D['treeBuilder']['flushElement']> {
    let type: DeferredAttribute | undefined;
    let attributes = operations.#attributes;

    for (let name in operations.#attributes) {
      if (name === 'type') {
        type = attributes[name];
        continue;
      }

      let attribute = unwrap(operations.#attributes[name]);
      let value = name === 'class' ? mergeClasses(operations.#classes) : attribute.value;

      operations.addAttr(vm, name, value, attribute.namespace, attribute.trusting ?? false);
    }

    if (type !== undefined) {
      operations.addAttr(vm, 'type', type.value, type.namespace, type.trusting ?? false);
    }

    return vm._elements_().flushElement() as ReturnType<D['treeBuilder']['flushElement']>;
  }

  readonly #attributes: Dict<DeferredAttribute> = {};
  readonly #classes: (string | Reference<unknown>)[] = [];

  setAttribute(
    name: string,
    value: Reference<unknown>,
    trusting: boolean,
    namespace: Nullable<string>
  ): void {
    let deferred = { value, namespace, trusting };

    if (name === 'class') {
      this.#classes.push(value);
    }

    this.#attributes[name] = deferred;
  }

  setStaticAttribute(name: string, value: string, namespace: Nullable<string>): void {
    let deferred = { value, namespace };

    if (name === 'class') {
      this.#classes.push(value);
    }

    this.#attributes[name] = deferred;
  }

  abstract addAttr(
    vm: InternalVM<D>,
    name: string,
    value: string | Reference<unknown>,
    namespace: Nullable<string>,
    trusting: boolean
  ): void;

  abstract flush(vm: D['vm']): D['opcodes'];
}

export class ServerComponentElementOperations
  extends ComponentElementOperations<ServerDomTypes>
  implements ElementOperations<ServerDomTypes>
{
  override addAttr(
    vm: InternalVM<ServerDomTypes>,
    name: string,
    value: string | Reference<unknown>,
    namespace: Nullable<string>,
    trusting: boolean
  ): void {
    vm._elements_().addAttr(name, _readValue_(value));
  }

  override flush(vm: InternalVM<ServerDomTypes>): void {
    ComponentElementOperations.flush(this, vm);
  }
}

export interface BrowserDomTypes extends DomTypes {
  vm: InternalVM<BrowserDomTypes>;
  opcodes: UpdateModifierOpcode[];
  addModifierFn: (
    definitionCache: TrackedCache<{
      definition: ModifierDefinition | undefined;
      owner: object;
    }>,
    args: CapturedArguments
  ) => UpdateModifierOpcode;
  treeBuilder: BrowserTreeBuilderInterface;
}

export class BrowserComponentElementOperations
  extends ComponentElementOperations<BrowserDomTypes>
  implements ElementOperations<BrowserDomTypes>
{
  readonly #modifiers: QueuedModifier[] = [];

  addModifier(
    definitionCache: TrackedCache<{
      definition: ModifierDefinition | undefined;
      owner: object;
    }>,
    args: CapturedArguments
  ): UpdateModifierOpcode {
    let element: Element | undefined;

    let modifier = new UpdateModifierOpcode(
      createCache(() => {
        let { definition, owner } = getValue(definitionCache);
        return {
          definition,
          owner,
          args,
          element: unwrap(element),
        };
      }, 'ModifierDefinition')
    );
    this.#modifiers.push([modifier, (newElement) => (element = newElement)]);
    return modifier;
  }

  override addAttr(
    vm: InternalVM<BrowserDomTypes>,
    name: string,
    value: string | Reference<unknown>,
    _namespace: Nullable<string>,
    _trusting: boolean
  ): void {
    if (typeof value === 'string') {
      vm._elements_().addAttr(name, value);
    } else {
      let attribute = vm._elements_().addAttr(name, valueForRef(value));
      if (!isConstRef(value)) {
        vm._updateWith_(new UpdateDynamicAttributeOpcode(value, attribute, vm.env));
      }
    }
  }

  override flush(vm: InternalVM<BrowserDomTypes>): UpdateModifierOpcode[] {
    let element = ComponentElementOperations.flush(this, vm);

    return this.#modifiers.map(([opcode, initialize]) => {
      initialize(element as Element);
      return opcode;
    });
  }
}

function mergeClasses(classes: (string | Reference)[]): string | Reference<unknown> {
  if (classes.length === 0) {
    return '';
  }
  if (classes.length === 1) {
    return unwrap(classes[0]);
  }
  if (allStringClasses(classes)) {
    return classes.join(' ');
  }

  return createClassListReference(classes as Reference[]);
}

function allStringClasses(classes: (string | Reference<unknown>)[]): classes is string[] {
  for (let class_ of classes) {
    if (typeof class_ !== 'string') {
      return false;
    }
  }
  return true;
}

define(DID_CREATE_ELEMENT_OP, (vm, { op1: _state }) => {
  let { definition, state } = check(vm._fetchValue_(_state as Register), CheckComponentInstance);
  let { manager } = definition;

  let operations = check(vm._fetchValue_($t0), CheckInstanceof(ComponentElementOperations));

  (manager as WithElementHook<unknown>).didCreateElement(
    state,
    expect(vm._elements_()._constructing_, `Expected a constructing element in DidCreateOpcode`),
    operations
  );
});

define(GET_COMPONENT_SELF_OP, (vm, { op1: _state, op2: _names }) => {
  let instance = check(vm._fetchValue_(_state as Register), CheckComponentInstance);
  let { definition, state } = instance;
  let { manager } = definition;
  let selfReference = manager.getSelf(state);

  if (vm.env.debugRenderTree !== undefined) {
    let instance = check(vm._fetchValue_(_state as Register), CheckComponentInstance);
    let { definition, manager } = instance;

    let args: CapturedArguments;

    if (vm.stack.peek() === vm[ARGS]) {
      args = vm[ARGS].capture();
    } else {
      let names = vm[CONSTANTS].getArray<string>(_names);
      vm[ARGS].setup(vm.stack, names, [], 0, true);
      args = vm[ARGS].capture();
    }

    let moduleName: string;
    let compilable: CompilableProgram | null = definition.compilable;

    if (compilable === null) {
      assert(
        managerHasCapability(manager, instance.capabilities, DYNAMIC_LAYOUT_CAPABILITY),
        'BUG: No template was found for this component, and the component did not have the dynamic layout capability'
      );

      compilable = manager.getDynamicLayout(state, vm.runtime.resolver);

      moduleName = compilable === null ? '__default__.hbs' : compilable.moduleName;
    } else {
      moduleName = compilable.moduleName;
    }

    // For tearing down the debugRenderTree
    vm._associateDestroyable_(instance);

    if (hasCustomDebugRenderTreeLifecycle(manager)) {
      let nodes = manager.getDebugCustomRenderTree(
        instance.definition.state,
        instance.state,
        args,
        moduleName
      );

      for (let node of nodes) {
        let { bucket } = node;
        vm.env.debugRenderTree.create(bucket, node);

        registerDestructor(instance, () => {
          vm.env.debugRenderTree?.willDestroy(bucket);
        });

        vm._updateWith_(new DebugRenderTreeUpdateOpcode(bucket));
      }
    } else {
      let name = definition.resolvedName ?? manager.getDebugName(definition.state);

      vm.env.debugRenderTree.create(instance, {
        type: 'component',
        name,
        args,
        template: moduleName,
        instance: valueForRef(selfReference),
      });

      vm._associateDestroyable_(instance);

      registerDestructor(instance, () => {
        vm.env.debugRenderTree?.willDestroy(instance);
      });

      vm._updateWith_(new DebugRenderTreeUpdateOpcode(instance));
    }
  }

  vm.stack.push(selfReference);
});

define(GET_COMPONENT_TAG_NAME_OP, (vm, { op1: _state }) => {
  let { definition, state } = check(vm._fetchValue_(_state as Register), CheckComponentInstance);
  let { manager } = definition;

  let tagName = (
    manager as Recast<InternalComponentManager, WithDynamicTagName<unknown>>
  ).getTagName(state);

  // User provided value from JS, so we don't bother to encode
  vm.stack.push(tagName);
});

// Dynamic Invocation Only
define(GET_COMPONENT_LAYOUT_OP, (vm, { op1: _state }) => {
  let instance = check(vm._fetchValue_(_state as Register), CheckComponentInstance);

  let { manager, definition } = instance;
  let { stack } = vm;

  let { compilable } = definition;

  if (compilable === null) {
    let { capabilities } = instance;

    assert(
      managerHasCapability(manager, capabilities, DYNAMIC_LAYOUT_CAPABILITY),
      'BUG: No template was found for this component, and the component did not have the dynamic layout capability'
    );

    compilable = manager.getDynamicLayout(instance.state, vm.runtime.resolver);

    if (compilable === null) {
      compilable = managerHasCapability(manager, capabilities, WRAPPED_CAPABILITY)
        ? unwrapTemplate(vm[CONSTANTS].defaultTemplate).asWrappedLayout()
        : unwrapTemplate(vm[CONSTANTS].defaultTemplate).asLayout();
    }
  }

  let handle = compilable.compile(vm.context);

  stack.push(compilable.symbolTable, handle);
});

define(MAIN_OP, (vm, { op1: register }) => {
  let definition = check(vm.stack.pop(), CheckComponentDefinition);
  let invocation = check(vm.stack.pop(), CheckInvocation);

  let { manager, capabilities } = definition;

  let state: PopulatedComponentInstance = {
    definition,
    manager,
    capabilities,
    state: null,
    handle: invocation.handle,
    table: invocation.symbolTable,
    lookup: null,
  };

  vm._loadValue_(register as Register, state);
});

define(POPULATE_LAYOUT_OP, (vm, { op1: _state }) => {
  let { stack } = vm;

  // In import.meta.env.DEV handles could be ErrHandle objects
  let handle = check(stack.pop(), CheckHandle);
  let table = check(stack.pop(), CheckProgramSymbolTable);

  let state = check(vm._fetchValue_(_state as Register), CheckComponentInstance);

  state.handle = handle;
  state.table = table;
});

define(VIRTUAL_ROOT_SCOPE_OP, (vm, { op1: _state }) => {
  let { table, manager, capabilities, state } = check(
    vm._fetchValue_(_state as Register),
    CheckFinishedComponentInstance
  );

  let owner;

  if (managerHasCapability(manager, capabilities, HAS_SUB_OWNER_CAPABILITY)) {
    owner = manager.getOwner(state);
    vm._loadValue_($t1, null); // Clear the temp register
  } else {
    // Check the temp register to see if an owner was resolved from currying
    owner = vm._fetchValue_<Owner | null>($t1);

    if (owner === null) {
      // If an owner wasn't found, default to using the current owner. This
      // will happen for normal dynamic component invocation,
      // e.g. <SomeClassicEmberComponent/>
      owner = vm._getOwner_();
    } else {
      // Else the owner was found, so clear the temp register. This will happen
      // if we are loading a curried component, e.g. <@someCurriedComponent/>
      vm._loadValue_($t1, null);
    }
  }

  vm._pushRootScope_(table.symbols.length + 1, owner);
});

define(SET_NAMED_VARIABLES_OP, (vm, { op1: _state }) => {
  let state = check(vm._fetchValue_(_state as Register), CheckFinishedComponentInstance);
  let scope = vm._scope_();

  let args = check(vm.stack.peek(), CheckArguments);
  let callerNames = args.named.atNames;

  for (let index = callerNames.length - 1; index >= 0; index--) {
    let atName = unwrap(callerNames[index]);
    let symbol = state.table.symbols.indexOf(atName);
    let value = args.named.get(atName, true);

    if (symbol !== -1) scope.bindSymbol(symbol + 1, value);
    if (state.lookup) state.lookup[atName] = value;
  }
});

function bindBlock(
  symbolName: string,
  blockName: string,
  state: ComponentInstance,
  blocks: BlockArgumentsImpl,
  vm: InternalVM
) {
  let symbol = state.table.symbols.indexOf(symbolName);
  let block = blocks.get(blockName);

  if (symbol !== -1) vm._scope_().bindBlock(symbol + 1, block);
  if (state.lookup) state.lookup[symbolName] = block;
}

define(SET_BLOCKS_OP, (vm, { op1: _state }) => {
  let state = check(vm._fetchValue_(_state as Register), CheckFinishedComponentInstance);
  let { blocks } = check(vm.stack.peek(), CheckArguments);

  for (let [index] of enumerate(blocks._names_)) {
    bindBlock(unwrap(blocks.symbolNames[index]), unwrap(blocks._names_[index]), state, blocks, vm);
  }
});

// Dynamic Invocation Only
define(INVOKE_COMPONENT_LAYOUT_OP, (vm, { op1: _state }) => {
  let state = check(vm._fetchValue_(_state as Register), CheckFinishedComponentInstance);

  vm._call_(state.handle);
});

define(DID_RENDER_LAYOUT_OP, (vm, { op1: _state }) => {
  let instance = check(vm._fetchValue_(_state as Register), CheckComponentInstance);
  let { manager, state, capabilities } = instance;
  let bounds = vm._elements_().endBlock();

  let debugBounds = getClassicBoundsFor(bounds);

  if (vm.env.debugRenderTree !== undefined) {
    if (hasCustomDebugRenderTreeLifecycle(manager)) {
      let nodes = manager.getDebugCustomRenderTree(instance.definition.state, state, EMPTY_ARGS);

      for (let node of nodes.reverse()) {
        let { bucket } = node;

        vm.env.debugRenderTree.didRender(bucket, debugBounds);

        vm._updateWith_(new DebugRenderTreeDidRenderOpcode(bucket, debugBounds));
      }
    } else {
      vm.env.debugRenderTree.didRender(instance, debugBounds);

      vm._updateWith_(new DebugRenderTreeDidRenderOpcode(instance, debugBounds));
    }
  }

  if (managerHasCapability(manager, capabilities, CREATE_INSTANCE_CAPABILITY)) {
    let mgr = check(manager, CheckInterface({ didRenderLayout: CheckFunction }));
    mgr.didRenderLayout(state, getClassicBoundsFor(bounds));

    vm.env.didCreate(instance as ComponentInstanceWithCreate);
    vm._updateWith_(new DidUpdateLayoutOpcode(instance as ComponentInstanceWithCreate, bounds));
  }
});

define(COMMIT_COMPONENT_TRANSACTION_OP, (vm) => {
  vm._commitCacheGroup_();
});

export class UpdateComponentOpcode implements UpdatingOpcode {
  readonly #component: ComponentInstanceState;
  readonly #manager: WithUpdateHook;
  readonly #dynamicScope: Nullable<DynamicScope>;

  constructor(
    component: ComponentInstanceState,
    manager: WithUpdateHook,
    dynamicScope: Nullable<DynamicScope>
  ) {
    this.#component = component;
    this.#manager = manager;
    this.#dynamicScope = dynamicScope;
  }

  evaluate(_vm: UpdatingVM) {
    this.#manager.update(this.#component, this.#dynamicScope);
  }
}

export class DidUpdateLayoutOpcode implements UpdatingOpcode {
  readonly #component: ComponentInstanceWithCreate;
  readonly #bounds: BlockBoundsRef;

  constructor(component: ComponentInstanceWithCreate, bounds: BlockBoundsRef) {
    this.#component = component;
    this.#bounds = bounds;
  }

  evaluate(vm: UpdatingVM) {
    let component = this.#component;
    let { manager, state } = component;

    manager.didUpdateLayout(state, getClassicBoundsFor(this.#bounds));

    vm.env.didUpdate(component);
  }
}

class DebugRenderTreeUpdateOpcode implements UpdatingOpcode {
  readonly #bucket: object;
  constructor(bucket: object) {
    this.#bucket = bucket;
  }

  evaluate(vm: UpdatingVM) {
    vm.env.debugRenderTree?.update(this.#bucket);
  }
}

class DebugRenderTreeDidRenderOpcode implements UpdatingOpcode {
  readonly #bucket: object;
  readonly #bounds: Bounds;

  constructor(bucket: object, bounds: Bounds) {
    this.#bucket = bucket;
    this.#bounds = bounds;
  }

  evaluate(vm: UpdatingVM) {
    vm.env.debugRenderTree?.didRender(this.#bucket, this.#bounds);
  }
}
