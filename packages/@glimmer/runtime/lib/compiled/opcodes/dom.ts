import type {
  CapturedPositionalArguments,
  Environment,
  ModifierDefinition,
  ModifierDefinitionState,
  ModifierInstance,
  Nullable,
  Owner,
  UpdatingOpcode,
  UpdatingVM,
} from '@glimmer/interfaces';
import type { Reactive } from '@glimmer/reference';
import type { Revision, Tag } from '@glimmer/validator';
import { check, CheckElement, CheckMaybe, CheckNode, CheckString } from '@glimmer/debug';
import { associateDestroyableChild, destroy } from '@glimmer/destroyable';
import { getInternalModifierManager } from '@glimmer/manager';
import { Formula, isConstant, readReactive, unwrapReactive } from '@glimmer/reference';
import {
  assign,
  debugToString,
  expect,
  isObject,
  Results,
  stringifyDebugLabel,
} from '@glimmer/util';
import { consumeTag, CURRENT_TAG, validateTag, valueForTag } from '@glimmer/validator';
import { $t0, CurriedTypes, Op } from '@glimmer/vm';

import type { CurriedValue } from '../../curried-value';
import type { DynamicAttribute } from '../../vm/attributes/dynamic';

import { isCurried, resolveCurriedValue } from '../../curried-value';
import { APPEND_OPCODES } from '../../opcodes';
import { CheckArguments, CheckOperations, CheckReactive } from './-debug-strip';
import { Assert } from './vm';

APPEND_OPCODES.add(Op.Text, (vm, { op1: text }) => {
  vm.elements().appendText(vm.constants.getValue(text));
});

APPEND_OPCODES.add(Op.Comment, (vm, { op1: text }) => {
  vm.elements().appendComment(vm.constants.getValue(text));
});

APPEND_OPCODES.add(Op.OpenElement, (vm, { op1: tag }) => {
  vm.elements().openElement(vm.constants.getValue(tag));
});

APPEND_OPCODES.add(Op.OpenDynamicElement, (vm) => {
  vm.popReactive((tagName) => vm.elements().openElement(tagName), CheckString);
});

APPEND_OPCODES.add(Op.PushRemoteElement, (vm) => {
  let [reactiveElement, element] = vm.popResult(CheckElement);
  let [reactiveInsertBefore, insertBefore] = vm.popResult(CheckMaybe(CheckNode));
  let [, guid] = vm.popResult(CheckString);

  vm.unwrap(Results([element, insertBefore, guid]), ([element, insertBefore, guid]) => {
    if (!isConstant(reactiveElement)) {
      vm.updateWith(Assert.of(reactiveElement, element));
    }

    if (insertBefore !== undefined && !isConstant(reactiveInsertBefore)) {
      vm.updateWith(Assert.of(reactiveInsertBefore, insertBefore));
    }

    let block = vm.elements().pushRemoteElement(element, guid, insertBefore);
    if (block) vm.associateDestroyable(block);
  });
});

APPEND_OPCODES.add(Op.PopRemoteElement, (vm) => {
  vm.elements().popRemoteElement();
});

APPEND_OPCODES.add(Op.FlushElement, (vm) => {
  let operations = check(vm.fetchValue($t0), CheckOperations);
  let modifiers: Nullable<ModifierInstance[]> = null;

  if (operations) {
    modifiers = operations.flush(vm);
    vm.loadValue($t0, null);
  }

  vm.elements().flushElement(modifiers);
});

APPEND_OPCODES.add(Op.CloseElement, (vm) => {
  let modifiers = vm.elements().closeElement();

  if (modifiers !== null) {
    modifiers.forEach((modifier) => {
      vm.env.scheduleInstallModifier(modifier);
      const d = modifier.manager.getDestroyable(modifier.state);

      if (d !== null) {
        vm.associateDestroyable(d);
      }
    });
  }
});

APPEND_OPCODES.add(Op.Modifier, (vm, { op1: handle }) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let owner = vm.getOwner();

  let args = check(vm.stack.pop(), CheckArguments);
  let definition = vm.constants.getValue<ModifierDefinition>(handle);

  let { manager } = definition;

  let { constructing } = vm.elements();

  let state = manager.create(
    owner,
    expect(constructing, 'BUG: ElementModifier could not find the element it applies to'),
    definition.state,
    args.capture()
  );

  let instance: ModifierInstance = {
    manager,
    state,
    definition,
  };

  let operations = expect(
    check(vm.fetchValue($t0), CheckOperations),
    'BUG: ElementModifier could not find operations to append to'
  );

  operations.addModifier(instance);

  let tag = manager.getTag(state);

  if (tag !== null) {
    consumeTag(tag);
    return vm.updateWith(new UpdateModifierOpcode(tag, instance));
  }
});

APPEND_OPCODES.add(Op.DynamicModifier, (vm) => {
  if (vm.env.isInteractive === false) {
    return;
  }

  let { stack } = vm;
  let ref = check(stack.pop(), CheckReactive);
  let args = check(stack.pop(), CheckArguments).capture();
  let { constructing } = vm.elements();
  let initialOwner = vm.getOwner();

  let instanceRef = Formula(() => {
    let value = unwrapReactive(ref);
    let owner: Owner;

    if (!isObject(value)) {
      return;
    }

    let hostDefinition: CurriedValue | ModifierDefinitionState;

    if (isCurried(value, CurriedTypes.Modifier)) {
      let {
        definition: resolvedDefinition,
        owner: curriedOwner,
        positional,
        named,
      } = resolveCurriedValue(value);

      hostDefinition = resolvedDefinition;
      owner = curriedOwner;

      if (positional !== undefined) {
        args.positional = positional.concat(args.positional) as CapturedPositionalArguments;
      }

      if (named !== undefined) {
        args.named = assign({}, ...named, args.named);
      }
    } else {
      hostDefinition = value;
      owner = initialOwner;
    }

    let manager = getInternalModifierManager(hostDefinition, true);

    if (manager === null) {
      if (import.meta.env.DEV) {
        const label = stringifyDebugLabel(ref);
        throw new Error(
          `Expected a dynamic modifier definition, but received an object or function that did not have a modifier manager associated with it. The dynamic invocation was \`{{${
            String(label)
          }}}\`, and the incorrect definition is the value at the path \`${debugToString!(
            hostDefinition
          )}\`, which was: ${debugToString!(hostDefinition)}`
        );
      } else {
        throw new Error('BUG: modifier manager expected');
      }
    }

    let definition = {
      resolvedName: null,
      manager,
      state: hostDefinition,
    };

    let state = manager.create(
      owner,
      expect(constructing, 'BUG: ElementModifier could not find the element it applies to'),
      definition.state,
      args
    );

    return {
      manager,
      state,
      definition,
    };
  });

  let result = readReactive(instanceRef);

  if (vm.unwrapResult(result)) {
    const instance = result.value;
    let tag = null;

    if (instance !== undefined) {
      let operations = expect(
        check(vm.fetchValue($t0), CheckOperations),
        'BUG: ElementModifier could not find operations to append to'
      );

      operations.addModifier(instance);

      tag = instance.manager.getTag(instance.state);

      if (tag !== null) {
        consumeTag(tag);
      }
    }

    if (!isConstant(ref) || tag) {
      return vm.updateWith(new UpdateDynamicModifierOpcode(tag, instance, instanceRef));
    }
  }
});

export class UpdateModifierOpcode implements UpdatingOpcode {
  private lastUpdated: Revision;

  constructor(
    private tag: Tag,
    private modifier: ModifierInstance
  ) {
    this.lastUpdated = valueForTag(tag);
  }

  evaluate(vm: UpdatingVM) {
    let { modifier, tag, lastUpdated } = this;

    consumeTag(tag);

    if (!validateTag(tag, lastUpdated)) {
      vm.env.scheduleUpdateModifier(modifier);
      this.lastUpdated = valueForTag(tag);
    }
  }
}

export class UpdateDynamicModifierOpcode implements UpdatingOpcode {
  private lastUpdated: Revision;

  constructor(
    private tag: Tag | null,
    private instance: ModifierInstance | undefined,
    private instanceRef: Reactive<ModifierInstance | undefined>
  ) {
    this.lastUpdated = valueForTag(tag ?? CURRENT_TAG);
  }

  evaluate(vm: UpdatingVM) {
    let { tag, lastUpdated, instance, instanceRef } = this;

    let newInstance = unwrapReactive(instanceRef);

    if (newInstance !== instance) {
      if (instance !== undefined) {
        let destroyable = instance.manager.getDestroyable(instance.state);

        if (destroyable !== null) {
          destroy(destroyable);
        }
      }

      if (newInstance !== undefined) {
        let { manager, state } = newInstance;
        let destroyable = manager.getDestroyable(state);

        if (destroyable !== null) {
          associateDestroyableChild(this, destroyable);
        }

        tag = manager.getTag(state);

        if (tag !== null) {
          this.lastUpdated = valueForTag(tag);
        }

        this.tag = tag;
        vm.env.scheduleInstallModifier(newInstance);
      }

      this.instance = newInstance;
    } else if (tag !== null && !validateTag(tag, lastUpdated)) {
      vm.env.scheduleUpdateModifier(instance!);
      this.lastUpdated = valueForTag(tag);
    }

    if (tag !== null) {
      consumeTag(tag);
    }
  }
}

APPEND_OPCODES.add(Op.StaticAttr, (vm, { op1: _name, op2: _value, op3: _namespace }) => {
  let name = vm.constants.getValue<string>(_name);
  let value = vm.constants.getValue<string>(_value);
  let namespace = _namespace ? vm.constants.getValue<string>(_namespace) : null;

  vm.elements().setStaticAttribute(name, value, namespace);
});

APPEND_OPCODES.add(Op.DynamicAttr, (vm, { op1: _name, op2: _trusting, op3: _namespace }) => {
  let name = vm.constants.getValue<string>(_name);
  let trusting = vm.constants.getValue<boolean>(_trusting);
  let reference = check(vm.stack.pop(), CheckReactive);

  vm.deref(reference, (value) => {
    let namespace = _namespace ? vm.constants.getValue<string>(_namespace) : null;

    let attribute = vm.elements().setDynamicAttribute(name, value, trusting, namespace);

    if (!isConstant(reference)) {
      vm.updateWith(new UpdateDynamicAttributeOpcode(reference, attribute, vm.env));
    }
  });
});

export class UpdateDynamicAttributeOpcode implements UpdatingOpcode {
  private updateRef: Reactive;

  constructor(reference: Reactive<unknown>, attribute: DynamicAttribute, env: Environment) {
    let initialized = false;

    this.updateRef = Formula(() => {
      let value = unwrapReactive(reference);

      if (initialized === true) {
        attribute.update(value, env);
      } else {
        initialized = true;
      }
    });

    unwrapReactive(this.updateRef);
  }

  evaluate(vm: UpdatingVM) {
    const result = readReactive(this.updateRef);

    if (result.type === 'err') {
      vm.unwind();
    }
  }
}
